import { requireUser } from '@/lib/auth';
import { sql } from '@/lib/db';
import Avatar from '@/components/Avatar';

const fmt = (sec: number | null) =>
  sec == null ? '—' : sec < 3600 ? Math.max(1, Math.round(sec / 60)) + 'm' : sec < 86400 ? (sec / 3600).toFixed(1) + 'h' : (sec / 86400).toFixed(1) + 'd';

export default async function ReportsPage() {
  await requireUser();
  const [s] = await sql<
    { open: number; unassigned: number; pending: number; urgent: number; created7: number; closed7: number; frt: number | null; resolve: number | null }[]
  >`
    select
      count(*) filter (where status <> 'closed')::int as open,
      count(*) filter (where status <> 'closed' and assignee_id is null)::int as unassigned,
      count(*) filter (where status = 'pending')::int as pending,
      count(*) filter (where status <> 'closed' and priority in ('high', 'urgent'))::int as urgent,
      count(*) filter (where created_at > now() - interval '7 days')::int as created7,
      count(*) filter (where closed_at > now() - interval '7 days')::int as closed7,
      (avg(extract(epoch from first_response_at - created_at)) filter (where first_response_at > now() - interval '30 days'))::float as frt,
      (avg(extract(epoch from closed_at - created_at)) filter (where closed_at > now() - interval '30 days'))::float as resolve
    from tickets`;

  const people = await sql<
    { id: string; name: string; role: string; active_n: number; pending_n: number; closed30: number; replies30: number; frt: number | null; online: boolean }[]
  >`
    select u.id, u.name, u.role,
      (select count(*) from tickets t where t.assignee_id = u.id and t.status = 'active')::int as active_n,
      (select count(*) from tickets t where t.assignee_id = u.id and t.status = 'pending')::int as pending_n,
      (select count(*) from tickets t where t.assignee_id = u.id and t.closed_at > now() - interval '30 days')::int as closed30,
      (select count(*) from messages m where m.author_id = u.id and m.type = 'reply' and m.created_at > now() - interval '30 days')::int as replies30,
      (select avg(extract(epoch from t.first_response_at - t.created_at)) from tickets t
        where t.first_responder_id = u.id and t.first_response_at > now() - interval '30 days')::float as frt,
      exists (select 1 from ticket_presence p where p.user_id = u.id and p.updated_at > now() - interval '30 seconds') as online
    from users u where u.active order by u.name`;

  const cards: [string | number, string][] = [
    [s.open, 'Open conversations'],
    [s.unassigned, 'Unassigned'],
    [s.pending, 'Waiting on customer'],
    [s.urgent, 'High or urgent open'],
    [s.created7, 'New in last 7 days'],
    [s.closed7, 'Closed in last 7 days'],
    [fmt(s.frt), 'Avg first response (30 days)'],
    [fmt(s.resolve), 'Avg time to close (30 days)'],
  ];

  return (
    <div className="page">
      <h2>Reports</h2>
      <p className="lead">How work is spread across the team, and how fast customers hear back.</p>
      <div className="cards">
        {cards.map(([k, l]) => (
          <div key={l} className="card stat">
            <div className="k">{k}</div>
            <div className="l">{l}</div>
          </div>
        ))}
      </div>
      <table>
        <thead>
          <tr>
            <th>Teammate</th>
            <th>Active</th>
            <th>Pending</th>
            <th>Closed (30d)</th>
            <th>Replies (30d)</th>
            <th>Avg first response</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {people.map((p) => (
            <tr key={p.id}>
              <td>
                <Avatar name={p.name} id={p.id} /> {p.name} {p.role === 'admin' && <span className="pill">admin</span>}
              </td>
              <td>{p.active_n}</td>
              <td>{p.pending_n}</td>
              <td>{p.closed30}</td>
              <td>{p.replies30}</td>
              <td>{fmt(p.frt)}</td>
              <td>{p.online && <span className="pill st-active">in a ticket now</span>}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
