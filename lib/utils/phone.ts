/**
 * @file phone.ts
 * @description Robust Iranian phone number normalization, validation, and formatting.
 * Complies with E.164 standard for Iranian mobiles (+989XXXXXXXXX) and landlines (+9821XXXXXXXX).
 */

const PERSIAN_DIGITS = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];
const ARABIC_DIGITS = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];

/**
 * Converts Persian and Arabic numerals to ASCII digits.
 */
export function toAsciiDigits(str: string): string {
  if (!str) return '';
  let result = str;
  for (let i = 0; i < 10; i++) {
    result = result
      .replace(new RegExp(PERSIAN_DIGITS[i], 'g'), String(i))
      .replace(new RegExp(ARABIC_DIGITS[i], 'g'), String(i));
  }
  return result;
}

/**
 * Converts ASCII digits to Persian numerals.
 */
export function toPersianDigits(str: string | number): string {
  if (str === null || str === undefined) return '';
  const s = String(str);
  return s.replace(/\d/g, (d) => PERSIAN_DIGITS[parseInt(d, 10)] || d);
}

/**
 * Normalizes any Iranian phone input to E.164 format (+98...).
 * Handles Persian/Arabic digits, whitespace, hyphens, prefixes (+98, 0098, 0, 98).
 * Supports both mobile (09XXXXXXXXX) and landline (e.g., Tehran 021XXXXXXXX, 8-digit local 26429715).
 */
export function normalizeIranianPhone(raw: string): string {
  if (!raw) return '';
  
  const ascii = toAsciiDigits(raw.trim());
  // Preserve leading plus if present, strip all other non-digits
  const hasPlus = ascii.startsWith('+');
  const digits = ascii.replace(/\D/g, '');

  if (!digits) return '';

  // 1. Starts with international prefix 0098 -> replace with 98
  let clean = digits;
  if (clean.startsWith('0098')) {
    clean = clean.slice(2);
  }

  // 2. Starts with 98
  if (clean.startsWith('98')) {
    return `+${clean}`;
  }

  // 3. Iranian mobile starting with 09... (11 digits, e.g. 09121234567)
  if (clean.startsWith('09') && clean.length === 11) {
    return `+98${clean.slice(1)}`;
  }

  // 4. Iranian mobile without leading 0 (10 digits, e.g. 9121234567)
  if (clean.startsWith('9') && clean.length === 10) {
    return `+98${clean}`;
  }

  // 5. Iranian landline starting with 0 (e.g. Tehran 02126429715)
  if (clean.startsWith('0') && clean.length >= 10 && clean.length <= 11) {
    return `+98${clean.slice(1)}`;
  }

  // 6. Tehran 8-digit local number (e.g. 26429715)
  if (clean.length === 8) {
    return `+9821${clean}`;
  }

  // If already had plus and didn't match rules above
  if (hasPlus) {
    return `+${clean}`;
  }

  // Fallback: prefix with +98 if looks like 10-digit mobile
  if (clean.length === 10) {
    return `+98${clean}`;
  }

  return `+${clean}`;
}

/**
 * Validates whether a normalized or raw phone string is a valid Iranian mobile (+989XXXXXXXXX).
 */
export function isValidIranianMobile(phone: string): boolean {
  const normalized = normalizeIranianPhone(phone);
  return /^\+989\d{9}$/.test(normalized);
}

/**
 * Validates whether a phone is a valid Iranian phone (mobile or landline).
 */
export function isValidIranianPhone(phone: string): boolean {
  const normalized = normalizeIranianPhone(phone);
  // Iranian mobile: +98 9XXXXXXXXX (12 chars total)
  // Iranian landline: +98 [1-8]XXXXXXXX (12 or 13 chars total)
  return /^\+98(9\d{9}|[1-8]\d{8,9})$/.test(normalized);
}

/**
 * Formats a normalized or raw phone string for display.
 * e.g., '+982126429715' in 'fa' -> '۰۲۱-۲۶۴۲۹۷۱۵'
 * e.g., '+982126429715' in 'en' -> '+98 21 2642 9715'
 * e.g., '+989123456789' in 'fa' -> '۰۹۱۲-۳۴۵-۶۷۸۹'
 * e.g., '+989123456789' in 'en' -> '+98 912 345 6789'
 */
export function formatPhoneDisplay(phone: string, locale: string = 'fa'): string {
  const normalized = normalizeIranianPhone(phone);
  const isEn = locale === 'en';

  // Mobile: +989123456789
  const mobileMatch = normalized.match(/^\+98(9\d{2})(\d{3})(\d{4})$/);
  if (mobileMatch) {
    const [, prefix, mid, end] = mobileMatch;
    if (isEn) {
      return `+98 ${prefix} ${mid} ${end}`;
    }
    return toPersianDigits(`0${prefix}-${mid}-${end}`);
  }

  // Tehran Landline: +982126429715
  const tehranMatch = normalized.match(/^\+98(21)(\d{4})(\d{4})$/);
  if (tehranMatch) {
    const [, code, part1, part2] = tehranMatch;
    if (isEn) {
      return `+98 ${code} ${part1} ${part2}`;
    }
    return toPersianDigits(`0${code}-${part1}${part2}`);
  }

  // Other Landlines: +98XXXXXXXXX
  const landlineMatch = normalized.match(/^\+98([1-8]\d{1,2})(\d{3,4})(\d{4})$/);
  if (landlineMatch) {
    const [, code, part1, part2] = landlineMatch;
    if (isEn) {
      return `+98 ${code} ${part1} ${part2}`;
    }
    return toPersianDigits(`0${code}-${part1}${part2}`);
  }

  // Fallback
  return isEn ? normalized : toPersianDigits(normalized);
}

/**
 * Generates an RFC 3966 `tel:` URL.
 */
export function getTelLink(phone: string): string {
  const normalized = normalizeIranianPhone(phone);
  return `tel:${normalized}`;
}

/**
 * Generates a `wa.me/` WhatsApp deep link.
 */
export function getWhatsAppLink(phone: string, message?: string): string {
  const normalized = normalizeIranianPhone(phone);
  const digits = normalized.replace(/\D/g, '');
  const url = `https://wa.me/${digits}`;
  if (message) {
    return `${url}?text=${encodeURIComponent(message)}`;
  }
  return url;
}

/**
 * Backward-compatible helper.
 */
export function formatPhone(phone: string): string {
  return formatPhoneDisplay(phone, 'fa');
}
