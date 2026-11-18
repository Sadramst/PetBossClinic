import { Prisma } from '@prisma/client'
import { db } from '@/lib/db'

/** Structured audience rules. Every condition that is set must match (AND). */
export interface SegmentRules {
  species?: Array<'DOG' | 'CAT' | 'BIRD' | 'RABBIT' | 'FISH' | 'REPTILE' | 'RODENT' | 'OTHER'>
  breedContains?: string
  foodBrandContains?: string
  petAgeMonths?: { min?: number; max?: number }
  tier?: string[]
  pointsMin?: number
  pointsMax?: number
  lastOrderDaysAgo?: { min?: number; max?: number }
  neverOrdered?: boolean
  totalSpentMin?: number
  totalSpentMax?: number
  ordersCountMin?: number
  city?: string
  tagsAny?: string[]
  birthdayMonth?: number
  hasPet?: boolean
  hasUnusedCoupon?: boolean
  hasAbandonedCart?: boolean
  vaccineDueWithinDays?: number
  /** Default true: only customers who agreed to marketing SMS. */
  smsConsentOnly?: boolean
  joinedWithinDays?: number
}

const SPECIES = ['DOG', 'CAT', 'BIRD', 'RABBIT', 'FISH', 'REPTILE', 'RODENT', 'OTHER']
const num = (v: unknown, lo: number, hi: number): number | undefined => {
  const n = typeof v === 'string' && v.trim() !== '' ? Number(v) : v
  return typeof n === 'number' && Number.isFinite(n) ? Math.min(hi, Math.max(lo, Math.floor(n))) : undefined
}
const str = (v: unknown, max = 60): string | undefined => (typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : undefined)
const range = (v: unknown, hi: number): { min?: number; max?: number } | undefined => {
  if (!v || typeof v !== 'object') return undefined
  const o = v as Record<string, unknown>
  const min = num(o.min, 0, hi)
  const max = num(o.max, 0, hi)
  return min === undefined && max === undefined ? undefined : { ...(min !== undefined ? { min } : {}), ...(max !== undefined ? { max } : {}) }
}

/** Cleans untrusted rules (from the admin form or a saved JSON column). Unknown keys are dropped. */
export function normalizeRules(raw: unknown): SegmentRules {
  if (!raw || typeof raw !== 'object') return {}
  const r = raw as Record<string, unknown>
  const out: SegmentRules = {}
  if (Array.isArray(r.species)) {
    const s = r.species.filter((x): x is NonNullable<SegmentRules['species']>[number] => typeof x === 'string' && SPECIES.includes(x))
    if (s.length) out.species = [...new Set(s)]
  }
  const breed = str(r.breedContains, 40)
  if (breed) out.breedContains = breed
  const food = str(r.foodBrandContains, 60)
  if (food) out.foodBrandContains = food
  const age = range(r.petAgeMonths, 600)
  if (age) out.petAgeMonths = age
  if (Array.isArray(r.tier)) {
    const t = r.tier.filter((x): x is string => typeof x === 'string' && /^[A-Z][A-Z0-9_]{1,19}$/.test(x)).slice(0, 8)
    if (t.length) out.tier = t
  }
  const pMin = num(r.pointsMin, 0, 1e9)
  const pMax = num(r.pointsMax, 0, 1e9)
  if (pMin !== undefined) out.pointsMin = pMin
  if (pMax !== undefined) out.pointsMax = pMax
  const last = range(r.lastOrderDaysAgo, 3650)
  if (last) out.lastOrderDaysAgo = last
  if (r.neverOrdered === true) out.neverOrdered = true
  const sMin = num(r.totalSpentMin, 0, 1e12)
  const sMax = num(r.totalSpentMax, 0, 1e12)
  if (sMin !== undefined) out.totalSpentMin = sMin
  if (sMax !== undefined) out.totalSpentMax = sMax
  const oc = num(r.ordersCountMin, 0, 100000)
  if (oc !== undefined && oc > 0) out.ordersCountMin = oc
  const city = str(r.city, 40)
  if (city) out.city = city
  if (Array.isArray(r.tagsAny)) {
    const t = r.tagsAny.filter((x): x is string => typeof x === 'string' && x.trim() !== '').map((x) => x.trim().slice(0, 30)).slice(0, 20)
    if (t.length) out.tagsAny = t
  }
  const bm = num(r.birthdayMonth, 1, 12)
  if (bm !== undefined && bm >= 1) out.birthdayMonth = bm
  if (typeof r.hasPet === 'boolean') out.hasPet = r.hasPet
  if (r.hasUnusedCoupon === true) out.hasUnusedCoupon = true
  if (r.hasAbandonedCart === true) out.hasAbandonedCart = true
  const vd = num(r.vaccineDueWithinDays, 0, 365)
  if (vd !== undefined) out.vaccineDueWithinDays = vd
  out.smsConsentOnly = r.smsConsentOnly === false ? false : true
  const jw = num(r.joinedWithinDays, 1, 3650)
  if (jw !== undefined) out.joinedWithinDays = jw
  return out
}

const addMonths = (d: Date, m: number) => {
  const x = new Date(d)
  x.setUTCMonth(x.getUTCMonth() + m)
  return x
}
const daysAgo = (now: Date, n: number) => new Date(now.getTime() - n * 86_400_000)

/** Hours without activity after which a cart counts as abandoned in segments. */
export const ABANDONED_CART_HOURS = 3

/**
 * Pure translation of rules into a Prisma filter. `birthdayIds` must be supplied when
 * birthdayMonth is set (see resolveSegmentWhere; month extraction needs SQL).
 */
export function buildSegmentWhere(rulesIn: SegmentRules, now: Date = new Date(), birthdayIds?: string[]): Prisma.CustomerWhereInput {
  const rules = normalizeRules(rulesIn)
  const and: Prisma.CustomerWhereInput[] = [{ isBlocked: false }]
  if (rules.smsConsentOnly !== false) and.push({ marketingSmsConsent: true })

  // All conditions about "a pet" must hold for the SAME pet.
  const pet: Prisma.PetWhereInput = { isActive: true, deceasedAt: null }
  let petFilter = false
  if (rules.species?.length) { pet.species = { in: rules.species }; petFilter = true }
  if (rules.breedContains) { pet.breed = { contains: rules.breedContains, mode: 'insensitive' }; petFilter = true }
  if (rules.foodBrandContains) { pet.foodBrand = { contains: rules.foodBrandContains, mode: 'insensitive' }; petFilter = true }
  if (rules.petAgeMonths) {
    const { min, max } = rules.petAgeMonths
    const bd: Prisma.DateTimeNullableFilter = {}
    if (min !== undefined) bd.lte = addMonths(now, -min)
    if (max !== undefined) bd.gt = addMonths(now, -(max + 1))
    pet.birthDate = bd
    petFilter = true
  }
  if (rules.vaccineDueWithinDays !== undefined) {
    pet.records = { some: { nextDueAt: { lte: new Date(now.getTime() + rules.vaccineDueWithinDays * 86_400_000) }, kind: { in: ['VACCINE', 'DEWORMING', 'CHECKUP'] } } }
    petFilter = true
  }
  if (petFilter || rules.hasPet === true) and.push({ pets: { some: pet } })
  if (rules.hasPet === false) and.push({ pets: { none: { isActive: true } } })

  if (rules.tier?.length) and.push({ tier: { in: rules.tier } })
  if (rules.pointsMin !== undefined || rules.pointsMax !== undefined) {
    and.push({ pointsBalance: { ...(rules.pointsMin !== undefined ? { gte: rules.pointsMin } : {}), ...(rules.pointsMax !== undefined ? { lte: rules.pointsMax } : {}) } })
  }
  if (rules.neverOrdered) and.push({ ordersCount: 0 })
  if (rules.lastOrderDaysAgo) {
    const { min, max } = rules.lastOrderDaysAgo
    and.push({ lastOrderAt: { ...(min !== undefined ? { lte: daysAgo(now, min) } : {}), ...(max !== undefined ? { gte: daysAgo(now, max) } : {}) } })
  }
  if (rules.totalSpentMin !== undefined || rules.totalSpentMax !== undefined) {
    and.push({ totalSpent: { ...(rules.totalSpentMin !== undefined ? { gte: rules.totalSpentMin } : {}), ...(rules.totalSpentMax !== undefined ? { lte: rules.totalSpentMax } : {}) } })
  }
  if (rules.ordersCountMin !== undefined) and.push({ ordersCount: { gte: rules.ordersCountMin } })
  if (rules.city) and.push({ city: { contains: rules.city, mode: 'insensitive' } })
  if (rules.tagsAny?.length) and.push({ tags: { hasSome: rules.tagsAny } })
  if (rules.birthdayMonth !== undefined) and.push({ id: { in: birthdayIds ?? [] } })
  if (rules.hasUnusedCoupon) {
    and.push({ coupons: { some: { isActive: true, usedCount: 0, OR: [{ endsAt: null }, { endsAt: { gt: now } }] } } })
  }
  if (rules.hasAbandonedCart) {
    and.push({ cartSnapshot: { is: { itemCount: { gt: 0 }, updatedAt: { lt: new Date(now.getTime() - ABANDONED_CART_HOURS * 3_600_000) } } } })
  }
  if (rules.joinedWithinDays !== undefined) and.push({ createdAt: { gte: daysAgo(now, rules.joinedWithinDays) } })
  return { AND: and }
}

/** Like buildSegmentWhere, resolving the birthday month through SQL when needed. */
export async function resolveSegmentWhere(rulesIn: SegmentRules, now: Date = new Date()): Promise<Prisma.CustomerWhereInput> {
  const rules = normalizeRules(rulesIn)
  let ids: string[] | undefined
  if (rules.birthdayMonth !== undefined) {
    const rows = await db.$queryRaw<{ id: string }[]>`SELECT "id" FROM "Customer" WHERE "birthDate" IS NOT NULL AND EXTRACT(MONTH FROM "birthDate") = ${rules.birthdayMonth}`
    ids = rows.map((r) => r.id)
  }
  return buildSegmentWhere(rules, now, ids)
}

export interface SegmentPreview {
  count: number
  /** Customers matching everything except the SMS-consent condition who are left out for lack of consent */
  consentExcluded: number
  sample: Array<{ id: string; name: string; phone: string; tier: string; pointsBalance: number; petNames: string[] }>
}

export async function countSegment(rules: SegmentRules, now = new Date()): Promise<number> {
  return db.customer.count({ where: await resolveSegmentWhere(rules, now) })
}

export async function previewSegment(rules: SegmentRules, sampleSize = 8, now = new Date()): Promise<SegmentPreview> {
  const norm = normalizeRules(rules)
  const where = await resolveSegmentWhere(norm, now)
  const [count, rows, withoutConsent] = await Promise.all([
    db.customer.count({ where }),
    db.customer.findMany({
      where,
      take: Math.min(50, Math.max(1, sampleSize)),
      orderBy: { createdAt: 'desc' },
      select: { id: true, firstName: true, lastName: true, phone: true, tier: true, pointsBalance: true, pets: { where: { isActive: true }, select: { name: true }, take: 4 } },
    }),
    norm.smsConsentOnly !== false ? db.customer.count({ where: await resolveSegmentWhere({ ...norm, smsConsentOnly: false }, now) }) : Promise.resolve(0),
  ])
  return {
    count,
    consentExcluded: norm.smsConsentOnly !== false ? Math.max(0, withoutConsent - count) : 0,
    sample: rows.map((c) => ({
      id: c.id,
      name: [c.firstName, c.lastName].filter(Boolean).join(' ') || 'بدون نام',
      phone: c.phone,
      tier: c.tier,
      pointsBalance: c.pointsBalance,
      petNames: c.pets.map((p) => p.name),
    })),
  }
}

/** Ids of every customer in the audience (capped), for launching campaigns. */
export async function segmentCustomerIds(rules: SegmentRules, cap = 20_000, now = new Date()): Promise<string[]> {
  const rows = await db.customer.findMany({ where: await resolveSegmentWhere(rules, now), select: { id: true }, take: cap, orderBy: { createdAt: 'asc' } })
  return rows.map((r) => r.id)
}
