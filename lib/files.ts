import { sql } from './db';
import { MAX_FILES, MAX_TOTAL_BYTES } from './constants';

export function filesFrom(fd: FormData): File[] {
  return fd.getAll('files').filter((f): f is File => typeof f === 'object' && f !== null && 'arrayBuffer' in f && f.size > 0);
}

export function filesProblem(files: File[]): string | null {
  if (files.length > MAX_FILES) return `Attach up to ${MAX_FILES} files at a time.`;
  const total = files.reduce((n, f) => n + f.size, 0);
  if (total > MAX_TOTAL_BYTES) return 'Attachments can be up to 4 MB in total.';
  return null;
}

export function cleanFilename(name: string) {
  const cleaned = (name || 'file').replace(/[\\/\x00-\x1f\x7f"<>|:*?]/g, '_').trim();
  return (cleaned || 'file').slice(-120);
}

export async function saveFiles(ticketId: string, messageId: string, files: File[]) {
  for (const f of files) {
    const data = Buffer.from(await f.arrayBuffer());
    await sql`
      insert into attachments (ticket_id, message_id, filename, content_type, size, data)
      values (${ticketId}, ${messageId}, ${cleanFilename(f.name)}, ${(f.type || 'application/octet-stream').slice(0, 100)}, ${data.length}, ${data})`;
  }
}
