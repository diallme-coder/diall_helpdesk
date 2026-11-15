import { sql } from './db';
import { audit } from './audit';
import { applyWorkflows, type Draft } from './workflows';
import { saveFiles } from './files';
import { preview, randomToken } from './util';

type NewTicket = {
  subject: string;
  customerName: string;
  customerEmail: string | null;
  body: string;
  priority: string;
  source: 'agent' | 'contact_form';
  createdBy: { id: string; name: string } | null;
  files: File[];
};

export async function createTicket(input: NewTicket) {
  const draft: Draft = {
    subject: input.subject,
    customer_email: input.customerEmail,
    assignee_id: null,
    tags: [],
    priority: input.priority,
  };
  const matched = await applyWorkflows(draft, input.body);
  const token = randomToken(24);

  const [t] = await sql<{ id: string; number: string }[]>`
    insert into tickets (subject, customer_name, customer_email, priority, assignee_id, tags, source, portal_token, created_by, last_preview, last_type)
    values (${draft.subject}, ${input.customerName}, ${input.customerEmail}, ${draft.priority}, ${draft.assignee_id},
            ${sql.array(draft.tags)}::text[], ${input.source}, ${token}, ${input.createdBy?.id ?? null}, ${preview(input.body)}, 'customer')
    returning id, number`;

  const [m] = await sql<{ id: string }[]>`
    insert into messages (ticket_id, type, body) values (${t.id}, 'customer', ${input.body}) returning id`;
  await saveFiles(t.id, m.id, input.files);

  if (matched.length) {
    await sql`insert into messages (ticket_id, type, body) values (${t.id}, 'event', ${'Workflows applied: ' + matched.join(', ')})`;
  }

  await audit(
    input.createdBy,
    'ticket.created',
    { type: 'ticket', id: Number(t.number) },
    { source: input.source, subject: draft.subject, workflows: matched, files: input.files.length },
    input.createdBy ? undefined : `${input.customerName} (customer)`
  );

  return { id: t.id, number: Number(t.number), portalToken: token };
}
