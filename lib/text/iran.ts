import { toLatinDigits } from '@/lib/date/jalali';

/**
 * Iranian mobile number to canonical 09xxxxxxxxx form, or null when invalid.
 * Accepts Persian/Arabic digits, spaces/dashes and +98 / 0098 / 98 / 9xx prefixes.
 */
export function normalizeMobile(input: string): string | null {
  let d = toLatinDigits(input ?? '').replace(/[\s\-()]/g, '');
  if (d.startsWith('+98')) d = `0${d.slice(3)}`;
  else if (d.startsWith('0098')) d = `0${d.slice(4)}`;
  else if (d.startsWith('98') && d.length === 12) d = `0${d.slice(2)}`;
  else if (d.startsWith('9') && d.length === 10) d = `0${d}`;
  return /^09\d{9}$/.test(d) ? d : null;
}

/** 10-digit Iranian postal code (no 0 or 2 in the first five digits, per Iran Post rules). */
export function normalizePostalCode(input: string): string | null {
  const d = toLatinDigits(input ?? '').replace(/[\s-]/g, '');
  return /^[13-9]{5}\d{5}$/.test(d) ? d : null;
}

/** Masks a mobile number for display: 0912***4567 */
export function maskMobile(phone: string): string {
  return phone.length === 11 ? `${phone.slice(0, 4)}***${phone.slice(7)}` : phone;
}

export const IRAN_PROVINCES = [
  'تهران',
  'البرز',
  'اصفهان',
  'فارس',
  'خراسان رضوی',
  'آذربایجان شرقی',
  'آذربایجان غربی',
  'اردبیل',
  'ایلام',
  'بوشهر',
  'چهارمحال و بختیاری',
  'خراسان جنوبی',
  'خراسان شمالی',
  'خوزستان',
  'زنجان',
  'سمنان',
  'سیستان و بلوچستان',
  'قزوین',
  'قم',
  'کردستان',
  'کرمان',
  'کرمانشاه',
  'کهگیلویه و بویراحمد',
  'گلستان',
  'گیلان',
  'لرستان',
  'مازندران',
  'مرکزی',
  'هرمزگان',
  'همدان',
  'یزد',
] as const;

export function isIranProvince(p: string): boolean {
  return (IRAN_PROVINCES as readonly string[]).includes(p);
}
