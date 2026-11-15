import { sql } from '@/lib/db';
import { getUser } from '@/lib/auth';
import { sameOrigin, UUID_RE } from '@/lib/util';

export const runtime = 'nodejs';

/** Heartbeat from an open conversation. Returns teammates viewing the same one. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getUser();
  if (!user) return new Response(null, { status: 401 });
  if (!sameOrigin(req)) return new Response(null, { status: 403 });
  const { id } = await params;
  if (!UUID_RE.test(id)) return new Response(null, { status: 404 });

  if (new URL(req.url).searchParams.get('leave')) {
    await sql`delete from ticket_presence where ticket_id = ${id} and user_id = ${user.id}`;
    return new Response(null, { status: 204 });
  }

  let typing = false;
  try {
    typing = ((await req.json()) as { typing?: unknown })?.typing === true;
  } catch {
    /* empty body */
  }

  try {
    await sql`
      insert into ticket_presence (ticket_id, user_id, typing, updated_at) values (${id}, ${user.id}, ${typing}, now())
      on conflict (ticket_id, user_id) do update set typing = excluded.typing, updated_at = now()`;
  } catch {
    return new Response(null, { status: 404 }); // ticket was deleted
  }
  if (Math.random() < 0.05) await sql`delete from ticket_presence where updated_at < now() - interval '10 minutes'`;

  const others = await sql<{ name: string; typing: boolean }[]>`
    select u.name, p.typing from ticket_presence p join users u on u.id = p.user_id
    where p.ticket_id = ${id} and p.user_id <> ${user.id} and p.updated_at > now() - interval '25 seconds'
    order by u.name`;
  return Response.json({ others });
}
