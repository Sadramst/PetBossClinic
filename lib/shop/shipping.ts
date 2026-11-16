/**
 * Shipping rules (Toman). Tehran orders go by courier (and may pay cash on delivery);
 * other provinces ship by post and must pay online. Override with env vars.
 */
const num = (v: string | undefined, d: number) => (v && Number.isFinite(Number(v)) ? Number(v) : d);

export const SHIPPING = {
  tehranFee: num(process.env.SHIPPING_TEHRAN_FEE, 80_000),
  postFee: num(process.env.SHIPPING_POST_FEE, 150_000),
  freeOver: num(process.env.SHIPPING_FREE_OVER, 3_000_000),
};

export function isTehran(province: string): boolean {
  return province.trim() === 'تهران';
}

export function shippingFor(province: string, subtotal: number): { fee: number; method: string } {
  const tehran = isTehran(province);
  const method = tehran ? 'پیک ویژه تهران' : 'پست پیشتاز';
  if (subtotal >= SHIPPING.freeOver) return { fee: 0, method };
  return { fee: tehran ? SHIPPING.tehranFee : SHIPPING.postFee, method };
}

/** Cash on delivery is only offered inside Tehran (courier collects payment). */
export function codAllowed(province: string): boolean {
  return isTehran(province);
}
