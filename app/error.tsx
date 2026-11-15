'use client';

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="authwrap">
      <div className="authcard">
        <h1>Something went wrong</h1>
        <p className="hint">
          The page couldn’t load. If this keeps happening, check that the database is connected and the latest deployment succeeded.
          {error.digest ? ` (Reference: ${error.digest})` : ''}
        </p>
        <div className="dact left">
          <button className="btn pri" onClick={() => reset()}>
            Try again
          </button>
          <a className="btn" href="/inbox">
            Go to the inbox
          </a>
        </div>
      </div>
    </div>
  );
}
