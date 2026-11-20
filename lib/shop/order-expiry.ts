import { formatJalaliDate } from '@/lib/shop/expiry';

/** Expiry text for one order line from stored allocations: a date, or a range when batches differ; null for old orders. */
export function lineExpiryText(allocations: unknown): string | null {
  if (!Array.isArray(allocations)) return null;
  const dates = allocations
    .map((t) => (t && typeof t === 'object' ? (t as { expiryDate?: unknown }).expiryDate : null))
    .map((v) => (typeof v === 'string' ? new Date(v) : null))
    .filter((d): d is Date => !!d && !Number.isNaN(d.getTime()))
    .sort((a, b) => a.getTime() - b.getTime());
  if (!dates.length) return null;
  const first = formatJalaliDate(dates[0]);
  const last = formatJalaliDate(dates[dates.length - 1]);
  return first === last ? first : `${first} تا ${last}`;
}
