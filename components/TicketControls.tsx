'use client';

import { useState, useTransition } from 'react';
import { addTag, deleteTicket, removeTag, updateTicket } from '@/lib/actions/tickets';
import { label, PRIORITIES, STATUSES } from '@/lib/constants';

type Props = {
  ticketId: string;
  ticketNumber: number;
  status: string;
  priority: string;
  assigneeId: string | null;
  tags: string[];
  users: { id: string; name: string }[];
  allTags: string[];
  meId: string;
  isAdmin: boolean;
};

export default function TicketControls(p: Props) {
  const [pending, start] = useTransition();
  const [error, setError] = useState('');
  const [tag, setTag] = useState('');

  function run(fn: (fd: FormData) => Promise<{ error?: string }>, entries: Record<string, string>) {
    setError('');
    const fd = new FormData();
    fd.set('ticketId', p.ticketId);
    for (const [k, v] of Object.entries(entries)) fd.set(k, v);
    start(async () => {
      const r = await fn(fd);
      if (r?.error) setError(r.error);
    });
  }
  const change = (field: string, value: string) => run(updateTicket, { field, value });

  return (
    <div className={'tools' + (pending ? ' busy' : '')}>
      <label>
        Assignee
        <select key={'a' + p.assigneeId} className="sel" defaultValue={p.assigneeId ?? ''} onChange={(e) => change('assignee', e.target.value)}>
          <option value="">Unassigned</option>
          {p.users.map((u) => (
            <option key={u.id} value={u.id}>
              {u.name}
              {u.id === p.meId ? ' (you)' : ''}
            </option>
          ))}
        </select>
      </label>
      {p.assigneeId !== p.meId && (
        <button type="button" className="btn" onClick={() => change('assignee', p.meId)}>
          Assign to me
        </button>
      )}
      <label>
        Status
        <select key={'s' + p.status} className="sel" defaultValue={p.status} onChange={(e) => change('status', e.target.value)}>
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {label(s)}
            </option>
          ))}
        </select>
      </label>
      <label>
        Priority
        <select key={'p' + p.priority} className="sel" defaultValue={p.priority} onChange={(e) => change('priority', e.target.value)}>
          {PRIORITIES.map((s) => (
            <option key={s} value={s}>
              {label(s)}
            </option>
          ))}
        </select>
      </label>
      {p.tags.map((t) => (
        <span key={t} className="pill tag">
          #{t}
          <button type="button" className="chipx" title="Remove tag" onClick={() => run(removeTag, { tag: t })}>
            ×
          </button>
        </span>
      ))}
      <form
        className="tagform"
        onSubmit={(e) => {
          e.preventDefault();
          if (!tag.trim()) return;
          run(addTag, { tag });
          setTag('');
        }}
      >
        <input className="sel" list="all-tags" value={tag} onChange={(e) => setTag(e.target.value)} placeholder="+ tag" maxLength={30} />
        <datalist id="all-tags">
          {p.allTags.map((t) => (
            <option key={t} value={t} />
          ))}
        </datalist>
      </form>
      {p.isAdmin && (
        <button
          type="button"
          className="btn dang"
          onClick={() => {
            if (window.confirm(`Delete conversation #${p.ticketNumber} for everyone? Its messages and files can’t be recovered.`)) run(deleteTicket, {});
          }}
        >
          Delete
        </button>
      )}
      {error && <span className="err inline">{error}</span>}
    </div>
  );
}
