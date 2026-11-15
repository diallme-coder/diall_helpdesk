import { headers } from 'next/headers';
import { createHash, randomBytes } from 'crypto';

export const sha256 = (s: string) => createHash('sha256').update(s).digest('hex');
export const randomToken = (bytes = 24) => randomBytes(bytes).toString('base64url');

export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const USERNAME_RE = /^[a-z0-9._@-]{3,60}$/;
export const TOKEN_RE = /^[A-Za-z0-9_-]{20,64}$/;

/** A trimmed string field from a form, capped at max characters. */
export function field(fd: FormData, key: string, max = 1000): string {
  const v = fd.get(key);
  return typeof v === 'string' ? v.trim().slice(0, max) : '';
}

export function normalizeTag(s: string) {
  return s
    .toLowerCase()
    .replace(/^#/, '')
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 30);
}

export const preview = (body: string) => body.replace(/\s+/g, ' ').trim().slice(0, 140);

function ipFrom(h: Headers) {
  return (h.get('x-forwarded-for') || '').split(',')[0].trim() || h.get('x-real-ip') || null;
}

export async function clientIp() {
  return ipFrom(await headers());
}

export function ipFromRequest(req: Request) {
  return ipFrom(req.headers);
}

/** Rejects cross-site POSTs to route handlers. Server actions get the same check from Next.js. */
export function sameOrigin(req: Request) {
  const origin = req.headers.get('origin');
  const host = req.headers.get('x-forwarded-host') || req.headers.get('host');
  if (!origin || !host) return false;
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

export async function appOrigin() {
  if (process.env.APP_URL) return process.env.APP_URL.replace(/\/+$/, '');
  const h = await headers();
  const host = h.get('x-forwarded-host') || h.get('host') || 'localhost:3000';
  const proto = h.get('x-forwarded-proto') || (host.startsWith('localhost') ? 'http' : 'https');
  return `${proto}://${host}`;
}
