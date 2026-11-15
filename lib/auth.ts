import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { cache } from 'react';
import { scrypt, randomBytes, timingSafeEqual } from 'crypto';
import { sql } from './db';
import { sha256, randomToken } from './util';

export type Role = 'admin' | 'agent';
export type User = {
  id: string;
  name: string;
  username: string;
  email: string | null;
  role: Role;
  must_change_password: boolean;
};

export const SESSION_COOKIE = 'hd_session';
const SESSION_DAYS = 7;
const PARAMS = { N: 16384, r: 8, p: 1 };
const MAXMEM = 64 * 1024 * 1024;

function derive(pw: string, salt: Buffer, len: number, o: { N: number; r: number; p: number }) {
  return new Promise<Buffer>((resolve, reject) =>
    scrypt(pw.normalize('NFKC'), salt, len, { ...o, maxmem: MAXMEM }, (err, key) => (err ? reject(err) : resolve(key)))
  );
}

export async function hashPassword(pw: string) {
  const salt = randomBytes(16);
  const key = await derive(pw, salt, 64, PARAMS);
  return ['scrypt', PARAMS.N, PARAMS.r, PARAMS.p, salt.toString('base64'), key.toString('base64')].join('$');
}

export async function verifyPassword(pw: string, stored: string) {
  const parts = stored.split('$');
  if (parts.length !== 6 || parts[0] !== 'scrypt') return false;
  const key = Buffer.from(parts[5], 'base64');
  const got = await derive(pw, Buffer.from(parts[4], 'base64'), key.length, {
    N: Number(parts[1]),
    r: Number(parts[2]),
    p: Number(parts[3]),
  });
  return got.length === key.length && timingSafeEqual(got, key);
}

let dummy: Promise<string> | null = null;
/** A throwaway hash, so a login for an unknown username takes as long as a real one. */
export function dummyHash() {
  return (dummy ??= hashPassword(randomToken(12)));
}

export function passwordProblem(pw: string): string | null {
  if (pw.length < 10) return 'Use at least 10 characters.';
  if (pw.length > 200) return 'Use at most 200 characters.';
  if (!/[A-Za-z]/.test(pw) || !/[0-9]/.test(pw)) return 'Use both letters and numbers.';
  return null;
}

/** e.g. "kPxa-7Rmq-Tz3w": easy to read aloud, letters and digits. */
export function generateTempPassword() {
  const letters = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz';
  const digits = '23456789';
  const b = randomBytes(12);
  let s = '';
  for (let i = 0; i < 12; i++) s += i % 4 === 3 ? digits[b[i] % digits.length] : letters[b[i] % letters.length];
  return `${s.slice(0, 4)}-${s.slice(4, 8)}-${s.slice(8)}`;
}

export async function createSession(userId: string) {
  const token = randomToken(32);
  const h = await headers();
  const ip = (h.get('x-forwarded-for') || '').split(',')[0].trim() || null;
  await sql`
    insert into sessions (id, user_id, expires_at, ip, user_agent)
    values (${sha256(token)}, ${userId}, now() + ${SESSION_DAYS + ' days'}::interval, ${ip}, ${(h.get('user-agent') || '').slice(0, 300)})`;
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_DAYS * 86400,
  });
  await sql`delete from sessions where expires_at < now()`;
}

export async function currentSessionId() {
  const t = (await cookies()).get(SESSION_COOKIE)?.value;
  return t ? sha256(t) : null;
}

export async function destroySession() {
  const jar = await cookies();
  const t = jar.get(SESSION_COOKIE)?.value;
  if (t) await sql`delete from sessions where id = ${sha256(t)}`;
  jar.delete(SESSION_COOKIE);
}

export const getUser = cache(async (): Promise<User | null> => {
  const t = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!t || t.length > 100) return null;
  const rows = await sql<User[]>`
    select u.id, u.name, u.username, u.email, u.role, u.must_change_password
    from sessions s join users u on u.id = s.user_id
    where s.id = ${sha256(t)} and s.expires_at > now() and u.active`;
  return rows[0] ?? null;
});

/** Signed-in user, or a redirect to /login. Users with a temporary password are sent to change it. */
export async function requireUser(opts: { allowPasswordChange?: boolean } = {}): Promise<User> {
  const u = await getUser();
  if (!u) redirect('/login');
  if (u.must_change_password && !opts.allowPasswordChange) redirect('/change-password');
  return u;
}

export async function requireAdmin(): Promise<User> {
  const u = await requireUser();
  if (u.role !== 'admin') redirect('/inbox');
  return u;
}
