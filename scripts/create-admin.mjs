// Creates an admin account, or resets an existing account to admin with a new password.
// Use it for the first admin, or to recover access if every admin is locked out.
//
//   npm run create-admin -- <username> "<Full Name>" "<password>"
//
import postgres from 'postgres';
import { scrypt, randomBytes } from 'node:crypto';
import { loadEnv, sslOption } from './env.mjs';

loadEnv();
const [username, name, password] = process.argv.slice(2);
if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL is not set.');
  process.exit(1);
}
if (!username || !name || !password) {
  console.error('Usage: npm run create-admin -- <username> "<Full Name>" "<password>"');
  process.exit(1);
}
const user = username.trim().toLowerCase();
if (!/^[a-z0-9._@-]{3,60}$/.test(user)) {
  console.error('Username: 3-60 characters, letters, numbers, dot, dash, underscore or @.');
  process.exit(1);
}
if (password.length < 10 || !/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) {
  console.error('Password: at least 10 characters with letters and numbers.');
  process.exit(1);
}

// Must match lib/auth.ts
const salt = randomBytes(16);
const key = await new Promise((res, rej) =>
  scrypt(password.normalize('NFKC'), salt, 64, { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 }, (e, k) => (e ? rej(e) : res(k)))
);
const hash = ['scrypt', 16384, 8, 1, salt.toString('base64'), key.toString('base64')].join('$');

const sql = postgres(process.env.DATABASE_URL, { ssl: sslOption(), max: 1, onnotice: () => {} });
try {
  const [row] = await sql`
    insert into users (name, username, password_hash, role, must_change_password)
    values (${name.trim()}, ${user}, ${hash}, 'admin', false)
    on conflict (username) do update set
      name = excluded.name, password_hash = excluded.password_hash, role = 'admin', active = true,
      must_change_password = false, failed_attempts = 0, locked_until = null
    returning id, (xmax = 0) as inserted`;
  await sql`delete from sessions where user_id = ${row.id}`;
  await sql`insert into activity_log (actor_label, action, target_type, target_id, details)
            values ('command line', ${row.inserted ? 'user.created' : 'user.admin_reset'}, 'user', ${row.id}, ${sql.json({ username: user, role: 'admin' })})`;
  console.log(`${row.inserted ? 'Created' : 'Reset'} admin "${user}". Sign in at /login.`);
} catch (err) {
  console.error('Failed:', err.message);
  process.exitCode = 1;
} finally {
  await sql.end();
}
