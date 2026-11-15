import { createTicket } from '@/lib/tickets';
import { dbConfigured } from '@/lib/db';
import { allow } from '@/lib/ratelimit';
import { filesFrom, filesProblem } from '@/lib/files';
import { EMAIL_RE, field, ipFromRequest, sameOrigin } from '@/lib/util';

export const runtime = 'nodejs';

const fail = (error: string, status = 400) => Response.json({ ok: false, error }, { status });

export async function POST(req: Request) {
  if (!dbConfigured) return fail('The helpdesk isn’t set up yet. Please try again later.', 503);
  if (!sameOrigin(req)) return fail('This form must be sent from the contact page.', 403);
  const ip = ipFromRequest(req) ?? 'unknown';
  if (!(await allow(`contact:${ip}`, 5, 10 * 60))) return fail('Too many requests. Please wait a few minutes and try again.', 429);

  let fd: FormData;
  try {
    fd = await req.formData();
  } catch {
    return fail('We couldn’t read the form. Attachments may be too large (4 MB total).');
  }
  // Bots fill the hidden "website" field; pretend it worked.
  if (field(fd, 'website', 200)) return Response.json({ ok: true, url: '/contact?sent=1' });

  const name = field(fd, 'name', 120);
  const email = field(fd, 'email', 200).toLowerCase();
  const subject = field(fd, 'subject', 200);
  const body = field(fd, 'body', 20000);
  if (!name || !subject || !body) return fail('Please fill in your name, subject and message.');
  if (!EMAIL_RE.test(email)) return fail('Please enter a valid email address.');
  const files = filesFrom(fd);
  const problem = filesProblem(files);
  if (problem) return fail(problem);

  const t = await createTicket({ subject, customerName: name, customerEmail: email, body, priority: 'normal', source: 'contact_form', createdBy: null, files });
  return Response.json({ ok: true, url: `/t/${t.portalToken}?new=1` });
}
