import { APP_NAME } from '@/lib/constants';

/** Shown instead of the app while no database is connected. */
export default function DbMissing() {
  return (
    <div className="authwrap">
      <div className="authcard wide">
        <div className="brand dark">
          <i />
          {APP_NAME}
        </div>
        <h1>Connect a database to finish setup</h1>
        <p>The app is deployed, but it doesn’t have a database yet.</p>
        <ol className="steps">
          <li>
            In your Vercel project, open <b>Storage</b> and create or connect a <b>Neon (Postgres)</b> database. This adds the{' '}
            <code>DATABASE_URL</code> setting for you.
          </li>
          <li>
            In <b>Settings → Environment Variables</b>, add <code>SETUP_TOKEN</code> (a long random string) and <code>HELPDESK_NAME</code>.
          </li>
          <li>
            Open <b>Deployments</b>, click <b>⋯</b> on the latest one, and choose <b>Redeploy</b>. The tables are created during the build.
          </li>
          <li>
            Come back here and open <code>/setup</code> to create your admin account.
          </li>
        </ol>
      </div>
    </div>
  );
}
