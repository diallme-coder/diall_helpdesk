'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { sql } from '@/lib/db';
import { requireUser, type User } from '@/lib/auth';
import { audit } from '@/lib/audit';
import { createTicket } from '@/lib/tickets';
import { filesFrom, filesProblem, saveFiles } from '@/lib/files';
import { PRIORITIES, STATUSES } from '@/lib/constants';
import { EMAIL_RE, field, normalizeTag, preview, UUID_RE } from '@/lib/util';

export type Result = { error?: string };

type TicketRow = {
  id: string;
  number: string;
  status: string;
  priority: string;
  assignee_id: string | null;
  first_response_at: Date | null;
  tags: string[];
};

async function findTicket(id: string) {
  if (!UUID_RE.test(id)) return null;
  const [t] = await sql<TicketRow[]>`
    select id, number, status, priority, assignee_id, first_response_at, tags from tickets where id = ${id}`;
  return t ?? null;
}

async function logEvent(ticketId: string, user: User, body: string) {
  await sql`insert into messages (ticket_id, type, body, author_id) values (${ticketId}, 'event', ${body}, ${user.id})`;
}

const actor = (u: User) => ({ id: u.id, name: u.name });
const refresh = () => revalidatePath('/', 'layout');
const isStatus = (s: string) => (STATUSES as readonly string[]).includes(s);
const isPriority = (s: string) => (PRIORITIES as readonly string[]).includes(s);

export async function newTicket(_prev: Result, fd: FormData): Promise<Result> {
  const u = await requireUser();
  const subject = field(fd, 'subject', 200);
  const customerName = field(fd, 'customerName', 120);
  const customerEmail = field(fd, 'customerEmail', 200).toLowerCase();
  const body = field(fd, 'body', 20000);
  const priority = field(fd, 'priority', 10);
  if (!subject || !customerName || !body) return { error: 'Fill in the customer name, subject and message.' };
  if (customerEmail && !EMAIL_RE.test(customerEmail)) return { error: 'That email address doesn’t look right.' };
  const files = filesFrom(fd);
  const problem = filesProblem(files);
  if (problem) return { error: problem };

  const t = await createTicket({
    subject,
    customerName,
    customerEmail: customerEmail || null,
    body,
    priority: isPriority(priority) ? priority : 'normal',
    source: 'agent',
    createdBy: actor(u),
    files,
  });
  refresh();
  redirect(`/inbox/${t.id}`);
}

export async function addMessage(fd: FormData): Promise<Result> {
  const u = await requireUser();
  const t = await findTicket(field(fd, 'ticketId', 40));
  if (!t) return { error: 'This conversation no longer exists.' };
  const type = field(fd, 'type', 10);
  if (!['reply', 'note', 'customer'].includes(type)) return { error: 'Unknown message type.' };
  const body = field(fd, 'body', 20000);
  if (!body) return { error: 'Write something first.' };
  const files = filesFrom(fd);
  const problem = filesProblem(files);
  if (problem) return { error: problem };

  const [m] = await sql<{ id: string }[]>`
    insert into messages (ticket_id, type, body, author_id)
    values (${t.id}, ${type}, ${body}, ${type === 'customer' ? null : u.id}) returning id`;
  await saveFiles(t.id, m.id, files);

  let status = t.status;
  if (type === 'reply') {
    const after = field(fd, 'statusAfter', 10);
    status = isStatus(after) ? after : 'pending';
  } else if (type === 'customer') {
    status = 'active';
  }
  const isFirstResponse = type === 'reply' && !t.first_response_at;
  const claim = type === 'reply' && !t.assignee_id;

  await sql`
    update tickets set
      updated_at = now(),
      last_preview = ${preview(body)},
      last_type = ${type},
      status = ${status},
      closed_at = ${status === 'closed' ? (t.status === 'closed' ? sql`closed_at` : sql`now()`) : sql`null`},
      first_response_at = ${isFirstResponse ? sql`now()` : sql`first_response_at`},
      first_responder_id = ${isFirstResponse ? sql`${u.id}::uuid` : sql`first_responder_id`},
      assignee_id = ${claim ? sql`${u.id}::uuid` : sql`assignee_id`}
    where id = ${t.id}`;

  const action = type === 'reply' ? 'ticket.replied' : type === 'note' ? 'ticket.note_added' : 'ticket.customer_message_logged';
  await audit(actor(u), action, { type: 'ticket', id: Number(t.number) }, { status, files: files.length });
  refresh();
  return {};
}

export async function updateTicket(fd: FormData): Promise<Result> {
  const u = await requireUser();
  const t = await findTicket(field(fd, 'ticketId', 40));
  if (!t) return { error: 'This conversation no longer exists.' };
  const what = field(fd, 'field', 20);
  const value = field(fd, 'value', 60);
  const target = { type: 'ticket', id: Number(t.number) };

  if (what === 'status') {
    if (!isStatus(value)) return { error: 'Unknown status.' };
    if (value === t.status) return {};
    await sql`update tickets set status = ${value}, updated_at = now(),
              closed_at = ${value === 'closed' ? sql`now()` : sql`null`} where id = ${t.id}`;
    await logEvent(t.id, u, `${u.name} marked this ${value}`);
    await audit(actor(u), 'ticket.status_changed', target, { from: t.status, to: value });
  } else if (what === 'priority') {
    if (!isPriority(value)) return { error: 'Unknown priority.' };
    if (value === t.priority) return {};
    await sql`update tickets set priority = ${value}, updated_at = now() where id = ${t.id}`;
    await logEvent(t.id, u, `${u.name} set priority to ${value}`);
    await audit(actor(u), 'ticket.priority_changed', target, { from: t.priority, to: value });
  } else if (what === 'assignee') {
    let assignee: { id: string; name: string } | null = null;
    if (value) {
      if (!UUID_RE.test(value)) return { error: 'Unknown teammate.' };
      const [row] = await sql<{ id: string; name: string }[]>`select id, name from users where id = ${value} and active`;
      if (!row) return { error: 'That teammate is not active.' };
      assignee = row;
    }
    if ((assignee?.id ?? null) === t.assignee_id) return {};
    await sql`update tickets set assignee_id = ${assignee?.id ?? null}, updated_at = now() where id = ${t.id}`;
    const msg = !assignee ? `${u.name} unassigned this` : assignee.id === u.id ? `${u.name} took this conversation` : `${u.name} assigned this to ${assignee.name}`;
    await logEvent(t.id, u, msg);
    await audit(actor(u), 'ticket.assigned', target, { to: assignee?.name ?? null });
  } else {
    return { error: 'Unknown change.' };
  }
  refresh();
  return {};
}

export async function addTag(fd: FormData): Promise<Result> {
  const u = await requireUser();
  const t = await findTicket(field(fd, 'ticketId', 40));
  if (!t) return { error: 'This conversation no longer exists.' };
  const tag = normalizeTag(field(fd, 'tag', 60));
  if (!tag) return { error: 'Tags can use letters, numbers and dashes.' };
  if (t.tags.includes(tag)) return {};
  if (t.tags.length >= 20) return { error: 'A conversation can have up to 20 tags.' };
  await sql`update tickets set tags = array_append(tags, ${tag}::text), updated_at = now()
            where id = ${t.id} and not (${tag}::text = any(tags))`;
  await audit(actor(u), 'ticket.tag_added', { type: 'ticket', id: Number(t.number) }, { tag });
  refresh();
  return {};
}

export async function removeTag(fd: FormData): Promise<Result> {
  const u = await requireUser();
  const t = await findTicket(field(fd, 'ticketId', 40));
  if (!t) return { error: 'This conversation no longer exists.' };
  const tag = field(fd, 'tag', 60);
  await sql`update tickets set tags = array_remove(tags, ${tag}::text), updated_at = now() where id = ${t.id}`;
  await audit(actor(u), 'ticket.tag_removed', { type: 'ticket', id: Number(t.number) }, { tag });
  refresh();
  return {};
}

export async function deleteTicket(fd: FormData): Promise<Result> {
  const u = await requireUser();
  if (u.role !== 'admin') return { error: 'Only admins can delete conversations.' };
  const t = await findTicket(field(fd, 'ticketId', 40));
  if (!t) return { error: 'This conversation no longer exists.' };
  const [info] = await sql<{ subject: string; customer_name: string }[]>`select subject, customer_name from tickets where id = ${t.id}`;
  await sql`delete from tickets where id = ${t.id}`;
  await audit(actor(u), 'ticket.deleted', { type: 'ticket', id: Number(t.number) }, { subject: info?.subject ?? '', customer: info?.customer_name ?? '' });
  refresh();
  redirect('/inbox');
}
