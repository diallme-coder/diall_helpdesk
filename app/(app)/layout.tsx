import Link from 'next/link';
import { Suspense, type ReactNode } from 'react';
import { requireUser } from '@/lib/auth';
import { sql } from '@/lib/db';
import { APP_NAME } from '@/lib/constants';
import { logout } from '@/lib/actions/auth';
import SideNav from '@/components/SideNav';
import Avatar from '@/components/Avatar';

export const dynamic = 'force-dynamic';

export default async function AppLayout({ children }: { children: ReactNode }) {
  const u = await requireUser();
  const [c] = await sql<Record<string, number>[]>`
    select
      count(*) filter (where status <> 'closed' and assignee_id is null)::int as unassigned,
      count(*) filter (where status <> 'closed' and assignee_id = ${u.id})::int as mine,
      count(*) filter (where status <> 'closed' and assignee_id is not null)::int as assigned,
      count(*) filter (where status = 'pending')::int as pending,
      count(*) filter (where status = 'closed')::int as closed,
      count(*)::int as "all"
    from tickets`;
  const tags = await sql<{ tag: string; n: number }[]>`
    select tag, count(*)::int as n from tickets, unnest(tags) as tag
    where status <> 'closed' group by tag order by n desc, tag limit 15`;

  return (
    <div className="shell">
      <aside className="side">
        <div className="brand">
          <i />
          {APP_NAME}
        </div>
        <Link className="newbtn" href="/inbox/new">
          + New conversation
        </Link>
        <Suspense>
          <SideNav counts={c} tags={[...tags]} isAdmin={u.role === 'admin'} />
        </Suspense>
        <div className="sidefoot">
          <div className="me">
            <Avatar name={u.name} id={u.id} />
            <div>
              <div className="mename">{u.name}</div>
              <div className="merole">{u.role === 'admin' ? 'Admin' : 'Agent'}</div>
            </div>
          </div>
          <div className="melinks">
            <Link href="/change-password">Change password</Link>
            <form action={logout}>
              <button className="linkbtn">Sign out</button>
            </form>
          </div>
        </div>
      </aside>
      <div className="content">{children}</div>
    </div>
  );
}
