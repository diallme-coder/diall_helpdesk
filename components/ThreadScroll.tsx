'use client';

import { useEffect, useRef, type ReactNode } from 'react';

/** Keeps the conversation scrolled to the newest message when one arrives. */
export default function ThreadScroll({ count, ticketId, children }: { count: number; ticketId: string; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const last = useRef({ count: 0, ticketId: '' });
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 120;
    if (last.current.ticketId !== ticketId || (count > last.current.count && nearBottom) || last.current.count === 0) {
      el.scrollTop = el.scrollHeight;
    }
    last.current = { count, ticketId };
  }, [count, ticketId]);
  return (
    <div className="thread" ref={ref}>
      {children}
    </div>
  );
}
