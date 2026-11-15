# Diall Helpdesk

A team helpdesk in the style of Help Scout. Customers send requests through a public contact form. Your team works them from a shared inbox: assign, reply, leave internal notes, and route tickets automatically with workflows. Admins create every account and can see who did what.

## Features

**For the team**
- Shared inbox with Unassigned, Mine, Assigned, Pending, Closed and All folders, tag folders, and search (by customer, subject or `#number`)
- Conversation view: replies to the customer, internal notes (team only), and a log of every assignment and status change
- Assign to a teammate or yourself, set status (active, pending, closed) and priority, add tags
- **Collision detection:** see when a teammate is viewing the same ticket, and a warning when they're typing a reply
- Saved replies with placeholders: `{{first_name}}`, `{{customer}}`, `{{agent}}`, `{{number}}`
- File attachments on replies, notes and new tickets (up to 5 files, 4 MB in total)
- Reports: open, unassigned, waiting on customer, first-response time, time to close, and each teammate's workload
- The inbox refreshes on its own every 15–20 seconds

**For customers**
- Public contact form at `/contact`, with attachments, spam protection and rate limiting
- After sending, each customer gets a private ticket page (`/t/<link>`). There they see the team's replies (never internal notes), reply back and add files. Agents can copy that link from any conversation.

**For admins**
- **Users:** create accounts with a username and a temporary password (typed in or generated). Users must choose their own password at first sign-in. Admins can reset passwords, unlock, change role (admin or agent), sign a user out everywhere, or deactivate them. Deactivating moves their open tickets back to Unassigned.
- **Workflows:** "when subject/message/email contains X → assign to a person or the least busy teammate, add a tag, set priority." They run on every new ticket and can be run on existing unassigned ones.
- **Activity log:** sign-ins (including failed and blocked attempts), password changes, user changes, and every ticket action, with IP addresses and filters.
- Only admins can delete conversations or change workflows.

**Security**
- Passwords are hashed with scrypt; they're never stored or logged in plain text
- Sessions use random tokens in httpOnly cookies, stored hashed, valid for 7 days
- Accounts lock for 15 minutes after 5 wrong passwords; sign-in is also rate-limited per network
- The first-admin setup page needs a secret `SETUP_TOKEN` and works only while there are no users
- The app always keeps at least one active admin. Admins can't demote or deactivate themselves.
- Attachments are only served to signed-in staff, or to the customer through their own ticket link

## Tech

Next.js 15 (App Router, server actions), React 19, PostgreSQL through [`postgres`](https://github.com/porsager/postgres). There is no other service to set up: attachments are stored in the database.

## Deploy on Vercel

1. **Create a database.** In your Vercel project, open **Storage → Create → Neon (Postgres)** and connect it to the project. This adds `DATABASE_URL` for you. Any Postgres 13+ database works (Supabase, Neon, your own).
2. **Add environment variables** in **Project → Settings → Environment Variables**:
   - `SETUP_TOKEN`: a long random string, for example from `openssl rand -base64 24`
   - `HELPDESK_NAME`: the name customers see, for example `Diall Support`
   - `APP_URL` (optional): your public address, for example `https://help.diall.com`
3. **Import this repo** into Vercel and deploy. The build creates the database tables automatically (`npm run build` runs the migration first).
4. Open `https://your-app/setup`, enter the `SETUP_TOKEN`, and create your admin account.
5. Go to **Admin → Users** and create accounts for your team. Share `https://your-app/contact` with customers, for example on your website or as a QR code.

You can delete `SETUP_TOKEN` after the first admin exists. Setup is closed for good once any user exists.

## Run locally

```bash
cp .env.example .env.local      # then fill in DATABASE_URL (use DATABASE_SSL=false for a local Postgres)
npm install
npm run db:migrate
npm run create-admin -- admin "Your Name" "a-strong-password-123"
npm run dev                     # http://localhost:3000
```

## Locked out?

If every admin has lost access, run this from a computer that has the production `DATABASE_URL` in `.env.local`:

```bash
npm run create-admin -- <username> "<Full Name>" "<new password>"
```

It creates that admin, or resets the existing account to admin with the new password, and signs out its sessions.

## Project layout

```
app/(app)/        signed-in pages: inbox, conversation, reports, saved replies, workflows, admin
app/contact       public contact form
app/t/[token]     customer ticket page
app/api/          contact form, customer replies, attachments, presence
lib/actions/      server actions (all check sign-in and role)
lib/              database, auth, workflows, activity log, rate limiting
db/schema.sql     database schema (safe to re-run)
scripts/          migrate and create-admin commands
```

## Not included yet

- Email in and out (customer emails becoming tickets, replies sent as emails). Customers currently follow up through their ticket page.
- Two-factor authentication
