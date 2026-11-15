import { requireAdmin } from '@/lib/auth';
import { sql } from '@/lib/db';
import Avatar from '@/components/Avatar';
import Time from '@/components/Time';
import { CreateUserForm, UserRowActions } from '@/components/UserAdmin';

type Row = {
  id: string;
  name: string;
  username: string;
  email: string | null;
  role: string;
  active: boolean;
  must_change_password: boolean;
  locked: boolean;
  last_login_at: Date | null;
  open_n: number;
};

export default async function UsersPage() {
  const me = await requireAdmin();
  const users = await sql<Row[]>`
    select u.id, u.name, u.username, u.email, u.role, u.active, u.must_change_password,
      coalesce(u.locked_until > now(), false) as locked, u.last_login_at,
      (select count(*) from tickets t where t.assignee_id = u.id and t.status <> 'closed')::int as open_n
    from users u
    order by u.active desc, u.name`;

  return (
    <div className="page">
      <h2>Users</h2>
      <p className="lead">
        Create an account for each teammate. They sign in with the username and temporary password you give them, then choose their own password.
      </p>
      <CreateUserForm />
      <table className="users">
        <thead>
          <tr>
            <th>Person</th>
            <th>Role</th>
            <th>Status</th>
            <th>Open tickets</th>
            <th>Last sign-in</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {users.map((u) => (
            <tr key={u.id} className={u.active ? '' : 'inactive'}>
              <td>
                <div className="person">
                  <Avatar name={u.name} id={u.id} />
                  <div>
                    <div>
                      {u.name}
                      {u.id === me.id && <span className="hint"> (you)</span>}
                    </div>
                    <div className="hint">
                      {u.username}
                      {u.email ? ` · ${u.email}` : ''}
                    </div>
                  </div>
                </div>
              </td>
              <td>
                <span className="pill">{u.role}</span>
              </td>
              <td>
                {!u.active ? (
                  <span className="pill st-closed">deactivated</span>
                ) : u.locked ? (
                  <span className="pill pr-urgent">locked</span>
                ) : u.must_change_password ? (
                  <span className="pill st-pending">temporary password</span>
                ) : (
                  <span className="pill st-active">active</span>
                )}
              </td>
              <td>{u.open_n}</td>
              <td>{u.last_login_at ? <Time at={u.last_login_at} /> : <span className="hint">never</span>}</td>
              <td>
                <UserRowActions
                  user={{ id: u.id, name: u.name, username: u.username, email: u.email, role: u.role, active: u.active, locked: u.locked }}
                  isSelf={u.id === me.id}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
