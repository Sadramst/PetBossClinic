/**
 * Standard Price Formatting for Pet Boss Clinic
 * Rules:
 * 1. Returns "تماس بگیرید" (fa) or "Call for price" (en) if price is null, 0, undefined, or <= 0.
 * 2. Formats with Persian digits and "تومان" in Farsi (e.g. "۱۵۰,۰۰۰ تومان").
 * 3. Formats with Latin digits and "Tomans" in English (e.g. "150,000 Tomans").
 */

export type PriceLocale = 'fa' | 'en';
export type PriceDisplayMode = 'RANGE' | 'FROM' | 'ON_REQUEST';

export function formatPrice(
  price: number | null | undefined,
  locale: PriceLocale = 'fa'
): string {
  if (price === null || price === undefined || price <= 0) {
    return locale === 'fa' ? 'تماس بگیرید' : 'Call for price';
  }

  if (locale === 'fa') {
    return `${price.toLocaleString('fa-IR')} تومان`;
  }

  return `${price.toLocaleString('en-US')} Tomans`;
}

export function formatServicePrice(
  mode: PriceDisplayMode = 'ON_REQUEST',
  priceFrom: number | null | undefined,
  priceTo: number | null | undefined,
  locale: PriceLocale = 'fa'
): string {
  if (mode === 'ON_REQUEST') {
    return locale === 'fa' ? 'تماس بگیرید' : 'Call for price';
  }

  const isEn = locale === 'en';

  if (mode === 'FROM') {
    if (!priceFrom || priceFrom <= 0) {
      return locale === 'fa' ? 'تماس بگیرید' : 'Call for price';
    }
    const formattedFrom = priceFrom.toLocaleString(isEn ? 'en-US' : 'fa-IR');
    return isEn ? `From ${formattedFrom} Tomans` : `از ${formattedFrom} تومان`;
  }

  if (mode === 'RANGE') {
    if (!priceFrom || priceFrom <= 0) {
      return locale === 'fa' ? 'تماس بگیرید' : 'Call for price';
    }
    const formattedFrom = priceFrom.toLocaleString(isEn ? 'en-US' : 'fa-IR');
    if (!priceTo || priceTo <= priceFrom) {
      return isEn ? `From ${formattedFrom} Tomans` : `از ${formattedFrom} تومان`;
    }
    const formattedTo = priceTo.toLocaleString(isEn ? 'en-US' : 'fa-IR');
    return isEn
      ? `${formattedFrom} – ${formattedTo} Tomans`
      : `${formattedFrom} الی ${formattedTo} تومان`;
  }

  return locale === 'fa' ? 'تماس بگیرید' : 'Call for price';
}
