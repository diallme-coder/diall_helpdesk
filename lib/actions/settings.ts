'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { sql } from '@/lib/db';
import { requireAdmin, requireUser } from '@/lib/auth';
import { audit } from '@/lib/audit';
import { applyWorkflows, type Draft } from '@/lib/workflows';
import { PRIORITIES } from '@/lib/constants';
import { field, normalizeTag, UUID_RE } from '@/lib/util';

/* ----- Saved replies: any teammate can manage them ----- */

export async function saveReply(fd: FormData) {
  const u = await requireUser();
  const id = field(fd, 'id', 40);
  const title = field(fd, 'title', 120);
  const body = field(fd, 'body', 10000);
  if (!title || !body) redirect('/saved-replies?error=missing');
  if (id && UUID_RE.test(id)) {
    await sql`update saved_replies set title = ${title}, body = ${body}, updated_at = now() where id = ${id}`;
    await audit({ id: u.id, name: u.name }, 'saved_reply.updated', { type: 'saved_reply', id }, { title });
  } else {
    const [row] = await sql<{ id: string }[]>`
      insert into saved_replies (title, body, created_by) values (${title}, ${body}, ${u.id}) returning id`;
    await audit({ id: u.id, name: u.name }, 'saved_reply.created', { type: 'saved_reply', id: row.id }, { title });
  }
  revalidatePath('/saved-replies');
  redirect('/saved-replies');
}

export async function deleteReply(fd: FormData) {
  const u = await requireUser();
  const id = field(fd, 'id', 40);
  if (!UUID_RE.test(id)) return;
  const [row] = await sql<{ title: string }[]>`delete from saved_replies where id = ${id} returning title`;
  if (row) await audit({ id: u.id, name: u.name }, 'saved_reply.deleted', { type: 'saved_reply', id }, { title: row.title });
  revalidatePath('/saved-replies');
}

/* ----- Workflows: admins only ----- */

export async function saveWorkflow(fd: FormData) {
  const a = await requireAdmin();
  const id = field(fd, 'id', 40);
  const name = field(fd, 'name', 80);
  const fieldName = field(fd, 'field', 10);
  const contains = field(fd, 'contains', 80);
  const assign = field(fd, 'assign', 40);
  const tag = normalizeTag(field(fd, 'tag', 40)) || null;
  const priorityRaw = field(fd, 'priority', 10);
  const priority = (PRIORITIES as readonly string[]).includes(priorityRaw) ? priorityRaw : null;
  if (!name || !contains || !['any', 'subject', 'body', 'email'].includes(fieldName)) redirect('/workflows?error=missing');

  const assignMode = assign === 'least_busy' ? 'least_busy' : UUID_RE.test(assign) ? 'user' : 'none';
  const assignUser = assignMode === 'user' ? assign : null;

  if (id && UUID_RE.test(id)) {
    await sql`update workflows set name = ${name}, field = ${fieldName}, contains = ${contains}, assign_mode = ${assignMode},
              assign_user_id = ${assignUser}, tag = ${tag}, priority = ${priority} where id = ${id}`;
    await audit({ id: a.id, name: a.name }, 'workflow.updated', { type: 'workflow', id }, { name });
  } else {
    const [row] = await sql<{ id: string }[]>`
      insert into workflows (name, field, contains, assign_mode, assign_user_id, tag, priority)
      values (${name}, ${fieldName}, ${contains}, ${assignMode}, ${assignUser}, ${tag}, ${priority}) returning id`;
    await audit({ id: a.id, name: a.name }, 'workflow.created', { type: 'workflow', id: row.id }, { name });
  }
  revalidatePath('/workflows');
  redirect('/workflows');
}

export async function toggleWorkflow(fd: FormData) {
  const a = await requireAdmin();
  const id = field(fd, 'id', 40);
  if (!UUID_RE.test(id)) return;
  const [row] = await sql<{ name: string; enabled: boolean }[]>`
    update workflows set enabled = not enabled where id = ${id} returning name, enabled`;
  if (row) await audit({ id: a.id, name: a.name }, row.enabled ? 'workflow.enabled' : 'workflow.disabled', { type: 'workflow', id }, { name: row.name });
  revalidatePath('/workflows');
}

export async function deleteWorkflow(fd: FormData) {
  const a = await requireAdmin();
  const id = field(fd, 'id', 40);
  if (!UUID_RE.test(id)) return;
  const [row] = await sql<{ name: string }[]>`delete from workflows where id = ${id} returning name`;
  if (row) await audit({ id: a.id, name: a.name }, 'workflow.deleted', { type: 'workflow', id }, { name: row.name });
  revalidatePath('/workflows');
}

/** Applies workflows to open, unassigned conversations that already exist. */
export async function runWorkflowsNow() {
  const a = await requireAdmin();
  const tickets = await sql<{ id: string; number: string; subject: string; customer_email: string | null; tags: string[]; priority: string; body: string | null }[]>`
    select t.id, t.number, t.subject, t.customer_email, t.tags, t.priority,
      (select m.body from messages m where m.ticket_id = t.id and m.type = 'customer' order by m.created_at limit 1) as body
    from tickets t where t.status <> 'closed' and t.assignee_id is null
    order by t.created_at limit 500`;
  let routed = 0;
  for (const t of tickets) {
    const d: Draft = { subject: t.subject, customer_email: t.customer_email, assignee_id: null, tags: [...t.tags], priority: t.priority };
    const matched = await applyWorkflows(d, t.body ?? '');
    if (!matched.length) continue;
    await sql`update tickets set assignee_id = ${d.assignee_id}, tags = ${sql.array(d.tags)}::text[], priority = ${d.priority}, updated_at = now() where id = ${t.id}`;
    await sql`insert into messages (ticket_id, type, body, author_id) values (${t.id}, 'event', ${'Workflows applied: ' + matched.join(', ')}, ${a.id})`;
    routed++;
  }
  await audit({ id: a.id, name: a.name }, 'workflow.run_now', undefined, { routed, checked: tickets.length });
  revalidatePath('/', 'layout');
  redirect(`/workflows?routed=${routed}`);
}
