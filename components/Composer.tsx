'use client';

import { useRef, useState, useTransition } from 'react';
import { addMessage } from '@/lib/actions/tickets';
import { MAX_FILES } from '@/lib/constants';

type Saved = { id: string; title: string; body: string };
type Tab = 'reply' | 'note' | 'customer';

const PLACEHOLDER: Record<Tab, string> = {
  reply: 'Write a reply to the customer. They see it on their ticket page.  (Ctrl/⌘ + Enter to send)',
  note: 'Internal note. Only your team sees this.',
  customer: 'Paste a message the customer sent by email, phone or chat…',
};
const BUTTON: Record<Tab, string> = { reply: 'Send reply', note: 'Add note', customer: 'Log message' };

export default function Composer({
  ticketId,
  ticketNumber,
  customerName,
  agentName,
  saved,
}: {
  ticketId: string;
  ticketNumber: number;
  customerName: string;
  agentName: string;
  saved: Saved[];
}) {
  const [tab, setTab] = useState<Tab>('reply');
  const [after, setAfter] = useState('pending');
  const [error, setError] = useState('');
  const [flash, setFlash] = useState('');
  const [pending, start] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);
  const textRef = useRef<HTMLTextAreaElement>(null);
  const lastTyping = useRef(0);

  function onInput() {
    if (tab !== 'reply') return;
    const now = Date.now();
    if (now - lastTyping.current > 3000) {
      lastTyping.current = now;
      window.dispatchEvent(new Event('hd-typing'));
    }
  }

  function insertSaved(id: string) {
    const r = saved.find((s) => s.id === id);
    const ta = textRef.current;
    if (!r || !ta) return;
    const first = (customerName || 'there').split(/\s+/)[0];
    const text = r.body
      .replace(/\{\{\s*first_name\s*\}\}/g, first)
      .replace(/\{\{\s*customer\s*\}\}/g, customerName)
      .replace(/\{\{\s*agent\s*\}\}/g, agentName)
      .replace(/\{\{\s*number\s*\}\}/g, '#' + ticketNumber);
    ta.value = ta.value ? ta.value.replace(/\s*$/, '\n\n') + text : text;
    ta.focus();
  }

  function submit(fd: FormData) {
    setError('');
    fd.set('ticketId', ticketId);
    fd.set('type', tab);
    fd.set('statusAfter', after);
    start(async () => {
      const r = await addMessage(fd);
      if (r?.error) {
        setError(r.error);
        return;
      }
      formRef.current?.reset();
      setFlash(tab === 'reply' ? `Reply sent. Status set to ${after}.` : tab === 'note' ? 'Note added.' : 'Customer message logged.');
      setTimeout(() => setFlash(''), 3000);
    });
  }

  return (
    <form ref={formRef} action={submit} className="composer">
      <div className="tabs">
        {(['reply', 'note', 'customer'] as Tab[]).map((t) => (
          <button key={t} type="button" className={(tab === t ? 'on' : '') + (t === 'note' ? ' n' : '')} onClick={() => setTab(t)}>
            {t === 'reply' ? 'Reply' : t === 'note' ? 'Note' : 'Log customer message'}
          </button>
        ))}
      </div>
      <textarea
        ref={textRef}
        name="body"
        required
        maxLength={20000}
        className={tab === 'note' ? 'n' : ''}
        placeholder={PLACEHOLDER[tab]}
        onInput={onInput}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
            e.preventDefault();
            formRef.current?.requestSubmit();
          }
        }}
      />
      <div className="crow">
        {tab !== 'customer' && saved.length > 0 && (
          <select
            className="sel"
            value=""
            onChange={(e) => {
              insertSaved(e.target.value);
              e.target.value = '';
            }}
          >
            <option value="">Insert saved reply…</option>
            {saved.map((s) => (
              <option key={s.id} value={s.id}>
                {s.title}
              </option>
            ))}
          </select>
        )}
        <label className="filebtn" title={`Up to ${MAX_FILES} files, 4 MB in total`}>
          📎 Attach
          <input type="file" name="files" multiple />
        </label>
        <span className="sp" />
        {error && <span className="err inline">{error}</span>}
        {flash && <span className="ok inline">{flash}</span>}
        {tab === 'reply' && (
          <label className="hint">
            Then set status{' '}
            <select className="sel" value={after} onChange={(e) => setAfter(e.target.value)}>
              <option value="pending">Pending</option>
              <option value="active">Active</option>
              <option value="closed">Closed</option>
            </select>
          </label>
        )}
        <button className="btn pri" disabled={pending}>
          {pending ? 'Saving…' : BUTTON[tab]}
        </button>
      </div>
    </form>
  );
}
