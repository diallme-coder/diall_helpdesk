'use client';

import { useEffect, useState } from 'react';

type Other = { name: string; typing: boolean };

/**
 * Tells teammates you have this conversation open, and shows who else does.
 * The Composer fires a "hd-typing" window event while you write a reply.
 */
export default function Presence({ ticketId }: { ticketId: string }) {
  const [others, setOthers] = useState<Other[]>([]);

  useEffect(() => {
    let alive = true;
    let typing = false;
    let typingTimer: ReturnType<typeof setTimeout> | undefined;
    const url = `/api/tickets/${ticketId}/presence`;

    async function ping() {
      try {
        const r = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ typing }) });
        if (r.ok && alive) setOthers(((await r.json()) as { others: Other[] }).others);
      } catch {
        /* offline: try again on the next tick */
      }
    }
    const onTyping = () => {
      const wasTyping = typing;
      typing = true;
      if (!wasTyping) ping();
      clearTimeout(typingTimer);
      typingTimer = setTimeout(() => {
        typing = false;
        ping();
      }, 6000);
    };

    ping();
    const iv = setInterval(ping, 8000);
    window.addEventListener('hd-typing', onTyping);
    return () => {
      alive = false;
      clearInterval(iv);
      clearTimeout(typingTimer);
      window.removeEventListener('hd-typing', onTyping);
      navigator.sendBeacon?.(`${url}?leave=1`);
    };
  }, [ticketId]);

  if (!others.length) return null;
  const typing = others.filter((o) => o.typing);
  const names = (list: Other[]) => list.map((o) => o.name).join(', ');
  return typing.length ? (
    <div className="collide typing">
      ✍ {names(typing)} {typing.length > 1 ? 'are' : 'is'} replying right now. Check before you send.
    </div>
  ) : (
    <div className="collide">
      👁 {names(others)} {others.length > 1 ? 'are' : 'is'} also viewing this conversation.
    </div>
  );
}
