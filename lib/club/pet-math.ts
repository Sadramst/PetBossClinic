/** Pure pet helpers: age, completeness, due status, weight trend, species labels. */

export const SPECIES_LABEL: Record<string, string> = {
  DOG: 'سگ',
  CAT: 'گربه',
  BIRD: 'پرنده',
  RABBIT: 'خرگوش',
  FISH: 'ماهی',
  REPTILE: 'خزنده',
  RODENT: 'جوندگان',
  OTHER: 'سایر',
}

export const SEX_LABEL: Record<string, string> = { MALE: 'نر', FEMALE: 'ماده', UNKNOWN: 'نامشخص' }

export const RECORD_KIND_LABEL: Record<string, string> = {
  VACCINE: 'واکسن',
  DEWORMING: 'ضدانگل',
  CHECKUP: 'معاینه',
  SURGERY: 'جراحی',
  GROOMING: 'گرومینگ',
  DENTAL: 'دندان‌پزشکی',
  WEIGHT: 'ثبت وزن',
  TREATMENT: 'درمان',
  NOTE: 'یادداشت',
}

/** Record kinds that normally repeat (shown with a next-due date). */
export const REPEATING_KINDS = ['VACCINE', 'DEWORMING', 'CHECKUP', 'DENTAL', 'GROOMING'] as const

export interface PetAge {
  years: number
  months: number
  totalMonths: number
}

/** Whole years and months between birth and `now` (never negative). */
export function computeAge(birthDate: Date | null | undefined, now: Date = new Date()): PetAge | null {
  if (!birthDate) return null
  let months = (now.getUTCFullYear() - birthDate.getUTCFullYear()) * 12 + (now.getUTCMonth() - birthDate.getUTCMonth())
  if (now.getUTCDate() < birthDate.getUTCDate()) months -= 1
  months = Math.max(0, months)
  return { years: Math.floor(months / 12), months: months % 12, totalMonths: months }
}

const FA_DIGITS = '۰۱۲۳۴۵۶۷۸۹'
export const faNum = (n: number): string => String(n).replace(/\d/g, (d) => FA_DIGITS[Number(d)])

/** "۲ سال و ۳ ماه", "۵ ماه", "کمتر از یک ماه" */
export function formatAge(age: PetAge | null): string {
  if (!age) return 'نامشخص'
  if (age.totalMonths < 1) return 'کمتر از یک ماه'
  const parts: string[] = []
  if (age.years > 0) parts.push(`${faNum(age.years)} سال`)
  if (age.months > 0) parts.push(`${faNum(age.months)} ماه`)
  return parts.join(' و ')
}

export interface CompletenessInput {
  name?: string | null
  species?: string | null
  breed?: string | null
  birthDate?: Date | null
  photoUrl?: string | null
  weightKg?: number | null
  sex?: string | null
  neutered?: boolean | null
  foodBrand?: string | null
  microchip?: string | null
  allergies?: string | null
}

const FIELDS: Array<{ key: string; label: string; ok: (p: CompletenessInput) => boolean; weight: number }> = [
  { key: 'breed', label: 'نژاد', ok: (p) => !!p.breed?.trim(), weight: 2 },
  { key: 'birthDate', label: 'تاریخ تولد', ok: (p) => !!p.birthDate, weight: 2 },
  { key: 'photo', label: 'عکس', ok: (p) => !!p.photoUrl, weight: 1 },
  { key: 'weight', label: 'وزن', ok: (p) => p.weightKg != null && p.weightKg > 0, weight: 1 },
  { key: 'sex', label: 'جنسیت', ok: (p) => !!p.sex && p.sex !== 'UNKNOWN', weight: 1 },
  { key: 'neutered', label: 'وضعیت عقیم‌سازی', ok: (p) => p.neutered != null, weight: 1 },
  { key: 'foodBrand', label: 'برند غذا', ok: (p) => !!p.foodBrand?.trim(), weight: 1 },
  { key: 'microchip', label: 'شماره میکروچیپ', ok: (p) => !!p.microchip?.trim(), weight: 1 },
]

export interface Completeness {
  percent: number
  missing: string[]
  /** The bonus rule: breed + birth date + (photo or weight) */
  bonusEligible: boolean
}

export function petCompleteness(p: CompletenessInput): Completeness {
  const total = FIELDS.reduce((s, f) => s + f.weight, 0)
  const done = FIELDS.reduce((s, f) => s + (f.ok(p) ? f.weight : 0), 0)
  return {
    percent: Math.round((done / total) * 100),
    missing: FIELDS.filter((f) => !f.ok(p)).map((f) => f.label),
    bonusEligible: isProfileBonusComplete(p),
  }
}

export function isProfileBonusComplete(p: CompletenessInput): boolean {
  return !!p.breed?.trim() && !!p.birthDate && (!!p.photoUrl || (p.weightKg != null && p.weightKg > 0))
}

export type DueStatus = 'overdue' | 'soon' | 'ok' | 'none'

/** overdue: past due; soon: within `soonDays`; ok: later; none: no due date. */
export function dueStatus(nextDueAt: Date | null | undefined, now: Date = new Date(), soonDays = 30): DueStatus {
  if (!nextDueAt) return 'none'
  const diff = nextDueAt.getTime() - now.getTime()
  if (diff < 0) return 'overdue'
  return diff <= soonDays * 86_400_000 ? 'soon' : 'ok'
}

export function daysUntil(date: Date, now: Date = new Date()): number {
  return Math.ceil((date.getTime() - now.getTime()) / 86_400_000)
}

export interface WeightPoint {
  at: Date
  kg: number
}

/** Oldest-first weight series from WEIGHT records, with the latest change. */
export function weightTrend(records: Array<{ kind: string; doneAt: Date; valueNumber: number | null }>): { points: WeightPoint[]; delta: number | null } {
  const points = records
    .filter((r) => r.kind === 'WEIGHT' && r.valueNumber != null && r.valueNumber > 0)
    .map((r) => ({ at: r.doneAt, kg: r.valueNumber as number }))
    .sort((a, b) => a.at.getTime() - b.at.getTime())
  const delta = points.length >= 2 ? Math.round((points[points.length - 1].kg - points[points.length - 2].kg) * 100) / 100 : null
  return { points, delta }
}
