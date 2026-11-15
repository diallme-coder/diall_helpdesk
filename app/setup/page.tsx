import { redirect } from 'next/navigation';
import { dbConfigured, sql } from '@/lib/db';
import DbMissing from '@/components/DbMissing';
import { APP_NAME } from '@/lib/constants';
import { SetupForm } from '@/components/AuthForms';

export const dynamic = 'force-dynamic';

export default async function SetupPage() {
  if (!dbConfigured) return <DbMissing />;
  const [{ n }] = await sql<{ n: number }[]>`select count(*)::int as n from users`;
  if (n > 0) redirect('/login');
  const enabled = (process.env.SETUP_TOKEN ?? '').length >= 12;
  return (
    <div className="authwrap">
      <div className="authcard wide">
        <div className="brand dark">
          <i />
          {APP_NAME}
        </div>
        <h1>Create the first admin</h1>
        {enabled ? (
          <>
            <p className="hint">This page works only once, while there are no users. After this, admins add everyone else from Admin → Users.</p>
            <SetupForm />
          </>
        ) : (
          <p className="notice">
            Setup is turned off. Add a <code>SETUP_TOKEN</code> setting (12 or more random characters) to the server and redeploy, or run{' '}
            <code>npm run create-admin</code> from your computer.
          </p>
        )}
      </div>
    </div>
  );
}
