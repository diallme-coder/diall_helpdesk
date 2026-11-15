import Link from 'next/link';
import { requireAdmin } from '@/lib/auth';
import { sql } from '@/lib/db';
import Time from '@/components/Time';
import { UUID_RE } from '@/lib/util';

type SP = Promise<Record<string, string | string[] | undefined>>;
type Row = {
  id: string;
  actor_label: string | null;
  action: string;
  target_type: string | null;
  target_id: string | null;
  details: Record<string, unknown>;
  ip: string | null;
  created_at: Date;
};

const PAGE = 100;
const CATEGORIES: Record<string, string> = {
  auth: 'Sign-ins and passwords',
  user: 'User management',
  ticket: 'Conversations',
  workflow: 'Workflows',
  saved_reply: 'Saved replies',
};

function detailText(d: Record<string, unknown>) {
  return Object.entries(d)
    .filter(([, v]) => v !== null && v !== '' && !(Array.isArray(v) && v.length === 0))
    .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(', ') : String(v)}`)
    .join(' · ');
}

export default async function ActivityPage({ searchParams }: { searchParams: SP }) {
  await requireAdmin();
  const sp = await searchParams;
  const actor = typeof sp.actor === 'string' && UUID_RE.test(sp.actor) ? sp.actor : '';
  const cat = typeof sp.cat === 'string' && sp.cat in CATEGORIES ? sp.cat : '';
  const page = Math.max(0, Number(typeof sp.page === 'string' ? sp.page : 0) || 0);

  let where = sql`true`;
  if (actor) where = sql`${where} and actor_id = ${actor}`;
  if (cat) where = sql`${where} and action like ${cat + '.%'}`;

  const rows = await sql<Row[]>`
    select id::text, actor_label, action, target_type, target_id, details, ip, created_at
    from activity_log where ${where}
    order by created_at desc, id desc
    limit ${PAGE + 1} offset ${page * PAGE}`;
  const users = await sql<{ id: string; name: string }[]>`select id, name from users order by name`;
  const hasMore = rows.length > PAGE;
  const qs = (p: number) => {
    const u = new URLSearchParams();
    if (actor) u.set('actor', actor);
    if (cat) u.set('cat', cat);
    if (p) u.set('page', String(p));
    return u.toString();
  };

  return (
    <div className="page">
      <h2>Activity log</h2>
      <p className="lead">Who signed in, who changed what, and when. Failed sign-ins and locked accounts show up here too.</p>
      <form className="filters" method="get">
        <select className="sel" name="actor" defaultValue={actor}>
          <option value="">Everyone</option>
          {users.map((u) => (
            <option key={u.id} value={u.id}>
              {u.name}
            </option>
          ))}
        </select>
        <select className="sel" name="cat" defaultValue={cat}>
          <option value="">All activity</option>
          {Object.entries(CATEGORIES).map(([k, l]) => (
            <option key={k} value={k}>
              {l}
            </option>
          ))}
        </select>
        <button className="btn">Filter</button>
      </form>
      <table className="log">
        <thead>
          <tr>
            <th>When</th>
            <th>Who</th>
            <th>What</th>
            <th>Details</th>
            <th>IP</th>
          </tr>
        </thead>
        <tbody>
          {rows.slice(0, PAGE).map((r) => (
            <tr key={r.id} className={r.action.includes('failed') || r.action.includes('blocked') ? 'warn' : ''}>
              <td className="nowrap">
                <Time at={r.created_at} />
              </td>
              <td>{r.actor_label ?? 'System'}</td>
              <td>
                <code>{r.action}</code>
                {r.target_type === 'ticket' && r.target_id ? <span className="hint"> #{r.target_id}</span> : null}
              </td>
              <td className="hint">{detailText(r.details)}</td>
              <td className="hint nowrap">{r.ip ?? ''}</td>
            </tr>
          ))}
          {rows.length === 0 && (
            <tr>
              <td colSpan={5} className="hint">
                No activity matches.
              </td>
            </tr>
          )}
        </tbody>
      </table>
      <div className="pager">
        {page > 0 && (
          <Link className="btn" href={`/admin/activity?${qs(page - 1)}`}>
            ← Newer
          </Link>
        )}
        {hasMore && (
          <Link className="btn" href={`/admin/activity?${qs(page + 1)}`}>
            Older →
          </Link>
        )}
      </div>
    </div>
  );
}
