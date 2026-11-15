'use server';

import { redirect } from 'next/navigation';
import { sql } from '@/lib/db';
import {
  createSession,
  currentSessionId,
  destroySession,
  dummyHash,
  getUser,
  hashPassword,
  passwordProblem,
  requireUser,
  verifyPassword,
} from '@/lib/auth';
import { audit } from '@/lib/audit';
import { allow } from '@/lib/ratelimit';
import { clientIp, EMAIL_RE, field, USERNAME_RE } from '@/lib/util';
import { timingSafeEqual } from 'crypto';

export type FormState = { error?: string };

const MAX_FAILED = 5;
const LOCK_MINUTES = 15;

export async function login(_prev: FormState, fd: FormData): Promise<FormState> {
  const username = field(fd, 'username', 60).toLowerCase();
  const password = typeof fd.get('password') === 'string' ? String(fd.get('password')).slice(0, 200) : '';
  if (!username || !password) return { error: 'Enter your username and password.' };

  const ip = (await clientIp()) ?? 'unknown';
  if (!(await allow(`login-ip:${ip}`, 30, 15 * 60))) {
    return { error: 'Too many sign-in attempts from this network. Wait 15 minutes and try again.' };
  }

  const [u] = await sql<
    { id: string; name: string; password_hash: string; active: boolean; locked: boolean; failed_attempts: number }[]
  >`select id, name, password_hash, active, coalesce(locked_until > now(), false) as locked, failed_attempts
    from users where username = ${username}`;

  if (u?.locked) {
    await audit(null, 'auth.login_blocked', { type: 'user', id: u.id }, { username, reason: 'locked' }, username);
    return { error: `This account is locked after too many failed attempts. Try again in ${LOCK_MINUTES} minutes or ask an admin to unlock it.` };
  }

  const ok = u ? await verifyPassword(password, u.password_hash) : (await verifyPassword(password, await dummyHash()), false);

  if (!u || !ok || !u.active) {
    if (u && !ok) {
      await sql`
        update users set failed_attempts = failed_attempts + 1,
          locked_until = case when failed_attempts + 1 >= ${MAX_FAILED} then now() + ${LOCK_MINUTES + ' minutes'}::interval else locked_until end
        where id = ${u.id}`;
    }
    await audit(null, 'auth.login_failed', u ? { type: 'user', id: u.id } : undefined, { username, reason: !u ? 'unknown_user' : !ok ? 'wrong_password' : 'deactivated' }, username);
    return { error: 'Wrong username or password.' };
  }

  await sql`update users set failed_attempts = 0, locked_until = null, last_login_at = now() where id = ${u.id}`;
  await createSession(u.id);
  await audit({ id: u.id, name: u.name }, 'auth.login', { type: 'user', id: u.id });
  redirect('/inbox');
}

export async function logout() {
  const u = await getUser();
  await destroySession();
  if (u) await audit({ id: u.id, name: u.name }, 'auth.logout', { type: 'user', id: u.id });
  redirect('/login');
}

function tokenMatches(given: string, expected: string) {
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function createFirstAdmin(_prev: FormState, fd: FormData): Promise<FormState> {
  const setupToken = process.env.SETUP_TOKEN;
  if (!setupToken || setupToken.length < 12) return { error: 'Setup is turned off. Set SETUP_TOKEN (12+ characters) in the server settings, or use the create-admin command.' };

  const ip = (await clientIp()) ?? 'unknown';
  if (!(await allow(`setup:${ip}`, 10, 15 * 60))) return { error: 'Too many attempts. Wait 15 minutes.' };
  if (!tokenMatches(field(fd, 'setupToken', 200), setupToken)) return { error: 'That setup code is not correct.' };

  const name = field(fd, 'name', 120);
  const username = field(fd, 'username', 60).toLowerCase();
  const email = field(fd, 'email', 200).toLowerCase();
  const password = String(fd.get('password') ?? '');
  if (!name) return { error: 'Enter your name.' };
  if (!USERNAME_RE.test(username)) return { error: 'Username: 3–60 characters using letters, numbers, dot, dash, underscore or @.' };
  if (email && !EMAIL_RE.test(email)) return { error: 'That email address doesn’t look right.' };
  const problem = passwordProblem(password);
  if (problem) return { error: problem };
  if (password !== String(fd.get('confirm') ?? '')) return { error: 'The two passwords don’t match.' };

  const hash = await hashPassword(password);
  const [row] = await sql<{ id: string }[]>`
    insert into users (name, username, email, password_hash, role, must_change_password)
    select ${name}, ${username}, ${email || null}, ${hash}, 'admin', false
    where not exists (select 1 from users)
    returning id`;
  if (!row) redirect('/login');

  await audit({ id: row.id, name }, 'user.created', { type: 'user', id: row.id }, { username, role: 'admin', via: 'setup' });
  await createSession(row.id);
  redirect('/inbox');
}

export async function changePassword(_prev: FormState, fd: FormData): Promise<FormState> {
  const u = await requireUser({ allowPasswordChange: true });
  const current = String(fd.get('current') ?? '');
  const next = String(fd.get('password') ?? '');
  const [row] = await sql<{ password_hash: string }[]>`select password_hash from users where id = ${u.id}`;
  if (!row || !(await verifyPassword(current, row.password_hash))) return { error: 'Your current password is not correct.' };
  const problem = passwordProblem(next);
  if (problem) return { error: problem };
  if (next !== String(fd.get('confirm') ?? '')) return { error: 'The two new passwords don’t match.' };
  if (next === current) return { error: 'Choose a password different from the current one.' };

  await sql`update users set password_hash = ${await hashPassword(next)}, must_change_password = false where id = ${u.id}`;
  const sid = await currentSessionId();
  await sql`delete from sessions where user_id = ${u.id} and id <> ${sid ?? ''}`;
  await audit({ id: u.id, name: u.name }, 'auth.password_changed', { type: 'user', id: u.id });
  redirect('/inbox');
}
