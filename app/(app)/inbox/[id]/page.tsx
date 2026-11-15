import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireUser } from '@/lib/auth';
import { sql } from '@/lib/db';
import { appOrigin, UUID_RE } from '@/lib/util';
import { formatBytes } from '@/lib/constants';
import TicketList, { listQuery, type SearchParams } from '@/components/TicketList';
import TicketControls from '@/components/TicketControls';
import Composer from '@/components/Composer';
import Presence from '@/components/Presence';
import ThreadScroll from '@/components/ThreadScroll';
import AutoRefresh from '@/components/AutoRefresh';
import CopyButton from '@/components/CopyButton';
import Avatar from '@/components/Avatar';
import Time from '@/components/Time';

type Ticket = {
  id: string;
  number: string;
  subject: string;
  customer_name: string;
  customer_email: string | null;
  status: string;
  priority: string;
  assignee_id: string | null;
  tags: string[];
  source: string;
  portal_token: string;
  created_at: Date;
};
type Msg = { id: string; type: string; body: string; created_at: Date; author_id: string | null; author_name: string | null };
type Att = { id: string; message_id: string; filename: string; size: number };

export default async function ConversationPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<SearchParams> }) {
  const user = await requireUser();
  const { id } = await params;
  const sp = await searchParams;
  if (!UUID_RE.test(id)) notFound();

  const [t] = await sql<Ticket[]>`
    select id, number, subject, customer_name, customer_email, status, priority, assignee_id, tags, source, portal_token, created_at
    from tickets where id = ${id}`;
  if (!t) notFound();

  const [msgs, atts, users, saved, allTags, origin] = await Promise.all([
    sql<Msg[]>`select m.id, m.type, m.body, m.created_at, m.author_id, u.name as author_name
               from messages m left join users u on u.id = m.author_id
               where m.ticket_id = ${id} order by m.created_at, m.id`,
    sql<Att[]>`select id, message_id, filename, size from attachments where ticket_id = ${id} order by created_at`,
    sql<{ id: string; name: string }[]>`select id, name from users where active order by name`,
    sql<{ id: string; title: string; body: string }[]>`select id, title, body from saved_replies order by title`,
    sql<{ tag: string }[]>`select distinct unnest(tags) as tag from tickets order by 1 limit 200`,
    appOrigin(),
  ]);

  const filesByMessage = new Map<string, Att[]>();
  for (const a of atts) filesByMessage.set(a.message_id, [...(filesByMessage.get(a.message_id) ?? []), a]);
  const portalUrl = `${origin}/t/${t.portal_token}`;
  const number = Number(t.number);

  return (
    <div className="inbox">
      <TicketList user={user} sp={sp} selected={id} />
      <main className="conv">
        <div className="convhead">
          <Link className="btn back" href={`/inbox?${listQuery(sp).qs}`}>
            ← Back
          </Link>
          <h1 className="subj">
            {t.subject} <small>#{number}</small>
          </h1>
          <div className="cust">
            {t.customer_name}
            {t.customer_email && <> &lt;{t.customer_email}&gt;</>} · opened <Time at={t.created_at} /> ·{' '}
            {t.source === 'contact_form' ? 'via contact form' : 'logged by the team'}
          </div>
          <div className="custlink">
            <span>Customer’s ticket page:</span>
            <code>{portalUrl}</code>
            <CopyButton text={portalUrl} label="Copy link" />
          </div>
          <Presence ticketId={t.id} />
          <TicketControls
            ticketId={t.id}
            ticketNumber={number}
            status={t.status}
            priority={t.priority}
            assigneeId={t.assignee_id}
            tags={t.tags}
            users={[...users]}
            allTags={allTags.map((r) => r.tag)}
            meId={user.id}
            isAdmin={user.role === 'admin'}
          />
        </div>
        <ThreadScroll count={msgs.length} ticketId={t.id}>
          {msgs.map((m) =>
            m.type === 'event' ? (
              <div key={m.id} className="msg event">
                {m.body} · <Time at={m.created_at} relative />
              </div>
            ) : (
              <div key={m.id} className={'msg ' + m.type}>
                <div className="mh">
                  {m.type === 'customer' ? <Avatar name={t.customer_name} large /> : <Avatar name={m.author_name ?? 'Former teammate'} id={m.author_id} large />}
                  <b>{m.type === 'customer' ? t.customer_name : m.author_name ?? 'Former teammate'}</b>
                  <span>
                    {m.type === 'note' ? 'added an internal note' : m.type === 'reply' ? 'replied' : 'wrote'} · <Time at={m.created_at} />
                  </span>
                </div>
                <div className="mb">{m.body}</div>
                {(filesByMessage.get(m.id) ?? []).length > 0 && (
                  <div className="files">
                    {(filesByMessage.get(m.id) ?? []).map((a) => (
                      <a key={a.id} className="file" href={`/api/attachments/${a.id}`} target="_blank" rel="noopener">
                        📎 {a.filename} <span>{formatBytes(a.size)}</span>
                      </a>
                    ))}
                  </div>
                )}
              </div>
            )
          )}
        </ThreadScroll>
        <Composer ticketId={t.id} ticketNumber={number} customerName={t.customer_name} agentName={user.name} saved={[...saved]} />
      </main>
      <AutoRefresh seconds={15} />
    </div>
  );
}
