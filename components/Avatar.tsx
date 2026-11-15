const COLORS = ['#1292ee', '#7c5cff', '#e5484d', '#2fb36d', '#e08a00', '#0ea5a4', '#d6409f', '#5b6b7d'];

export default function Avatar({ name, id, large }: { name: string | null | undefined; id?: string | null; large?: boolean }) {
  const cls = 'av' + (large ? ' lg' : '');
  if (!name) return <span className={cls} title="Unassigned">–</span>;
  const initials = name.split(/\s+/).filter(Boolean).map((w) => w[0]).join('').slice(0, 2).toUpperCase();
  let h = 0;
  for (const c of id || name) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return (
    <span className={cls} style={{ background: COLORS[h % COLORS.length] }} title={name}>
      {initials}
    </span>
  );
}
