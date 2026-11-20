import { DEFAULT_EXPIRY_CONFIG, minShelfLifeDays, type ExpiryConfigValues } from '@/lib/shop/expiry';

/** Validation rule from the spec: critical < soon, minShelfLife <= critical. Falls back to defaults when violated. */
export function sanitizeExpiryConfig(raw: Partial<ExpiryConfigValues> | null | undefined): ExpiryConfigValues {
  const d = DEFAULT_EXPIRY_CONFIG;
  const int = (v: unknown, fallback: number, min: number, max: number) => {
    const n = Math.floor(Number(v));
    return Number.isFinite(n) && n >= min && n <= max ? n : fallback;
  };
  const envMin = minShelfLifeDays();
  const v: ExpiryConfigValues = {
    soonDays: int(raw?.soonDays, d.soonDays, 1, 730),
    criticalDays: int(raw?.criticalDays, d.criticalDays, 1, 365),
    minShelfLifeDays: int(raw?.minShelfLifeDays, envMin, 0, 365),
    discountStartDays: int(raw?.discountStartDays, d.discountStartDays, 1, 730),
    discountPercent: int(raw?.discountPercent, d.discountPercent, 1, 90),
  };
  if (v.criticalDays >= v.soonDays || v.minShelfLifeDays > v.criticalDays) {
    return {
      ...d,
      minShelfLifeDays: envMin <= d.criticalDays ? envMin : d.minShelfLifeDays,
      discountStartDays: v.discountStartDays,
      discountPercent: v.discountPercent,
    };
  }
  return v;
}
