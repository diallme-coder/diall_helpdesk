'use client';

import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { FOLDERS } from '@/lib/constants';

type Props = { counts: Record<string, number>; tags: { tag: string; n: number }[]; isAdmin: boolean };

export default function SideNav({ counts, tags, isAdmin }: Props) {
  const path = usePathname();
  const sp = useSearchParams();
  const inInbox = path === '/inbox' || (path.startsWith('/inbox/') && path !== '/inbox/new');
  const tag = sp.get('tag');
  const folder = sp.get('folder') || 'unassigned';

  const item = (href: string, text: string, on: boolean, n?: number) => (
    <Link key={href} href={href} className={'nav' + (on ? ' on' : '')}>
      <span>{text}</span>
      {n !== undefined && <b>{n}</b>}
    </Link>
  );

  return (
    <nav>
      <div className="sec">Inbox</div>
      {FOLDERS.map(([k, l]) => item(`/inbox?folder=${k}`, l, inInbox && !tag && folder === k, counts[k] ?? 0))}
      {tags.length > 0 && (
        <>
          <div className="sec">Tags</div>
          {tags.map((t) => item(`/inbox?tag=${encodeURIComponent(t.tag)}`, '#' + t.tag, inInbox && tag === t.tag, t.n))}
        </>
      )}
      <div className="sec">Team</div>
      {item('/reports', 'Reports', path === '/reports')}
      {item('/saved-replies', 'Saved replies', path.startsWith('/saved-replies'))}
      {item('/workflows', 'Workflows', path.startsWith('/workflows'))}
      {isAdmin && (
        <>
          <div className="sec">Admin</div>
          {item('/admin/users', 'Users', path.startsWith('/admin/users'))}
          {item('/admin/activity', 'Activity log', path.startsWith('/admin/activity'))}
          <a className="nav" href="/contact" target="_blank" rel="noopener">
            <span>Public contact form ↗</span>
          </a>
        </>
      )}
    </nav>
  );
}
