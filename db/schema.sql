-- Team Helpdesk database schema.
-- Safe to run more than once: every statement only creates what is missing.

create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  username text not null unique,
  email text,
  password_hash text not null,
  role text not null default 'agent' check (role in ('admin', 'agent')),
  active boolean not null default true,
  must_change_password boolean not null default true,
  failed_attempts int not null default 0,
  locked_until timestamptz,
  last_login_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists sessions (
  id text primary key, -- sha256 of the cookie token; the token itself is never stored
  user_id uuid not null references users(id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  ip text,
  user_agent text
);
create index if not exists sessions_user_idx on sessions(user_id);

create table if not exists tickets (
  id uuid primary key default gen_random_uuid(),
  number bigint generated always as identity (start with 1001) unique,
  subject text not null,
  customer_name text not null,
  customer_email text,
  status text not null default 'active' check (status in ('active', 'pending', 'closed')),
  priority text not null default 'normal' check (priority in ('low', 'normal', 'high', 'urgent')),
  assignee_id uuid references users(id) on delete set null,
  tags text[] not null default '{}',
  source text not null default 'agent' check (source in ('agent', 'contact_form')),
  portal_token text not null unique,
  created_by uuid references users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  first_response_at timestamptz,
  first_responder_id uuid references users(id) on delete set null,
  closed_at timestamptz,
  last_preview text,
  last_type text
);
create index if not exists tickets_status_idx on tickets(status, updated_at desc);
create index if not exists tickets_assignee_idx on tickets(assignee_id);
create index if not exists tickets_tags_idx on tickets using gin(tags);

create table if not exists messages (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references tickets(id) on delete cascade,
  type text not null check (type in ('customer', 'reply', 'note', 'event')),
  body text not null,
  author_id uuid references users(id) on delete set null,
  created_at timestamptz not null default clock_timestamp()
);
create index if not exists messages_ticket_idx on messages(ticket_id, created_at);

create table if not exists attachments (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references tickets(id) on delete cascade,
  message_id uuid not null references messages(id) on delete cascade,
  filename text not null,
  content_type text not null,
  size int not null,
  data bytea not null,
  created_at timestamptz not null default now()
);
create index if not exists attachments_message_idx on attachments(message_id);
create index if not exists attachments_ticket_idx on attachments(ticket_id);

create table if not exists saved_replies (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body text not null,
  created_by uuid references users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists workflows (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  field text not null default 'any' check (field in ('any', 'subject', 'body', 'email')),
  contains text not null,
  assign_mode text not null default 'none' check (assign_mode in ('none', 'user', 'least_busy')),
  assign_user_id uuid references users(id) on delete set null,
  tag text,
  priority text check (priority is null or priority in ('low', 'normal', 'high', 'urgent')),
  enabled boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists activity_log (
  id bigint generated always as identity primary key,
  actor_id uuid references users(id) on delete set null,
  actor_label text,
  action text not null,
  target_type text,
  target_id text,
  details jsonb not null default '{}',
  ip text,
  created_at timestamptz not null default now()
);
create index if not exists activity_created_idx on activity_log(created_at desc);
create index if not exists activity_actor_idx on activity_log(actor_id);

create table if not exists ticket_presence (
  ticket_id uuid not null references tickets(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  typing boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (ticket_id, user_id)
);

create table if not exists rate_limits (
  key text primary key,
  count int not null,
  window_start timestamptz not null
);
