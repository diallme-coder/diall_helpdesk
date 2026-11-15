// Creates or updates the database tables. Runs automatically before every build.
// Pass --optional (as the build does) to skip with a warning instead of failing
// when the database isn't connected yet, so the app can still deploy.
import { readFileSync } from 'node:fs';
import { databaseUrl, loadEnv, sslOption } from './env.mjs';

loadEnv();
const optional = process.argv.includes('--optional');

function stop(message) {
  if (optional) {
    console.warn(`\n⚠️  Skipping database setup: ${message}`);
    console.warn('   The app will deploy, but it shows a "connect a database" page until DATABASE_URL is set.');
    console.warn('   After adding it in Vercel → Storage (or Settings → Environment Variables), redeploy.\n');
    process.exit(0);
  }
  console.error(message);
  process.exit(1);
}

if (!databaseUrl()) stop('DATABASE_URL is not set.');

const { default: postgres } = await import('postgres');
const sql = postgres(databaseUrl(), { ssl: sslOption(), max: 1, onnotice: () => {}, connect_timeout: 15 });
try {
  await sql.unsafe(readFileSync(new URL('../db/schema.sql', import.meta.url), 'utf8'));
  console.log('Database schema is up to date.');
  await sql.end();
} catch (err) {
  await sql.end({ timeout: 1 }).catch(() => {});
  stop(`could not reach or update the database (${err.message}).`);
}
