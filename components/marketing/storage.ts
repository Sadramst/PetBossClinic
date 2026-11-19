/** localStorage helpers: storage can be blocked or full, the site must work without it. */
export const COUPON_KEY = 'pb_coupon_v1';
export const POPUP_KEY = 'pb_welcome_popup_v1';
export const BANNER_KEY = 'pb_promo_banner_v1';

export function readStore(key: string, session = false): string | null {
  try {
    return (session ? window.sessionStorage : window.localStorage).getItem(key);
  } catch {
    return null;
  }
}

export function writeStore(key: string, value: string | null, session = false): void {
  try {
    const s = session ? window.sessionStorage : window.localStorage;
    if (value === null) s.removeItem(key);
    else s.setItem(key, value);
  } catch {
    /* ignore */
  }
}

/** Time-boxed flag, e.g. "dismissed for 7 days". */
export function setSnooze(key: string, days: number): void {
  writeStore(key, String(Date.now() + days * 86_400_000));
}

export function isSnoozed(key: string): boolean {
  const v = Number(readStore(key));
  return Number.isFinite(v) && v > Date.now();
}

/** Lead input: an email when it holds "@", otherwise a mobile number. */
export function parseLead(raw: string): { email?: string; phone?: string } {
  const v = raw.trim();
  return v.includes('@') ? { email: v } : { phone: v };
}

const PERSIAN = '۰۱۲۳۴۵۶۷۸۹';
const ARABIC = '٠١٢٣٤٥٦٧٨٩';

export function validateLead(raw: string): string | null {
  const v = raw.trim();
  if (!v) return 'شماره موبایل یا ایمیل خود را وارد کنید.';
  if (v.includes('@')) return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v) ? null : 'ایمیل واردشده معتبر نیست.';
  const digits = v
    .replace(/[۰-۹]/g, (d) => String(PERSIAN.indexOf(d)))
    .replace(/[٠-٩]/g, (d) => String(ARABIC.indexOf(d)))
    .replace(/[\s\-()]/g, '');
  return /^(\+98|0098|98|0)?9\d{9}$/.test(digits) ? null : 'شماره موبایل معتبر نیست؛ مثل ۰۹۱۲۳۴۵۶۷۸۹ وارد کنید.';
}
