'use client';

function ago(d: Date) {
  const s = (Date.now() - d.getTime()) / 1000;
  if (s < 60) return 'now';
  if (s < 3600) return Math.floor(s / 60) + 'm';
  if (s < 86400) return Math.floor(s / 3600) + 'h';
  if (s < 604800) return Math.floor(s / 86400) + 'd';
  return d.toLocaleDateString();
}

/** Shows a time in the viewer's own time zone. */
export default function Time({ at, relative }: { at: string | Date | null; relative?: boolean }) {
  if (!at) return null;
  const d = new Date(at);
  const full = d.toLocaleString([], { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
  return (
    <time dateTime={d.toISOString()} title={full} suppressHydrationWarning>
      {relative ? ago(d) : full}
    </time>
  );
}
