import Link from 'next/link';
import { requireUser } from '@/lib/auth';
import { APP_NAME } from '@/lib/constants';
import { ChangePasswordForm } from '@/components/AuthForms';
import { logout } from '@/lib/actions/auth';

export const dynamic = 'force-dynamic';

export default async function ChangePasswordPage() {
  const u = await requireUser({ allowPasswordChange: true });
  return (
    <div className="authwrap">
      <div className="authcard">
        <div className="brand dark">
          <i />
          {APP_NAME}
        </div>
        <h1>{u.must_change_password ? `Welcome, ${u.name}` : 'Change password'}</h1>
        <ChangePasswordForm forced={u.must_change_password} />
        <div className="authfoot">
          {!u.must_change_password && <Link href="/inbox">← Back to inbox</Link>}
          <form action={logout}>
            <button className="linkbtn">Sign out</button>
          </form>
        </div>
      </div>
    </div>
  );
}
