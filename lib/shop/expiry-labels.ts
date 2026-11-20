/** Pure labels for expiry states. No imports besides a type, so client and server can share it. */
import type { ExpiryState } from '@/lib/shop/expiry';

export const EXPIRY_LABEL_FA: Record<ExpiryState, string> = {
  none: 'بدون تاریخ',
  ok: 'سالم',
  soon: 'نزدیک به انقضا',
  critical: 'انقضای بحرانی',
  expired: 'منقضی‌شده',
};

export type ExpiryTone = 'neutral' | 'success' | 'info' | 'warning' | 'danger';

export const EXPIRY_TONE: Record<ExpiryState, ExpiryTone> = {
  none: 'neutral',
  ok: 'success',
  soon: 'warning',
  critical: 'danger',
  expired: 'danger',
};
