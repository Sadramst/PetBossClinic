/**
 * Loyalty tiers and points math. Pure (no database): unit-tested, shared by server and UI.
 * Tier keys are stored on Customer.tier; the ladder itself lives in LoyaltyConfig.tiersJson.
 */

export interface TierDef {
  /** Stable key stored on the customer, e.g. BRONZE */
  key: string
  label: string
  /** Lifetime points needed to reach this tier */
  minPoints: number
  color: string
  perk: string
  /** Multiplier on points earned from orders and clinic services */
  earnMultiplier: number
}

export const DEFAULT_TIERS: TierDef[] = [
  { key: 'BRONZE', label: 'برنزی', minPoints: 0, color: '#b0793f', perk: 'عضویت در باشگاه و امتیاز روی هر خرید و خدمت', earnMultiplier: 1 },
  { key: 'SILVER', label: 'نقره‌ای', minPoints: 1000, color: '#8d96a3', perk: '۱۰٪ امتیاز بیشتر روی خرید و خدمات', earnMultiplier: 1.1 },
  { key: 'GOLD', label: 'طلایی', minPoints: 3000, color: '#c9a24a', perk: '۲۵٪ امتیاز بیشتر و دسترسی به جوایز ویژه', earnMultiplier: 1.25 },
  { key: 'PLATINUM', label: 'پلاتینیوم', minPoints: 8000, color: '#5b6b86', perk: '۵۰٪ امتیاز بیشتر و پیشنهادهای اختصاصی', earnMultiplier: 1.5 },
]

const KEY_RE = /^[A-Z][A-Z0-9_]{1,19}$/

/** Cleans a tiers value read from JSON (or typed by an admin). Falls back to the defaults when unusable. */
export function parseTiers(raw: unknown): TierDef[] {
  if (!Array.isArray(raw)) return DEFAULT_TIERS
  const seen = new Set<string>()
  const out: TierDef[] = []
  for (const item of raw.slice(0, 8)) {
    if (!item || typeof item !== 'object') continue
    const t = item as Record<string, unknown>
    const key = typeof t.key === 'string' ? t.key.trim().toUpperCase() : ''
    if (!KEY_RE.test(key) || seen.has(key)) continue
    const minPoints = Number(t.minPoints)
    const mult = Number(t.earnMultiplier)
    out.push({
      key,
      label: typeof t.label === 'string' && t.label.trim() ? t.label.trim().slice(0, 30) : key,
      minPoints: Number.isFinite(minPoints) ? Math.max(0, Math.floor(minPoints)) : 0,
      color: typeof t.color === 'string' && /^#[0-9a-fA-F]{6}$/.test(t.color) ? t.color : '#8d96a3',
      perk: typeof t.perk === 'string' ? t.perk.trim().slice(0, 160) : '',
      earnMultiplier: Number.isFinite(mult) ? Math.min(5, Math.max(1, Math.round(mult * 100) / 100)) : 1,
    })
    seen.add(key)
  }
  if (out.length === 0) return DEFAULT_TIERS
  out.sort((a, b) => a.minPoints - b.minPoints)
  // The lowest tier must start at zero so every member has a tier.
  out[0] = { ...out[0], minPoints: 0 }
  return out
}

/** Validation for the admin editor: returns a Persian error or null. */
export function validateTiers(tiers: TierDef[]): string | null {
  if (tiers.length < 1 || tiers.length > 8) return 'تعداد سطح‌ها باید بین ۱ تا ۸ باشد.'
  const keys = new Set<string>()
  let last = -1
  for (const t of tiers) {
    if (!KEY_RE.test(t.key)) return 'کلید سطح باید لاتین (حروف بزرگ، عدد و _) باشد.'
    if (keys.has(t.key)) return 'کلید سطح‌ها نباید تکراری باشد.'
    keys.add(t.key)
    if (!t.label.trim()) return 'برای هر سطح یک نام وارد کنید.'
    if (t.minPoints <= last && last >= 0) return 'امتیاز لازم برای سطح‌ها باید به‌ترتیب افزایش پیدا کند.'
    if (!(t.earnMultiplier >= 1 && t.earnMultiplier <= 5)) return 'ضریب امتیاز باید بین ۱ تا ۵ باشد.'
    last = t.minPoints
  }
  if (tiers[0].minPoints !== 0) return 'پایین‌ترین سطح باید از امتیاز صفر شروع شود.'
  return null
}

export function tierForLifetime(tiers: TierDef[], lifetimePoints: number): TierDef {
  let current = tiers[0]
  for (const t of tiers) if (lifetimePoints >= t.minPoints) current = t
  return current
}

export function tierByKey(tiers: TierDef[], key: string | null | undefined): TierDef {
  return tiers.find((t) => t.key === key) ?? tiers[0]
}

/** 0 for the lowest tier; used for minTier checks on rewards. */
export function tierRank(tiers: TierDef[], key: string | null | undefined): number {
  const i = tiers.findIndex((t) => t.key === key)
  return i < 0 ? 0 : i
}

export interface TierProgress {
  current: TierDef
  next: TierDef | null
  /** Points still needed for the next tier (0 at the top) */
  remaining: number
  /** 0-100 progress between current and next tier (100 at the top) */
  percent: number
}

export function tierProgress(tiers: TierDef[], lifetimePoints: number): TierProgress {
  const lt = Math.max(0, Math.floor(lifetimePoints))
  const current = tierForLifetime(tiers, lt)
  const next = tiers.find((t) => t.minPoints > current.minPoints) ?? null
  if (!next) return { current, next: null, remaining: 0, percent: 100 }
  const span = next.minPoints - current.minPoints
  const percent = span <= 0 ? 100 : Math.min(100, Math.max(0, Math.floor(((lt - current.minPoints) / span) * 100)))
  return { current, next, remaining: Math.max(0, next.minPoints - lt), percent }
}

export interface EarnRates {
  pointsPerThousandToman: number
  serviceMultiplier: number
}

/** Points for an order total (Toman): floor(total/1000 x rate x tier multiplier). */
export function pointsForOrder(total: number, tier: TierDef | number, rates: Pick<EarnRates, 'pointsPerThousandToman'>): number {
  const mult = typeof tier === 'number' ? tier : tier.earnMultiplier
  if (!(total > 0) || !(rates.pointsPerThousandToman > 0)) return 0
  return Math.floor((total / 1000) * rates.pointsPerThousandToman * mult)
}

/** Points for a clinic service amount (Toman): same as an order but with the service multiplier. */
export function pointsForService(amount: number, tier: TierDef | number, rates: EarnRates): number {
  const mult = typeof tier === 'number' ? tier : tier.earnMultiplier
  if (!(amount > 0) || !(rates.pointsPerThousandToman > 0)) return 0
  return Math.floor((amount / 1000) * rates.pointsPerThousandToman * rates.serviceMultiplier * mult)
}

/** Toman value of a points balance. */
export function pointsToToman(points: number, pointValueToman: number): number {
  return Math.max(0, Math.floor(points)) * Math.max(0, Math.floor(pointValueToman))
}
