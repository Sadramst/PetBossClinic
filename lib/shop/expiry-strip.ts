import { formatJalaliDate, relativeMonthsFa, type ExpiryConfigValues, type ExpiryState } from '@/lib/shop/expiry';

export type StripModel =
  | { kind: 'none' }
  | { kind: 'unverified'; text: string }
  | {
      kind: 'dated';
      state: ExpiryState;
      dateText: string;
      relativeText: string;
      near: boolean;
      discounted: boolean;
      note: string | null;
    };

/**
 * Pure view-model for the product-page expiry strip. `date` is the FEFO batch that will ship.
 * Customers see one date and, for near-expiry stock, a calm note; red is never used here.
 */
export function buildExpiryStrip(input: {
  date: Date | null;
  state: ExpiryState;
  tracksExpiry: boolean;
  discounted?: boolean;
  now?: Date;
  cfg?: Partial<ExpiryConfigValues>;
}): StripModel {
  const now = input.now ?? new Date();
  if (!input.date || input.state === 'none' || input.state === 'expired') {
    return input.tracksExpiry
      ? { kind: 'unverified', text: 'تاریخ انقضا پیش از ارسال توسط کادر دامپزشکی بررسی می‌شود' }
      : { kind: 'none' };
  }
  const near = input.state === 'soon' || input.state === 'critical';
  const discounted = near && !!input.discounted;
  const note = near ? (discounted ? 'مناسب مصرف سریع؛ با تخفیف عرضه می‌شود' : 'مناسب مصرف سریع') : null;
  return {
    kind: 'dated',
    state: input.state,
    dateText: formatJalaliDate(input.date),
    relativeText: relativeMonthsFa(input.date, now),
    near,
    discounted,
    note,
  };
}
