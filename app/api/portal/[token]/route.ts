import { sql } from '@/lib/db';
import { audit } from '@/lib/audit';
import { allow } from '@/lib/ratelimit';
import { filesFrom, filesProblem, saveFiles } from '@/lib/files';
import { field, ipFromRequest, preview, sameOrigin, TOKEN_RE } from '@/lib/util';

export const runtime = 'nodejs';

const fail = (error: string, status = 400) => Response.json({ ok: false, error }, { status });

export async function POST(req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!sameOrigin(req)) return fail('Please reply from your ticket page.', 403);
  if (!TOKEN_RE.test(token)) return fail('Ticket not found.', 404);
  const ip = ipFromRequest(req) ?? 'unknown';
  if (!(await allow(`portal:${ip}`, 15, 10 * 60))) return fail('Too many messages. Please wait a few minutes.', 429);

  const [t] = await sql<{ id: string; number: string; customer_name: string }[]>`
    select id, number, customer_name from tickets where portal_token = ${token}`;
  if (!t) return fail('Ticket not found.', 404);

  let fd: FormData;
  try {
    fd = await req.formData();
  } catch {
    return fail('We couldn’t read your message. Attachments may be too large (4 MB total).');
  }
  const body = field(fd, 'body', 20000);
  if (!body) return fail('Please write a message.');
  const files = filesFrom(fd);
  const problem = filesProblem(files);
  if (problem) return fail(problem);

  const [m] = await sql<{ id: string }[]>`
    insert into messages (ticket_id, type, body) values (${t.id}, 'customer', ${body}) returning id`;
  await saveFiles(t.id, m.id, files);
  await sql`update tickets set status = 'active', closed_at = null, updated_at = now(),
            last_preview = ${preview(body)}, last_type = 'customer' where id = ${t.id}`;
  await audit(null, 'ticket.customer_replied', { type: 'ticket', id: Number(t.number) }, { files: files.length }, `${t.customer_name} (customer)`);
  return Response.json({ ok: true });
}
