'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { MAX_FILES, MAX_TOTAL_BYTES } from '@/lib/constants';

function checkFiles(form: HTMLFormElement): string | null {
  const input = form.querySelector<HTMLInputElement>('input[type=file]');
  const files = input?.files ? Array.from(input.files) : [];
  if (files.length > MAX_FILES) return `Attach up to ${MAX_FILES} files.`;
  if (files.reduce((n, f) => n + f.size, 0) > MAX_TOTAL_BYTES) return 'Attachments can be up to 4 MB in total.';
  return null;
}

async function post(url: string, form: HTMLFormElement) {
  const res = await fetch(url, { method: 'POST', body: new FormData(form) });
  const data = (await res.json().catch(() => ({}))) as { ok?: boolean; url?: string; error?: string };
  if (!res.ok || !data.ok) throw new Error(data.error || 'Something went wrong. Please try again.');
  return data;
}

export function ContactForm() {
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        const form = e.currentTarget;
        const fileErr = checkFiles(form);
        if (fileErr) return setError(fileErr);
        setBusy(true);
        setError('');
        try {
          const data = await post('/api/contact', form);
          window.location.assign(data.url ?? '/contact');
        } catch (err) {
          setError((err as Error).message);
          setBusy(false);
        }
      }}
    >
      <div className="two">
        <label className="fld">
          <span>Your name</span>
          <input name="name" required maxLength={120} autoComplete="name" />
        </label>
        <label className="fld">
          <span>Your email</span>
          <input name="email" type="email" required maxLength={200} autoComplete="email" />
        </label>
      </div>
      <label className="fld">
        <span>Subject</span>
        <input name="subject" required maxLength={200} />
      </label>
      <label className="fld">
        <span>How can we help?</span>
        <textarea name="body" required maxLength={20000} rows={7} />
      </label>
      <label className="fld">
        <span>Attachments (optional, up to 5 files, 4 MB total)</span>
        <input name="files" type="file" multiple />
      </label>
      {/* Spam trap: hidden from people, filled in by bots */}
      <input name="website" tabIndex={-1} autoComplete="off" className="trap" aria-hidden="true" />
      {error && <p className="err">{error}</p>}
      <button className="btn pri wide" disabled={busy}>
        {busy ? 'Sending…' : 'Send request'}
      </button>
    </form>
  );
}

export function PortalReplyForm({ token }: { token: string }) {
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const ref = useRef<HTMLFormElement>(null);
  const router = useRouter();
  return (
    <form
      ref={ref}
      className="card form"
      onSubmit={async (e) => {
        e.preventDefault();
        const form = e.currentTarget;
        const fileErr = checkFiles(form);
        if (fileErr) return setError(fileErr);
        setBusy(true);
        setError('');
        try {
          await post(`/api/portal/${token}`, form);
          ref.current?.reset();
          setSent(true);
          router.refresh();
        } catch (err) {
          setError((err as Error).message);
        } finally {
          setBusy(false);
        }
      }}
    >
      <h3>Add a reply</h3>
      <label className="fld">
        <span>Message</span>
        <textarea name="body" required maxLength={20000} rows={5} onInput={() => setSent(false)} />
      </label>
      <label className="fld">
        <span>Attachments (optional)</span>
        <input name="files" type="file" multiple />
      </label>
      {error && <p className="err">{error}</p>}
      {sent && <p className="ok">Sent. The team will see your message.</p>}
      <div className="dact">
        <button className="btn pri" disabled={busy}>
          {busy ? 'Sending…' : 'Send'}
        </button>
      </div>
    </form>
  );
}
