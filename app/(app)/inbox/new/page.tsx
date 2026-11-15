import { requireUser } from '@/lib/auth';
import NewTicketForm from '@/components/NewTicketForm';

export default async function NewTicketPage() {
  await requireUser();
  return (
    <div className="page">
      <h2>New conversation</h2>
      <p className="lead">Log a request that came in by email, phone, chat or in person. Your workflows route it automatically.</p>
      <NewTicketForm />
    </div>
  );
}
