'use client';

import { useActionState } from 'react';
import { changePassword, createFirstAdmin, login, type FormState } from '@/lib/actions/auth';

const initial: FormState = {};

export function LoginForm() {
  const [state, action, pending] = useActionState(login, initial);
  return (
    <form action={action}>
      <label className="fld">
        <span>Username</span>
        <input name="username" autoComplete="username" required autoFocus maxLength={60} />
      </label>
      <label className="fld">
        <span>Password</span>
        <input name="password" type="password" autoComplete="current-password" required maxLength={200} />
      </label>
      {state.error && <p className="err">{state.error}</p>}
      <button className="btn pri wide" disabled={pending}>
        {pending ? 'Signing in…' : 'Sign in'}
      </button>
      <p className="hint center">Forgot your password? Ask your helpdesk admin to reset it.</p>
    </form>
  );
}

export function SetupForm() {
  const [state, action, pending] = useActionState(createFirstAdmin, initial);
  return (
    <form action={action}>
      <label className="fld">
        <span>Setup code (the SETUP_TOKEN server setting)</span>
        <input name="setupToken" type="password" required autoComplete="off" />
      </label>
      <label className="fld">
        <span>Your name</span>
        <input name="name" required maxLength={120} />
      </label>
      <div className="two">
        <label className="fld">
          <span>Username</span>
          <input name="username" required maxLength={60} autoComplete="username" />
        </label>
        <label className="fld">
          <span>Email (optional)</span>
          <input name="email" type="email" maxLength={200} />
        </label>
      </div>
      <div className="two">
        <label className="fld">
          <span>Password</span>
          <input name="password" type="password" required minLength={10} autoComplete="new-password" />
        </label>
        <label className="fld">
          <span>Confirm password</span>
          <input name="confirm" type="password" required minLength={10} autoComplete="new-password" />
        </label>
      </div>
      <p className="hint">At least 10 characters, with letters and numbers.</p>
      {state.error && <p className="err">{state.error}</p>}
      <button className="btn pri wide" disabled={pending}>
        {pending ? 'Creating…' : 'Create admin account'}
      </button>
    </form>
  );
}

export function ChangePasswordForm({ forced }: { forced: boolean }) {
  const [state, action, pending] = useActionState(changePassword, initial);
  return (
    <form action={action}>
      {forced && <p className="notice">Your admin gave you a temporary password. Choose your own to continue.</p>}
      <label className="fld">
        <span>{forced ? 'Temporary password' : 'Current password'}</span>
        <input name="current" type="password" required autoComplete="current-password" autoFocus />
      </label>
      <label className="fld">
        <span>New password</span>
        <input name="password" type="password" required minLength={10} autoComplete="new-password" />
      </label>
      <label className="fld">
        <span>Confirm new password</span>
        <input name="confirm" type="password" required minLength={10} autoComplete="new-password" />
      </label>
      <p className="hint">At least 10 characters, with letters and numbers. You’ll be signed out on your other devices.</p>
      {state.error && <p className="err">{state.error}</p>}
      <button className="btn pri wide" disabled={pending}>
        {pending ? 'Saving…' : 'Save new password'}
      </button>
    </form>
  );
}
