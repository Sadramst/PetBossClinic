/**
 * Product expiry (shelf-life) logic. Inventory rows are dated stock batches.
 * Pure functions only, so they are unit-tested and shared by storefront and admin.
 */

export interface ExpiryBatch {
  quantity: number;
  expiryDate: Date | string | null;
}

export type ExpiryState = 'none' | 'ok' | 'soon' | 'critical' | 'expired';

const DAY = 24 * 60 * 60 * 1000;

/** Days before expiry at which the admin is warned / the batch is flagged. */
export const EXPIRY_SOON_DAYS = 90;
export const EXPIRY_CRITICAL_DAYS = 30;

function toDate(d: Date | string | null): Date | null {
  if (!d) return null;
  const date = d instanceof Date ? d : new Date(d);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** Whole days from `now` until `expiry` (negative when already expired). */
export function daysUntil(expiry: Date | string, now: Date = new Date()): number {
  const e = toDate(expiry);
  if (!e) return Number.POSITIVE_INFINITY;
  return Math.floor((e.getTime() - now.getTime()) / DAY);
}

export function expiryState(expiry: Date | string | null, now: Date = new Date()): ExpiryState {
  const e = toDate(expiry);
  if (!e) return 'none';
  const days = daysUntil(e, now);
  if (days < 0) return 'expired';
  if (days <= EXPIRY_CRITICAL_DAYS) return 'critical';
  if (days <= EXPIRY_SOON_DAYS) return 'soon';
  return 'ok';
}

/**
 * Minimum shelf life (in days) a dated batch must still have to be sold online.
 * Post to other provinces takes days, so a pack expiring tomorrow must not ship.
 * Override with MIN_SHELF_LIFE_DAYS (0 sells until the printed date).
 */
export const DEFAULT_MIN_SHELF_LIFE_DAYS = 7;

export function minShelfLifeDays(): number {
  const raw = typeof process !== 'undefined' ? process.env?.MIN_SHELF_LIFE_DAYS : undefined;
  const n = raw != null && raw !== '' ? Number(raw) : NaN;
  return Number.isFinite(n) && n >= 0 && n <= 365 ? Math.floor(n) : DEFAULT_MIN_SHELF_LIFE_DAYS;
}

/** A dated batch is sellable only when it expires on or after this instant. */
export function sellableCutoff(now: Date = new Date()): Date {
  return new Date(now.getTime() + minShelfLifeDays() * DAY);
}

/** True for a dated batch that is not expired yet but too close to expiry to be sold. */
export function isBelowShelfLife(expiry: Date | string | null, now: Date = new Date()): boolean {
  const e = toDate(expiry);
  if (!e) return false;
  return e.getTime() >= now.getTime() && e.getTime() < sellableCutoff(now).getTime();
}

/** Units that can still be sold: batches with stock that keep the minimum shelf life. */
export function sellableQuantity(batches: ExpiryBatch[], now: Date = new Date()): number {
  const cutoff = sellableCutoff(now).getTime();
  return batches.reduce((sum, b) => {
    if (b.quantity <= 0) return sum;
    const e = toDate(b.expiryDate);
    if (e && e.getTime() < cutoff) return sum;
    return sum + b.quantity;
  }, 0);
}

/**
 * The expiry date a customer will actually receive (FEFO): the earliest expiry
 * among sellable, dated batches. Null when no dated sellable batch exists.
 */
export function nextShippingExpiry(batches: ExpiryBatch[], now: Date = new Date()): Date | null {
  let best: Date | null = null;
  const cutoff = sellableCutoff(now).getTime();
  for (const b of batches) {
    if (b.quantity <= 0) continue;
    const e = toDate(b.expiryDate);
    if (!e || e.getTime() < cutoff) continue;
    if (!best || e.getTime() < best.getTime()) best = e;
  }
  return best;
}

/** Jalali (Solar Hijri) date for display, e.g. «۱۲ اسفند ۱۴۰۶». */
export function formatJalaliDate(date: Date | string, style: 'long' | 'numeric' = 'long'): string {
  const d = toDate(date);
  if (!d) return '';
  return new Intl.DateTimeFormat('fa-IR-u-ca-persian', {
    year: 'numeric',
    month: style === 'long' ? 'long' : '2-digit',
    day: style === 'long' ? 'numeric' : '2-digit',
    timeZone: 'Asia/Tehran',
  }).format(d);
}
