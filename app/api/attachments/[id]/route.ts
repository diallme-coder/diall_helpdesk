import { sql } from '@/lib/db';
import { getUser } from '@/lib/auth';
import { TOKEN_RE, UUID_RE } from '@/lib/util';

export const runtime = 'nodejs';

const SAFE_INLINE = /^image\/(png|jpeg|gif|webp)$/;
const notFound = () => new Response('Not found', { status: 404 });

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID_RE.test(id)) return notFound();

  const [a] = await sql<{ filename: string; content_type: string; data: Buffer; msg_type: string; portal_token: string }[]>`
    select a.filename, a.content_type, a.data, m.type as msg_type, t.portal_token
    from attachments a
    join messages m on m.id = a.message_id
    join tickets t on t.id = a.ticket_id
    where a.id = ${id}`;
  if (!a) return notFound();

  // Team members can open any file; a customer only files in their own ticket's visible messages.
  const user = await getUser();
  const token = new URL(req.url).searchParams.get('t') ?? '';
  const customerOk = TOKEN_RE.test(token) && token === a.portal_token && (a.msg_type === 'customer' || a.msg_type === 'reply');
  if (!user && !customerOk) return notFound();

  const inline = SAFE_INLINE.test(a.content_type);
  const ascii = a.filename.replace(/[^\x20-\x7e]/g, '_').replace(/["\\]/g, '_');
  return new Response(new Uint8Array(a.data), {
    headers: {
      'Content-Type': inline ? a.content_type : 'application/octet-stream',
      'Content-Disposition': `${inline ? 'inline' : 'attachment'}; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(a.filename)}`,
      'Content-Length': String(a.data.length),
      'X-Content-Type-Options': 'nosniff',
      'Content-Security-Policy': "default-src 'none'; img-src 'self'; sandbox",
      'Cache-Control': 'private, no-store',
    },
  });
}
