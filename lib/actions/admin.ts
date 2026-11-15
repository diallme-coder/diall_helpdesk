'use server';

import { revalidatePath } from 'next/cache';
import { sql } from '@/lib/db';
import { generateTempPassword, hashPassword, passwordProblem, requireAdmin, type User } from '@/lib/auth';
import { audit } from '@/lib/audit';
import { EMAIL_RE, field, USERNAME_RE, UUID_RE } from '@/lib/util';

export type CreateUserState = { error?: string; created?: { name: string; username: string; password: string } };
export type RowResult = { error?: string; password?: string; ok?: string };

const actor = (u: User) => ({ id: u.id, name: u.name });
const refresh = () => revalidatePath('/admin/users');

async function otherActiveAdmins(excludeId: string) {
  const [r] = await sql<{ n: number }[]>`select count(*)::int as n from users where role = 'admin' and active and id <> ${excludeId}`;
  return r.n;
}

async function targetUser(id: string) {
  if (!UUID_RE.test(id)) return null;
  const [u] = await sql<{ id: string; name: string; username: string; role: string; active: boolean }[]>`
    select id, name, username, role, active from users where id = ${id}`;
  return u ?? null;
}

export async function createUser(_prev: CreateUserState, fd: FormData): Promise<CreateUserState> {
  const a = await requireAdmin();
  const name = field(fd, 'name', 120);
  const username = field(fd, 'username', 60).toLowerCase();
  const email = field(fd, 'email', 200).toLowerCase();
  const role = field(fd, 'role', 10) === 'admin' ? 'admin' : 'agent';
  let password = String(fd.get('password') ?? '').trim();

  if (!name) return { error: 'Enter the person’s name.' };
  if (!USERNAME_RE.test(username)) return { error: 'Username: 3–60 characters using letters, numbers, dot, dash, underscore or @.' };
  if (email && !EMAIL_RE.test(email)) return { error: 'That email address doesn’t look right.' };
  if (password) {
    const problem = passwordProblem(password);
    if (problem) return { error: problem };
  } else {
    password = generateTempPassword();
  }

  const [exists] = await sql`select 1 from users where username = ${username}`;
  if (exists) return { error: `The username “${username}” is already taken.` };

  const [row] = await sql<{ id: string }[]>`
    insert into users (name, username, email, password_hash, role, must_change_password)
    values (${name}, ${username}, ${email || null}, ${await hashPassword(password)}, ${role}, true)
    returning id`;
  await audit(actor(a), 'user.created', { type: 'user', id: row.id }, { username, role });
  refresh();
  return { created: { name, username, password } };
}

export async function resetUserPassword(userId: string): Promise<RowResult> {
  const a = await requireAdmin();
  const t = await targetUser(userId);
  if (!t) return { error: 'User not found.' };
  const password = generateTempPassword();
  await sql`update users set password_hash = ${await hashPassword(password)}, must_change_password = true,
            failed_attempts = 0, locked_until = null where id = ${t.id}`;
  await sql`delete from sessions where user_id = ${t.id}`;
  await audit(actor(a), 'user.password_reset', { type: 'user', id: t.id }, { username: t.username });
  refresh();
  return { password };
}

export async function setUserRole(userId: string, role: string): Promise<RowResult> {
  const a = await requireAdmin();
  const t = await targetUser(userId);
  if (!t) return { error: 'User not found.' };
  if (t.id === a.id) return { error: 'You can’t change your own role. Ask another admin.' };
  const next = role === 'admin' ? 'admin' : 'agent';
  if (next === t.role) return {};
  if (next === 'agent' && t.role === 'admin' && (await otherActiveAdmins(t.id)) === 0) return { error: 'Keep at least one active admin.' };
  await sql`update users set role = ${next} where id = ${t.id}`;
  await audit(actor(a), 'user.role_changed', { type: 'user', id: t.id }, { username: t.username, from: t.role, to: next });
  refresh();
  return { ok: `${t.name} is now ${next === 'admin' ? 'an admin' : 'an agent'}.` };
}

export async function setUserActive(userId: string, active: boolean): Promise<RowResult> {
  const a = await requireAdmin();
  const t = await targetUser(userId);
  if (!t) return { error: 'User not found.' };
  if (t.id === a.id) return { error: 'You can’t deactivate your own account.' };
  if (!active && t.role === 'admin' && (await otherActiveAdmins(t.id)) === 0) return { error: 'Keep at least one active admin.' };
  await sql`update users set active = ${active} where id = ${t.id}`;
  let released = 0;
  if (!active) {
    await sql`delete from sessions where user_id = ${t.id}`;
    // Their open conversations go back to Unassigned so nothing is forgotten.
    const rows = await sql`update tickets set assignee_id = null, updated_at = now()
                           where assignee_id = ${t.id} and status <> 'closed' returning id`;
    released = rows.length;
  }
  await audit(actor(a), active ? 'user.reactivated' : 'user.deactivated', { type: 'user', id: t.id }, { username: t.username, released });
  revalidatePath('/', 'layout');
  return { ok: active ? `${t.name} can sign in again.` : `${t.name} is deactivated.${released ? ` ${released} open conversation(s) moved to Unassigned.` : ''}` };
}

export async function unlockUser(userId: string): Promise<RowResult> {
  const a = await requireAdmin();
  const t = await targetUser(userId);
  if (!t) return { error: 'User not found.' };
  await sql`update users set failed_attempts = 0, locked_until = null where id = ${t.id}`;
  await audit(actor(a), 'user.unlocked', { type: 'user', id: t.id }, { username: t.username });
  refresh();
  return { ok: `${t.name} is unlocked.` };
}

export async function signOutEverywhere(userId: string): Promise<RowResult> {
  const a = await requireAdmin();
  const t = await targetUser(userId);
  if (!t) return { error: 'User not found.' };
  const rows = await sql`delete from sessions where user_id = ${t.id} returning id`;
  await audit(actor(a), 'user.sessions_revoked', { type: 'user', id: t.id }, { username: t.username, sessions: rows.length });
  refresh();
  return { ok: `Signed ${t.name} out of ${rows.length} session(s).` };
}

export async function updateUserDetails(userId: string, name: string, email: string): Promise<RowResult> {
  const a = await requireAdmin();
  const t = await targetUser(userId);
  if (!t) return { error: 'User not found.' };
  const n = name.trim().slice(0, 120);
  const e = email.trim().toLowerCase().slice(0, 200);
  if (!n) return { error: 'Name can’t be empty.' };
  if (e && !EMAIL_RE.test(e)) return { error: 'That email address doesn’t look right.' };
  await sql`update users set name = ${n}, email = ${e || null} where id = ${t.id}`;
  await audit(actor(a), 'user.updated', { type: 'user', id: t.id }, { username: t.username, name: n });
  revalidatePath('/', 'layout');
  return { ok: 'Saved.' };
}
