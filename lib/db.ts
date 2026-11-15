import postgres from 'postgres';

/** False until DATABASE_URL is set; pages then show setup instructions instead of failing. */
const url = process.env.DATABASE_URL || process.env.POSTGRES_URL || '';
export const dbConfigured = Boolean(url);

const globalForDb = globalThis as unknown as { __helpdeskSql?: postgres.Sql };

export const sql =
  globalForDb.__helpdeskSql ??
  postgres(url, {
    max: 5,
    idle_timeout: 20,
    prepare: false, // works with connection poolers such as Neon's and Supabase's
    ssl: process.env.DATABASE_SSL === 'false' ? false : 'require',
    onnotice: () => {},
  });

if (process.env.NODE_ENV !== 'production') globalForDb.__helpdeskSql = sql;
