/**
 * Shipping rules (Toman). Orders inside the city of Tehran go by courier (and may pay
 * cash on delivery); everywhere else ships by post and must pay online.
 * Override with env vars.
 */
import { normalizeFa } from '@/lib/text/persian';

const num = (v: string | undefined, d: number) => (v && Number.isFinite(Number(v)) ? Number(v) : d);

export const SHIPPING = {
  tehranFee: num(process.env.SHIPPING_TEHRAN_FEE, 80_000),
  postFee: num(process.env.SHIPPING_POST_FEE, 150_000),
  freeOver: num(process.env.SHIPPING_FREE_OVER, 3_000_000),
};

/** City names the courier serves. Override with SHIPPING_COURIER_CITIES="تهران,ری,شمیرانات". */
const DEFAULT_COURIER_CITIES = ['تهران', 'ری', 'شهرری', 'شمیرانات', 'تجریش'];

/** Comparable form of a city name: Persian letters, no spaces or half-spaces. */
export function normalizeCity(city: string): string {
  return normalizeFa(city ?? '')
    .split(/\s+/)
    .join('')
    .split('‌')
    .join('');
}

function courierCities(): string[] {
  const raw = process.env.SHIPPING_COURIER_CITIES;
  const list = raw ? raw.split(/[,،]/).map(normalizeCity).filter(Boolean) : [];
  return list.length ? list : DEFAULT_COURIER_CITIES.map(normalizeCity);
}

/**
 * True when the address is served by the Tehran courier.
 * With a city, the city decides (Damavand, Varamin, Pardis... are Tehran *province*
 * but ship by post). Without a city (older callers) only the province is checked.
 */
export function isTehran(province: string, city?: string | null): boolean {
  if (normalizeFa(province ?? '') !== 'تهران') return false;
  if (city == null) return true;
  const c = normalizeCity(city);
  if (!c) return false;
  const served = courierCities();
  // «شهر تهران» is the same place as «تهران».
  return served.includes(c) || (c.startsWith('شهر') && served.includes(c.slice(3)));
}

export function shippingFor(province: string, subtotal: number, city?: string | null): { fee: number; method: string } {
  const tehran = isTehran(province, city);
  const method = tehran ? 'پیک ویژه تهران' : 'پست پیشتاز';
  if (subtotal >= SHIPPING.freeOver) return { fee: 0, method };
  return { fee: tehran ? SHIPPING.tehranFee : SHIPPING.postFee, method };
}

/** Cash on delivery is only offered inside the city of Tehran (the courier collects payment). */
export function codAllowed(province: string, city?: string | null): boolean {
  return isTehran(province, city);
}
