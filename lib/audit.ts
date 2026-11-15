import type postgres from 'postgres';
import { sql } from './db';
import { clientIp } from './util';

type Actor = { id: string; name: string } | null;
type Target = { type: string; id?: string | number | null };

/**
 * Records an entry in the admin activity log. Never throws: a logging failure
 * must not block the action being logged.
 */
export async function audit(actor: Actor, action: string, target?: Target, details: Record<string, unknown> = {}, actorLabel?: string) {
  try {
    const ip = await clientIp().catch(() => null);
    await sql`
      insert into activity_log (actor_id, actor_label, action, target_type, target_id, details, ip)
      values (${actor?.id ?? null}, ${actorLabel ?? actor?.name ?? null}, ${action}, ${target?.type ?? null},
              ${target?.id != null ? String(target.id) : null}, ${sql.json(details as postgres.JSONValue)}, ${ip})`;
  } catch (err) {
    console.error('activity log write failed', err);
  }
}
