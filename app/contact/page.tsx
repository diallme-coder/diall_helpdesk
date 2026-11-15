import type { Metadata } from 'next';
import { APP_NAME } from '@/lib/constants';
import { ContactForm } from '@/components/PublicForms';

export const metadata: Metadata = { title: `Contact support · ${APP_NAME}` };

export default async function ContactPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  return (
    <div className="authwrap">
      <div className="authcard wide">
        <div className="brand dark">
          <i />
          {APP_NAME}
        </div>
        {sp.sent ? (
          <>
            <h1>Thanks, we got your message</h1>
            <p className="hint">Our team will get back to you soon.</p>
          </>
        ) : (
          <>
            <h1>Contact support</h1>
            <p className="hint">Tell us what you need. You’ll get a private link to follow your request and see our replies.</p>
            <ContactForm />
          </>
        )}
      </div>
    </div>
  );
}
