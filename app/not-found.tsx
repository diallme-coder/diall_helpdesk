import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="authwrap">
      <div className="authcard">
        <h1>Not found</h1>
        <p className="hint">This page or conversation doesn’t exist, or it was deleted.</p>
        <Link className="btn pri" href="/inbox">
          Go to the inbox
        </Link>
      </div>
    </div>
  );
}
