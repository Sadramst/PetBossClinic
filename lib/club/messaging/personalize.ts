import 'server-only'
import type { Coupon, CouponType, Pet } from '@prisma/client'
import { db } from '@/lib/db'
import { getLoyaltyConfig } from '@/lib/club/config'
import { tierByKey } from '@/lib/club/tiers'
import { faNum } from '@/lib/club/pet-math'
import { dateToJalali } from '@/lib/date/jalali'
import { normalizeFa } from '@/lib/text/persian'
import { absoluteUrl } from '@/lib/seo/site'
import { createCouponWithUniqueCode } from '@/lib/marketing/coupons'
import { describeOffer } from '@/lib/marketing/coupon-rules'
import { SPECIES_LABEL } from '@/lib/club/pet-math'
import type { TemplateVars } from '@/lib/club/messaging/render'

/** Per-recipient personal coupon recipe stored on campaigns, automation rules and AI suggestions. */
export interface CouponTemplate {
  type: CouponType
  value: number
  maxDiscount?: number | null
  minSubtotal?: number
  validDays: number
  brandIds?: string[]
  categoryIds?: string[]
  /** Limit the coupon to the brand of the pet's food. Recipients whose pet has no known brand are skipped. */
  restrictToPetBrand?: boolean
}

const int = (v: unknown, lo: number, hi: number, d: number) => {
  const n = typeof v === 'string' && v.trim() !== '' ? Number(v) : v
  return typeof n === 'number' && Number.isFinite(n) ? Math.min(hi, Math.max(lo, Math.floor(n))) : d
}
const ids = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string' && x.length > 0 && x.length < 40).slice(0, 20) : [])

/** Cleans an untrusted coupon template; returns null when it is missing or not usable. */
export function normalizeCouponTemplate(raw: unknown): CouponTemplate | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Record<string, unknown>
  const type = r.type
  if (type !== 'PERCENT' && type !== 'FIXED' && type !== 'FREE_SHIPPING') return null
  const value = type === 'FREE_SHIPPING' ? 0 : int(r.value, 1, type === 'PERCENT' ? 100 : 100_000_000, type === 'PERCENT' ? 10 : 50_000)
  return {
    type,
    value,
    maxDiscount: type === 'PERCENT' && r.maxDiscount !== null && r.maxDiscount !== undefined && r.maxDiscount !== '' ? int(r.maxDiscount, 0, 100_000_000, 0) || null : null,
    minSubtotal: int(r.minSubtotal, 0, 1_000_000_000, 0),
    validDays: int(r.validDays, 1, 365, 14),
    brandIds: ids(r.brandIds),
    categoryIds: ids(r.categoryIds),
    restrictToPetBrand: r.restrictToPetBrand === true,
  }
}

/** Active shop brand that matches what the customer typed as their pet's food brand, if any. */
export async function findBrandForFood(foodBrand: string | null | undefined): Promise<{ id: string; nameFa: string } | null> {
  const wanted = normalizeFa(foodBrand ?? '').toLowerCase().trim()
  if (wanted.length < 2) return null
  const brands = await db.brand.findMany({ where: { isActive: true, deletedAt: null }, select: { id: true, nameFa: true, nameEn: true } })
  let best: { id: string; nameFa: string } | null = null
  for (const b of brands) {
    for (const name of [b.nameFa, b.nameEn]) {
      const n = normalizeFa(name ?? '').toLowerCase().trim()
      if (n.length >= 2 && (wanted.includes(n) || n.includes(wanted))) {
        if (!best || n === wanted) best = { id: b.id, nameFa: b.nameFa }
      }
    }
  }
  return best
}

export function formatExpiry(date: Date): string {
  const j = dateToJalali(date)
  return faNum(j.jy) + '/' + faNum(j.jm) + '/' + faNum(j.jd)
}

export interface Recipient {
  customerId: string
  firstName: string | null
  tier: string
  tierLabel: string
  pointsBalance: number
  pet: Pet | null
}

/** Customer plus the pet a message is "about": a given pet, else the oldest living active pet. */
export async function loadRecipient(customerId: string, petId?: string | null): Promise<Recipient | null> {
  const c = await db.customer.findUnique({
    where: { id: customerId },
    select: {
      id: true,
      firstName: true,
      tier: true,
      pointsBalance: true,
      pets: { where: { isActive: true, deceasedAt: null }, orderBy: { createdAt: 'asc' } },
    },
  })
  if (!c) return null
  const cfg = await getLoyaltyConfig()
  const pet = (petId ? c.pets.find((p) => p.id === petId) : null) ?? c.pets[0] ?? null
  return { customerId: c.id, firstName: c.firstName, tier: c.tier, tierLabel: tierByKey(cfg.tiers, c.tier).label, pointsBalance: c.pointsBalance, pet }
}

export function baseVars(r: Recipient, extra: TemplateVars = {}): TemplateVars {
  return {
    name: r.firstName,
    petName: r.pet?.name,
    petBreed: r.pet?.breed ?? (r.pet ? SPECIES_LABEL[r.pet.species] : undefined),
    points: faNum(r.pointsBalance),
    tier: r.tierLabel,
    link: absoluteUrl('/shop'),
    ...extra,
  }
}

export type IssueCouponResult = { ok: true; coupon: Coupon; expiry: string } | { ok: false; reason: 'no_pet_brand' }

/**
 * Creates the recipient's own single-use coupon from a template (through the shared coupon engine,
 * bound to the customer). restrictToPetBrand narrows it to the brand of the pet's food.
 */
export async function issueRecipientCoupon(
  recipient: Recipient,
  template: CouponTemplate,
  opts: { source: string; title: string; now?: Date }
): Promise<IssueCouponResult> {
  const now = opts.now ?? new Date()
  let brandIds = template.brandIds ?? []
  if (template.restrictToPetBrand) {
    const brand = await findBrandForFood(recipient.pet?.foodBrand)
    if (!brand) return { ok: false, reason: 'no_pet_brand' }
    brandIds = [brand.id]
  }
  const endsAt = new Date(now.getTime() + template.validDays * 86_400_000)
  const offer = { type: template.type, value: template.value, maxDiscount: template.maxDiscount ?? null }
  const coupon = await createCouponWithUniqueCode({
    title: `${opts.title}: ${describeOffer(offer)}`.slice(0, 120),
    description: 'کد شخصی و یک‌بارمصرف باشگاه مشتریان',
    type: template.type,
    value: template.value,
    maxDiscount: template.type === 'PERCENT' ? (template.maxDiscount ?? null) : null,
    minSubtotal: template.minSubtotal ?? 0,
    startsAt: null,
    endsAt,
    isActive: true,
    autoApply: false,
    usageLimit: 1,
    perCustomerLimit: 1,
    firstOrderOnly: false,
    customerId: recipient.customerId,
    brandIds,
    categoryIds: template.categoryIds ?? [],
    source: opts.source,
  })
  return { ok: true, coupon, expiry: formatExpiry(endsAt) }
}

/** Removes a coupon that was created for a message that never got queued. Only unused coupons. */
export async function discardCoupon(couponId: string): Promise<void> {
  await db.coupon.deleteMany({ where: { id: couponId, usedCount: 0 } }).catch(() => {})
}
