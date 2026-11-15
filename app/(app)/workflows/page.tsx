import Link from 'next/link';
import { requireUser } from '@/lib/auth';
import { sql } from '@/lib/db';
import { deleteWorkflow, runWorkflowsNow, saveWorkflow, toggleWorkflow } from '@/lib/actions/settings';
import { UUID_RE } from '@/lib/util';

type SP = Promise<Record<string, string | string[] | undefined>>;
type Rule = {
  id: string;
  name: string;
  field: string;
  contains: string;
  assign_mode: string;
  assign_user_id: string | null;
  assign_name: string | null;
  tag: string | null;
  priority: string | null;
  enabled: boolean;
};
const FIELDS: Record<string, string> = { any: 'Subject or message', subject: 'Subject', body: 'Message', email: 'Customer email' };

function describe(r: Rule) {
  const acts: string[] = [];
  if (r.assign_mode === 'least_busy') acts.push('assign to the least busy teammate');
  if (r.assign_mode === 'user') acts.push(`assign to ${r.assign_name ?? 'a deactivated user (skipped)'}`);
  if (r.tag) acts.push(`tag #${r.tag}`);
  if (r.priority) acts.push(`set priority ${r.priority}`);
  return `When ${FIELDS[r.field]?.toLowerCase()} contains “${r.contains}” → ${acts.join(', ') || 'do nothing'}`;
}

export default async function WorkflowsPage({ searchParams }: { searchParams: SP }) {
  const user = await requireUser();
  const isAdmin = user.role === 'admin';
  const sp = await searchParams;
  const rules = await sql<Rule[]>`
    select w.id, w.name, w.field, w.contains, w.assign_mode, w.assign_user_id, u.name as assign_name, w.tag, w.priority, w.enabled
    from workflows w left join users u on u.id = w.assign_user_id and u.active
    order by w.created_at`;
  const users = await sql<{ id: string; name: string }[]>`select id, name from users where active order by name`;
  const editId = typeof sp.edit === 'string' && UUID_RE.test(sp.edit) ? sp.edit : null;
  const e = editId ? rules.find((r) => r.id === editId) : undefined;
  const assignValue = e ? (e.assign_mode === 'least_busy' ? 'least_busy' : e.assign_user_id ?? '') : '';

  return (
    <div className="page">
      <h2>Workflows</h2>
      <p className="lead">Rules run on every new conversation, in order, so tickets land with the right person, tag and priority.</p>
      {typeof sp.routed === 'string' && <p className="notice">Workflows routed {sp.routed} existing conversation(s).</p>}

      {isAdmin ? (
        <form action={saveWorkflow} className="card form" key={e?.id ?? 'new'}>
          <h3>{e ? 'Edit workflow' : 'New workflow'}</h3>
          {e && <input type="hidden" name="id" value={e.id} />}
          <label className="fld">
            <span>Name</span>
            <input name="name" required maxLength={80} defaultValue={e?.name} placeholder="Route billing questions" />
          </label>
          <div className="two">
            <label className="fld">
              <span>When</span>
              <select name="field" defaultValue={e?.field ?? 'any'}>
                {Object.entries(FIELDS).map(([k, l]) => (
                  <option key={k} value={k}>
                    {l}
                  </option>
                ))}
              </select>
            </label>
            <label className="fld">
              <span>Contains</span>
              <input name="contains" required maxLength={80} defaultValue={e?.contains} placeholder="refund" />
            </label>
          </div>
          <div className="three">
            <label className="fld">
              <span>Assign to</span>
              <select name="assign" defaultValue={assignValue}>
                <option value="">Don’t assign</option>
                <option value="least_busy">Least busy teammate (round-robin)</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="fld">
              <span>Add tag</span>
              <input name="tag" maxLength={30} defaultValue={e?.tag ?? ''} placeholder="billing" />
            </label>
            <label className="fld">
              <span>Set priority</span>
              <select name="priority" defaultValue={e?.priority ?? ''}>
                <option value="">Don’t change</option>
                <option value="low">Low</option>
                <option value="normal">Normal</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </select>
            </label>
          </div>
          {sp.error === 'missing' && <p className="err">Fill in a name and the text to look for.</p>}
          <div className="dact">
            {e && (
              <Link className="btn" href="/workflows">
                Cancel
              </Link>
            )}
            <button className="btn pri">{e ? 'Save changes' : 'Add workflow'}</button>
          </div>
        </form>
      ) : (
        <p className="notice">Only admins can change workflows.</p>
      )}

      {isAdmin && rules.length > 0 && (
        <form action={runWorkflowsNow} className="runnow">
          <button className="btn">Run workflows on open, unassigned conversations now</button>
        </form>
      )}

      {rules.length === 0 && <p className="hint">No workflows yet. Example: when subject or message contains “refund”, assign to your billing lead and tag #billing.</p>}
      {rules.map((r) => (
        <div key={r.id} className="item">
          <div className="grow">
            <div className="ttl">
              {r.name} {r.enabled ? <span className="pill st-active">on</span> : <span className="pill st-closed">off</span>}
            </div>
            <div className="desc">{describe(r)}</div>
          </div>
          {isAdmin && (
            <>
              <form action={toggleWorkflow}>
                <input type="hidden" name="id" value={r.id} />
                <button className="btn sm">{r.enabled ? 'Turn off' : 'Turn on'}</button>
              </form>
              <Link className="btn sm" href={`/workflows?edit=${r.id}`}>
                Edit
              </Link>
              <form action={deleteWorkflow}>
                <input type="hidden" name="id" value={r.id} />
                <button className="btn sm dang">Delete</button>
              </form>
            </>
          )}
        </div>
      ))}
    </div>
  );
}
