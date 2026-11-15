import { redirect } from 'next/navigation';
import { getUser } from '@/lib/auth';
import { sql } from '@/lib/db';
import { APP_NAME } from '@/lib/constants';
import { LoginForm } from '@/components/AuthForms';

export const dynamic = 'force-dynamic';

export default async function LoginPage() {
  if (await getUser()) redirect('/inbox');
  const [{ n }] = await sql<{ n: number }[]>`select count(*)::int as n from users`;
  if (n === 0) redirect('/setup');
  return (
    <div className="authwrap">
      <div className="authcard">
        <div className="brand dark">
          <i />
          {APP_NAME}
        </div>
        <h1>Sign in</h1>
        <LoginForm />
      </div>
    </div>
  );
}
