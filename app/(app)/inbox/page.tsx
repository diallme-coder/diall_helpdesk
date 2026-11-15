import Link from 'next/link';
import { requireUser } from '@/lib/auth';
import TicketList, { type SearchParams } from '@/components/TicketList';
import AutoRefresh from '@/components/AutoRefresh';

export default async function InboxPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const user = await requireUser();
  const sp = await searchParams;
  return (
    <div className="inbox">
      <TicketList user={user} sp={sp} selected={null} />
      <main className="conv blank">
        <div className="empty">
          <h3>Pick a conversation</h3>
          <p>Choose a ticket from the list to read, reply or assign it.</p>
          <p>
            Customers can open tickets themselves on your <a href="/contact" target="_blank" rel="noopener">contact form</a>, or you can{' '}
            <Link href="/inbox/new">log one yourself</Link>.
          </p>
        </div>
      </main>
      <AutoRefresh seconds={20} />
    </div>
  );
}
