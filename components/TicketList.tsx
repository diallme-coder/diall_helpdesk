import Link from 'next/link';
import { sql } from '@/lib/db';
import type { User } from '@/lib/auth';
import { FOLDERS } from '@/lib/constants';
import Avatar from './Avatar';
import Time from './Time';

export type SearchParams = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? '';

export function listQuery(sp: SearchParams) {
  const folderRaw = one(sp.folder);
  const folder = FOLDERS.some(([k]) => k === folderRaw) ? folderRaw : 'unassigned';
  const tag = one(sp.tag).slice(0, 30);
  const q = one(sp.q).trim().slice(0, 100);
  const p = new URLSearchParams();
  if (tag) p.set('tag', tag);
  else p.set('folder', folder);
  if (q) p.set('q', q);
  return { folder, tag, q, qs: p.toString() };
}

type Row = {
  id: string;
  number: string;
  subject: string;
  customer_name: string;
  status: string;
  priority: string;
  tags: string[];
  updated_at: Date;
  last_preview: string | null;
  last_type: string | null;
  assignee_id: string | null;
  assignee_name: string | null;
};

export default async function TicketList({ user, sp, selected }: { user: User; sp: SearchParams; selected: string | null }) {
  const { folder, tag, q, qs } = listQuery(sp);

  let where = sql`true`;
  if (tag) where = sql`${tag}::text = any(t.tags)`;
  else if (folder === 'unassigned') where = sql`t.status <> 'closed' and t.assignee_id is null`;
  else if (folder === 'mine') where = sql`t.status <> 'closed' and t.assignee_id = ${user.id}`;
  else if (folder === 'assigned') where = sql`t.status <> 'closed' and t.assignee_id is not null`;
  else if (folder === 'pending') where = sql`t.status = 'pending'`;
  else if (folder === 'closed') where = sql`t.status = 'closed'`;

  if (q) {
    const like = '%' + q.replace(/[\\%_]/g, (m) => '\\' + m) + '%';
    const num = /^#?\d{1,12}$/.test(q) ? Number(q.replace('#', '')) : null;
    where = sql`${where} and (t.subject ilike ${like} or t.customer_name ilike ${like}
      or coalesce(t.customer_email, '') ilike ${like} or coalesce(t.last_preview, '') ilike ${like}
      ${num !== null ? sql`or t.number = ${num}` : sql``})`;
  }
  const order =
    folder === 'closed' && !tag
      ? sql`t.updated_at desc`
      : sql`case t.priority when 'urgent' then 0 when 'high' then 1 when 'normal' then 2 else 3 end, t.updated_at desc`;

  const rows = await sql<Row[]>`
    select t.id, t.number, t.subject, t.customer_name, t.status, t.priority, t.tags, t.updated_at,
           t.last_preview, t.last_type, t.assignee_id, u.name as assignee_name
    from tickets t left join users u on u.id = t.assignee_id
    where ${where}
    order by ${order}
    limit 200`;

  const title = tag ? '#' + tag : FOLDERS.find(([k]) => k === folder)?.[1] ?? 'Inbox';

  return (
    <section className="list">
      <div className="lhead">
        <h2>{title}</h2>
        <form action="/inbox" method="get">
          {tag ? <input type="hidden" name="tag" value={tag} /> : <input type="hidden" name="folder" value={folder} />}
          <input className="search" type="search" name="q" defaultValue={q} placeholder="Search tickets, customers, #number" />
        </form>
      </div>
      <div className="rows">
        {rows.length === 0 && (
          <div className="emptysm">{q ? 'No conversations match your search.' : folder === 'mine' ? 'Nothing assigned to you. Nice work.' : 'No conversations here.'}</div>
        )}
        {rows.map((r) => (
          <Link key={r.id} href={`/inbox/${r.id}?${qs}`} className={'row' + (r.id === selected ? ' on' : '')}>
            <div className="top">
              <span className="who">{r.customer_name}</span>
              <span className="when">
                <Time at={r.updated_at} relative />
              </span>
            </div>
            <div className="sub">{r.subject}</div>
            <div className="prev">
              {r.last_type === 'note' ? '📝 ' : r.last_type === 'reply' ? '↩ ' : ''}
              {r.last_preview}
            </div>
            <div className="meta">
              <Avatar name={r.assignee_name} id={r.assignee_id} />
              <span className={'pill st-' + r.status}>{r.status}</span>
              {(r.priority === 'high' || r.priority === 'urgent') && <span className={'pill pr-' + r.priority}>{r.priority}</span>}
              {r.tags.slice(0, 3).map((t) => (
                <span key={t} className="pill tag">
                  {t}
                </span>
              ))}
              <span className="pill">#{r.number}</span>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
