'use client';

import { useActionState } from 'react';
import { newTicket, type Result } from '@/lib/actions/tickets';

export default function NewTicketForm() {
  const [state, action, pending] = useActionState(newTicket, {} as Result);
  return (
    <form action={action} className="card form">
      <div className="two">
        <label className="fld">
          <span>Customer name</span>
          <input name="customerName" required maxLength={120} autoFocus />
        </label>
        <label className="fld">
          <span>Customer email (optional)</span>
          <input name="customerEmail" type="email" maxLength={200} />
        </label>
      </div>
      <label className="fld">
        <span>Subject</span>
        <input name="subject" required maxLength={200} />
      </label>
      <label className="fld">
        <span>What the customer said</span>
        <textarea name="body" required maxLength={20000} rows={7} />
      </label>
      <div className="two">
        <label className="fld">
          <span>Priority</span>
          <select name="priority" defaultValue="normal">
            <option value="low">Low</option>
            <option value="normal">Normal</option>
            <option value="high">High</option>
            <option value="urgent">Urgent</option>
          </select>
        </label>
        <label className="fld">
          <span>Attachments (up to 5 files, 4 MB total)</span>
          <input name="files" type="file" multiple />
        </label>
      </div>
      {state.error && <p className="err">{state.error}</p>}
      <div className="dact">
        <button className="btn pri" disabled={pending}>
          {pending ? 'Creating…' : 'Create conversation'}
        </button>
      </div>
    </form>
  );
}
