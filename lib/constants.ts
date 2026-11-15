// Shared by server and browser code. Keep this file free of server-only imports.

export const APP_NAME = process.env.HELPDESK_NAME || process.env.NEXT_PUBLIC_HELPDESK_NAME || 'Helpdesk';

export const STATUSES = ['active', 'pending', 'closed'] as const;
export const PRIORITIES = ['low', 'normal', 'high', 'urgent'] as const;
export type Status = (typeof STATUSES)[number];
export type Priority = (typeof PRIORITIES)[number];

export const FOLDERS = [
  ['unassigned', 'Unassigned'],
  ['mine', 'Mine'],
  ['assigned', 'Assigned'],
  ['pending', 'Pending'],
  ['closed', 'Closed'],
  ['all', 'All conversations'],
] as const;

export const MAX_FILES = 5;
export const MAX_TOTAL_BYTES = 4 * 1024 * 1024;

export const label = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export function formatBytes(n: number) {
  if (n < 1024) return n + ' B';
  if (n < 1024 * 1024) return Math.round(n / 1024) + ' KB';
  return (n / 1024 / 1024).toFixed(1) + ' MB';
}
