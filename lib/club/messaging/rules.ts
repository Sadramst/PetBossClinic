/**
 * Pure messaging policy: what may be sent, to whom and when. No database, no I/O, so it is
 * unit-testable and shared by the outbox, campaigns, automations and the admin previews.
 */

/** At most this many marketing SMS per customer inside a rolling 24h window. */
export const MARKETING_DAILY_CAP = 1
export const QUIET_START_HOUR = 21
export const QUIET_END_HOUR = 9
/** Messages held back by quiet hours go out at 09:30 Tehran time. */
export const QUIET_RELEASE = { hour: 9, minute: 30 }
export const MAX_BODY_CHARS = 640
export const UNSUBSCRIBE_FOOTER = 'لغو: ارسال ۱'
export const MAX_ATTEMPTS = 3
/** Iran has had no daylight saving since 2022: Tehran is a fixed UTC+03:30. */
const TEHRAN_OFFSET_MS = (3 * 60 + 30) * 60_000

/** Kinds that are not marketing: consent, the daily cap and quiet hours do not apply. */
const TRANSACTIONAL_KINDS = new Set(['system'])

export function isMarketingKind(kind: string): boolean {
  return !TRANSACTIONAL_KINDS.has(kind)
}

/** Wall-clock parts in Tehran for any instant. */
export function tehranParts(date: Date): { year: number; month: number; day: number; hour: number; minute: number } {
  const t = new Date(date.getTime() + TEHRAN_OFFSET_MS)
  return { year: t.getUTCFullYear(), month: t.getUTCMonth() + 1, day: t.getUTCDate(), hour: t.getUTCHours(), minute: t.getUTCMinutes() }
}

export function isQuietHour(date: Date): boolean {
  const h = tehranParts(date).hour
  return h >= QUIET_START_HOUR || h < QUIET_END_HOUR
}

/** The same instant when it is a normal hour, otherwise the next 09:30 Tehran. */
export function nextSendTime(date: Date): Date {
  if (!isQuietHour(date)) return date
  const p = tehranParts(date)
  // After 21:00 the release is the next calendar day; before 09:00 it is the same day.
  const dayOffset = p.hour >= QUIET_START_HOUR ? 1 : 0
  const localMidnight = Date.UTC(p.year, p.month - 1, p.day + dayOffset)
  return new Date(localMidnight + (QUIET_RELEASE.hour * 60 + QUIET_RELEASE.minute) * 60_000 - TEHRAN_OFFSET_MS)
}

export interface SmsSegments {
  chars: number
  segments: number
  unicode: boolean
  perSegment: number
}

/** Persian text is sent as UCS-2: 70 characters in one part, 67 per part once it is split. */
export function countSegments(text: string): SmsSegments {
  const chars = Array.from(text).length
  const unicode = /[^\x00-\x7F]/.test(text)
  const single = unicode ? 70 : 160
  const multi = unicode ? 67 : 153
  const segments = chars === 0 ? 0 : chars <= single ? 1 : Math.ceil(chars / multi)
  return { chars, segments, unicode, perSegment: chars <= single ? single : multi }
}

export function withUnsubscribeFooter(body: string): string {
  const trimmed = body.trim()
  return trimmed.includes(UNSUBSCRIBE_FOOTER) ? trimmed : `${trimmed}\n${UNSUBSCRIBE_FOOTER}`
}

export interface ConsentFacts {
  isBlocked?: boolean
  marketingSmsConsent: boolean | null | undefined
  /** An unsubscribed MarketingContact exists for the phone. */
  unsubscribed?: boolean
}

export type ConsentVerdict = { ok: true } | { ok: false; reason: 'blocked' | 'no_consent' | 'unsubscribed' }

export function consentVerdict(f: ConsentFacts): ConsentVerdict {
  if (f.isBlocked) return { ok: false, reason: 'blocked' }
  if (f.unsubscribed) return { ok: false, reason: 'unsubscribed' }
  if (!f.marketingSmsConsent) return { ok: false, reason: 'no_consent' }
  return { ok: true }
}

/** Splits recipients into those who may receive marketing SMS and the excluded ones, with counts per reason. */
export function filterByConsent<T extends ConsentFacts>(list: T[]): { allowed: T[]; excluded: Record<string, number> } {
  const allowed: T[] = []
  const excluded: Record<string, number> = {}
  for (const item of list) {
    const v = consentVerdict(item)
    if (v.ok) allowed.push(item)
    else excluded[v.reason] = (excluded[v.reason] ?? 0) + 1
  }
  return { allowed, excluded }
}

export const SKIP_REASON_LABEL: Record<string, string> = {
  no_phone: 'شماره موبایل ندارد',
  invalid_phone: 'شماره موبایل نامعتبر است',
  blocked: 'حساب مسدود است',
  no_consent: 'رضایت دریافت پیامک ندارد',
  unsubscribed: 'پیامک را لغو کرده است',
  daily_cap: 'امروز پیام تبلیغاتی دریافت کرده است',
  duplicate: 'قبلاً برای او ثبت شده است',
  too_long: 'متن پیام بیش از حد بلند است',
  empty: 'متن پیام خالی است',
  no_pet_brand: 'برند غذای حیوان او مشخص یا در فروشگاه موجود نیست',
  no_customer: 'مشتری پیدا نشد',
}

/** Retry delay after a failed attempt (minutes): 15, then 60. */
export function retryDelayMinutes(attempt: number): number {
  return attempt <= 1 ? 15 : 60
}
