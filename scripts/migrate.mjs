// Creates or updates the database tables. Runs automatically before every build.
import postgres from 'postgres';
import { readFileSync } from 'node:fs';
import { loadEnv, sslOption } from './env.mjs';

loadEnv();
if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL is not set. Add it to .env.local (local) or your Vercel project settings.');
  process.exit(1);
}

const sql = postgres(process.env.DATABASE_URL, { ssl: sslOption(), max: 1, onnotice: () => {} });
try {
  await sql.unsafe(readFileSync(new URL('../db/schema.sql', import.meta.url), 'utf8'));
  console.log('Database schema is up to date.');
} catch (err) {
  console.error('Migration failed:', err.message);
  process.exitCode = 1;
} finally {
  await sql.end();
}
