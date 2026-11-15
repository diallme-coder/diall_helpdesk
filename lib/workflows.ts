import { sql } from './db';

export type Draft = {
  subject: string;
  customer_email: string | null;
  assignee_id: string | null;
  tags: string[];
  priority: string;
};

type Rule = {
  name: string;
  field: 'any' | 'subject' | 'body' | 'email';
  contains: string;
  assign_mode: 'none' | 'user' | 'least_busy';
  assign_user_id: string | null;
  tag: string | null;
  priority: string | null;
};

/** The active teammate with the fewest open conversations (ties broken at random). */
export async function leastBusyUser() {
  const [u] = await sql<{ id: string }[]>`
    select u.id from users u
    left join tickets t on t.assignee_id = u.id and t.status <> 'closed'
    where u.active
    group by u.id
    order by count(t.id), random()
    limit 1`;
  return u?.id ?? null;
}

/** Runs enabled workflows in creation order, changing draft in place. Returns the names that matched. */
export async function applyWorkflows(draft: Draft, body: string) {
  const rules = await sql<Rule[]>`
    select name, field, contains, assign_mode, assign_user_id, tag, priority
    from workflows where enabled order by created_at`;
  const matched: string[] = [];
  for (const r of rules) {
    const haystack =
      r.field === 'subject' ? draft.subject : r.field === 'email' ? draft.customer_email ?? '' : r.field === 'body' ? body : `${draft.subject}\n${body}`;
    if (!r.contains || !haystack.toLowerCase().includes(r.contains.toLowerCase())) continue;
    if (r.assign_mode === 'user' && r.assign_user_id) {
      const [ok] = await sql`select 1 from users where id = ${r.assign_user_id} and active`;
      if (ok) draft.assignee_id = r.assign_user_id;
    } else if (r.assign_mode === 'least_busy') {
      draft.assignee_id = (await leastBusyUser()) ?? draft.assignee_id;
    }
    if (r.tag && !draft.tags.includes(r.tag)) draft.tags.push(r.tag);
    if (r.priority) draft.priority = r.priority;
    matched.push(r.name);
  }
  return matched;
}
