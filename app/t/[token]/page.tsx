import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { dbConfigured, sql } from '@/lib/db';
import { APP_NAME, formatBytes } from '@/lib/constants';
import { appOrigin, TOKEN_RE } from '@/lib/util';
import { PortalReplyForm } from '@/components/PublicForms';
import CopyButton from '@/components/CopyButton';
import Time from '@/components/Time';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: `Your request · ${APP_NAME}`, robots: { index: false, follow: false } };

const STATUS_TEXT: Record<string, string> = {
  active: 'Open: our team is working on it',
  pending: 'Waiting for your reply',
  closed: 'Resolved. Reply below if you still need help.',
};

export default async function PortalPage({ params, searchParams }: { params: Promise<{ token: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { token } = await params;
  const sp = await searchParams;
  if (!dbConfigured || !TOKEN_RE.test(token)) notFound();
  const [t] = await sql<{ id: string; number: string; subject: string; customer_name: string; status: string; created_at: Date }[]>`
    select id, number, subject, customer_name, status, created_at from tickets where portal_token = ${token}`;
  if (!t) notFound();

  // Customers see their own messages and the team's replies, never internal notes or events.
  const msgs = await sql<{ id: string; type: string; body: string; created_at: Date; author_name: string | null }[]>`
    select m.id, m.type, m.body, m.created_at, u.name as author_name
    from messages m left join users u on u.id = m.author_id
    where m.ticket_id = ${t.id} and m.type in ('customer', 'reply')
    order by m.created_at, m.id`;
  const atts = await sql<{ id: string; message_id: string; filename: string; size: number }[]>`
    select a.id, a.message_id, a.filename, a.size from attachments a
    join messages m on m.id = a.message_id
    where a.ticket_id = ${t.id} and m.type in ('customer', 'reply')`;
  const url = `${await appOrigin()}/t/${token}`;

  return (
    <div className="portal">
      <div className="portalcard">
        <div className="brand dark">
          <i />
          {APP_NAME}
        </div>
        {sp.new && (
          <div className="notice">
            <b>We received your request.</b> Bookmark this page or copy its link: it’s how you follow up and see our replies.
            <div className="custlink">
              <code>{url}</code>
              <CopyButton text={url} label="Copy link" />
            </div>
          </div>
        )}
        <h1 className="subj">
          {t.subject} <small>#{Number(t.number)}</small>
        </h1>
        <p className={'pill big st-' + t.status}>{STATUS_TEXT[t.status]}</p>
        <div className="pthread">
          {msgs.map((m) => (
            <div key={m.id} className={'msg ' + (m.type === 'reply' ? 'reply' : 'customer')}>
              <div className="mh">
                <b>{m.type === 'reply' ? `${(m.author_name ?? 'Support').split(/\s+/)[0]} from ${APP_NAME}` : 'You'}</b>
                <span>
                  · <Time at={m.created_at} />
                </span>
              </div>
              <div className="mb">{m.body}</div>
              {atts.filter((a) => a.message_id === m.id).length > 0 && (
                <div className="files">
                  {atts
                    .filter((a) => a.message_id === m.id)
                    .map((a) => (
                      <a key={a.id} className="file" href={`/api/attachments/${a.id}?t=${token}`} target="_blank" rel="noopener">
                        📎 {a.filename} <span>{formatBytes(a.size)}</span>
                      </a>
                    ))}
                </div>
              )}
            </div>
          ))}
        </div>
        <PortalReplyForm token={token} />
        <p className="hint center">Keep this link private: anyone who has it can read this conversation.</p>
      </div>
    </div>
  );
}
