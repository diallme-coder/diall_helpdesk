'use client';

import { useActionState, useState, useTransition } from 'react';
import {
  createUser,
  resetUserPassword,
  setUserActive,
  setUserRole,
  signOutEverywhere,
  unlockUser,
  updateUserDetails,
  type CreateUserState,
  type RowResult,
} from '@/lib/actions/admin';
import CopyButton from './CopyButton';

export function CreateUserForm() {
  const [formKey, setFormKey] = useState(0);
  return <CreateUserInner key={formKey} onAnother={() => setFormKey((k) => k + 1)} />;
}

function CreateUserInner({ onAnother }: { onAnother: () => void }) {
  const [state, action, pending] = useActionState(createUser, {} as CreateUserState);
  if (state.created) {
    const c = state.created;
    const text = `Your helpdesk account\nUsername: ${c.username}\nTemporary password: ${c.password}\nYou'll be asked to choose your own password when you first sign in.`;
    return (
      <div className="card success">
        <h3>Account created for {c.name}</h3>
        <p>Give them these sign-in details. The password is shown only once, and they must change it at first sign-in.</p>
        <div className="creds">
          <div>
            Username: <code>{c.username}</code>
          </div>
          <div>
            Temporary password: <code>{c.password}</code>
          </div>
        </div>
        <div className="dact left">
          <CopyButton text={text} label="Copy sign-in details" />
          <button type="button" className="btn" onClick={onAnother}>
            Add another user
          </button>
        </div>
      </div>
    );
  }
  return (
    <form action={action} className="card form">
      <h3>Add a user</h3>
      <div className="two">
        <label className="fld">
          <span>Full name</span>
          <input name="name" required maxLength={120} />
        </label>
        <label className="fld">
          <span>Username (used to sign in)</span>
          <input name="username" required maxLength={60} pattern="[A-Za-z0-9._@\-]{3,60}" autoComplete="off" />
        </label>
      </div>
      <div className="two">
        <label className="fld">
          <span>Email (optional)</span>
          <input name="email" type="email" maxLength={200} />
        </label>
        <label className="fld">
          <span>Role</span>
          <select name="role" defaultValue="agent">
            <option value="agent">Agent: works tickets</option>
            <option value="admin">Admin: also manages users, workflows, activity log</option>
          </select>
        </label>
      </div>
      <label className="fld">
        <span>Temporary password (leave empty to generate a strong one)</span>
        <input name="password" type="text" minLength={10} maxLength={200} autoComplete="off" />
      </label>
      {state.error && <p className="err">{state.error}</p>}
      <div className="dact">
        <button className="btn pri" disabled={pending}>
          {pending ? 'Creating…' : 'Create user'}
        </button>
      </div>
    </form>
  );
}

type UserRowProps = {
  user: { id: string; name: string; username: string; email: string | null; role: string; active: boolean; locked: boolean };
  isSelf: boolean;
};

export function UserRowActions({ user, isSelf }: UserRowProps) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<RowResult>({});
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(user.name);
  const [email, setEmail] = useState(user.email ?? '');

  const run = (fn: () => Promise<RowResult>, confirmText?: string) => {
    if (confirmText && !window.confirm(confirmText)) return;
    setMsg({});
    start(async () => setMsg(await fn()));
  };

  if (editing) {
    return (
      <div className="rowedit">
        <input className="sel" value={name} onChange={(e) => setName(e.target.value)} maxLength={120} aria-label="Name" />
        <input className="sel" value={email} onChange={(e) => setEmail(e.target.value)} maxLength={200} placeholder="Email" aria-label="Email" />
        <button
          type="button"
          className="btn pri sm"
          disabled={pending}
          onClick={() =>
            run(async () => {
              const r = await updateUserDetails(user.id, name, email);
              if (!r.error) setEditing(false);
              return r;
            })
          }
        >
          Save
        </button>
        <button type="button" className="btn sm" onClick={() => setEditing(false)}>
          Cancel
        </button>
        {msg.error && <span className="err inline">{msg.error}</span>}
      </div>
    );
  }

  return (
    <div className="rowacts">
      <button type="button" className="btn sm" onClick={() => setEditing(true)}>
        Edit
      </button>
      <button
        type="button"
        className="btn sm"
        disabled={pending}
        onClick={() => run(() => resetUserPassword(user.id), `Reset ${user.name}'s password? They'll be signed out and must use the new temporary password.`)}
      >
        Reset password
      </button>
      {!isSelf && (
        <>
          <button type="button" className="btn sm" disabled={pending} onClick={() => run(() => setUserRole(user.id, user.role === 'admin' ? 'agent' : 'admin'))}>
            Make {user.role === 'admin' ? 'agent' : 'admin'}
          </button>
          {user.active ? (
            <button
              type="button"
              className="btn sm dang"
              disabled={pending}
              onClick={() => run(() => setUserActive(user.id, false), `Deactivate ${user.name}? They'll be signed out and their open conversations move to Unassigned.`)}
            >
              Deactivate
            </button>
          ) : (
            <button type="button" className="btn sm" disabled={pending} onClick={() => run(() => setUserActive(user.id, true))}>
              Reactivate
            </button>
          )}
          <button type="button" className="btn sm" disabled={pending} onClick={() => run(() => signOutEverywhere(user.id))}>
            Sign out everywhere
          </button>
        </>
      )}
      {user.locked && (
        <button type="button" className="btn sm" disabled={pending} onClick={() => run(() => unlockUser(user.id))}>
          Unlock
        </button>
      )}
      {msg.password && (
        <span className="newpw">
          New temporary password: <code>{msg.password}</code> <CopyButton text={msg.password} />
        </span>
      )}
      {msg.ok && <span className="ok inline">{msg.ok}</span>}
      {msg.error && <span className="err inline">{msg.error}</span>}
    </div>
  );
}
