import { sql } from './db';

/** Counts a hit for key in a fixed window. Returns true while the count is within limit. */
export async function allow(key: string, limit: number, windowSeconds: number) {
  const [row] = await sql<{ count: number }[]>`
    insert into rate_limits (key, count, window_start) values (${key}, 1, now())
    on conflict (key) do update set
      count = case when rate_limits.window_start < now() - ${windowSeconds}::int * interval '1 second' then 1 else rate_limits.count + 1 end,
      window_start = case when rate_limits.window_start < now() - ${windowSeconds}::int * interval '1 second' then now() else rate_limits.window_start end
    returning count`;
  if (Math.random() < 0.02) await sql`delete from rate_limits where window_start < now() - interval '1 day'`;
  return row.count <= limit;
}
