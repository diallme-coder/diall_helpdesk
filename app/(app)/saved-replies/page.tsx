import Link from 'next/link';
import { requireUser } from '@/lib/auth';
import { sql } from '@/lib/db';
import { deleteReply, saveReply } from '@/lib/actions/settings';
import { UUID_RE } from '@/lib/util';

type SP = Promise<Record<string, string | string[] | undefined>>;

export default async function SavedRepliesPage({ searchParams }: { searchParams: SP }) {
  await requireUser();
  const sp = await searchParams;
  const editId = typeof sp.edit === 'string' && UUID_RE.test(sp.edit) ? sp.edit : null;
  const list = await sql<{ id: string; title: string; body: string }[]>`select id, title, body from saved_replies order by title`;
  const editing = editId ? list.find((r) => r.id === editId) : undefined;

  return (
    <div className="page">
      <h2>Saved replies</h2>
      <p className="lead">
        Reusable answers for common questions, shared by the whole team. Placeholders: <code>{'{{first_name}}'}</code> <code>{'{{customer}}'}</code>{' '}
        <code>{'{{agent}}'}</code> <code>{'{{number}}'}</code>
      </p>
      <form action={saveReply} className="card form" key={editing?.id ?? 'new'}>
        <h3>{editing ? 'Edit saved reply' : 'New saved reply'}</h3>
        {editing && <input type="hidden" name="id" value={editing.id} />}
        <label className="fld">
          <span>Name</span>
          <input name="title" required maxLength={120} defaultValue={editing?.title} placeholder="Refund on the way" />
        </label>
        <label className="fld">
          <span>Reply text</span>
          <textarea name="body" required maxLength={10000} rows={6} defaultValue={editing?.body} />
        </label>
        {sp.error === 'missing' && <p className="err">Fill in both the name and the text.</p>}
        <div className="dact">
          {editing && (
            <Link className="btn" href="/saved-replies">
              Cancel
            </Link>
          )}
          <button className="btn pri">{editing ? 'Save changes' : 'Add saved reply'}</button>
        </div>
      </form>
      {list.length === 0 && <p className="hint">No saved replies yet.</p>}
      {list.map((r) => (
        <div key={r.id} className="item">
          <div className="grow">
            <div className="ttl">{r.title}</div>
            <div className="desc">{r.body}</div>
          </div>
          <Link className="btn sm" href={`/saved-replies?edit=${r.id}`}>
            Edit
          </Link>
          <form action={deleteReply}>
            <input type="hidden" name="id" value={r.id} />
            <button className="btn sm dang">Delete</button>
          </form>
        </div>
      ))}
    </div>
  );
}
