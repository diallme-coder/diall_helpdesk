import postgres from 'postgres';

const globalForDb = globalThis as unknown as { __helpdeskSql?: postgres.Sql };

export const sql =
  globalForDb.__helpdeskSql ??
  postgres(process.env.DATABASE_URL ?? '', {
    max: 5,
    idle_timeout: 20,
    prepare: false, // works with connection poolers such as Neon's and Supabase's
    ssl: process.env.DATABASE_SSL === 'false' ? false : 'require',
    onnotice: () => {},
  });

if (process.env.NODE_ENV !== 'production') globalForDb.__helpdeskSql = sql;
