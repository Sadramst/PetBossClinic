// Pure CRM labels and helpers shared by server pages and client components (no db imports).
// tests/unit/crm-ui-labels.test.ts keeps these in lockstep with the server-side constants.

export type LeadStageKey = 'NEW' | 'CONTACTED' | 'QUALIFIED' | 'APPOINTMENT_BOOKED' | 'WON' | 'LOST'
export type LostReasonKey = 'NO_RESPONSE' | 'PRICE' | 'NOT_INTERESTED' | 'WENT_ELSEWHERE' | 'DUPLICATE' | 'OTHER'
export type TicketStatusKey = 'OPEN' | 'PENDING' | 'RESOLVED' | 'CLOSED'
export type TicketPriorityKey = 'LOW' | 'NORMAL' | 'HIGH'
export type TaskTypeKey = 'CALL' | 'SMS' | 'FOLLOW_UP' | 'VACCINE_REMINDER' | 'WIN_BACK' | 'CART' | 'OTHER'

export const LEAD_STAGE_ORDER: readonly LeadStageKey[] = ['NEW', 'CONTACTED', 'QUALIFIED', 'APPOINTMENT_BOOKED', 'WON', 'LOST']
export const LEAD_STAGE_LABEL: Record<LeadStageKey, string> = {
  NEW: 'جدید',
  CONTACTED: 'تماس گرفته شد',
  QUALIFIED: 'نیازسنجی شد',
  APPOINTMENT_BOOKED: 'نوبت ثبت شد',
  WON: 'تبدیل شد',
  LOST: 'از دست رفت',
}
export const LEAD_NEXT: Record<LeadStageKey, LeadStageKey[]> = {
  NEW: ['CONTACTED', 'QUALIFIED', 'LOST'],
  CONTACTED: ['QUALIFIED', 'APPOINTMENT_BOOKED', 'LOST', 'NEW'],
  QUALIFIED: ['APPOINTMENT_BOOKED', 'WON', 'LOST', 'CONTACTED'],
  APPOINTMENT_BOOKED: ['WON', 'LOST', 'QUALIFIED'],
  WON: [],
  LOST: ['NEW'],
}
export const LOST_REASON_LABEL: Record<LostReasonKey, string> = {
  NO_RESPONSE: 'پاسخ نداد',
  PRICE: 'قیمت',
  NOT_INTERESTED: 'علاقه‌ای نداشت',
  WENT_ELSEWHERE: 'جای دیگری رفت',
  DUPLICATE: 'تکراری',
  OTHER: 'سایر',
}
export const TICKET_STATUS_LABEL: Record<TicketStatusKey, string> = { OPEN: 'باز', PENDING: 'در انتظار مشتری', RESOLVED: 'حل‌شده', CLOSED: 'بسته' }
export const TICKET_NEXT: Record<TicketStatusKey, TicketStatusKey[]> = {
  OPEN: ['PENDING', 'RESOLVED', 'CLOSED'],
  PENDING: ['OPEN', 'RESOLVED', 'CLOSED'],
  RESOLVED: ['OPEN', 'CLOSED'],
  CLOSED: ['OPEN'],
}
export const PRIORITY_LABEL: Record<TicketPriorityKey, string> = { LOW: 'کم', NORMAL: 'عادی', HIGH: 'بالا' }
export const SLA_LABEL: Record<'ok' | 'due' | 'breached', string> = { ok: 'در مهلت', due: 'نزدیک مهلت', breached: 'مهلت گذشته' }
export const TASK_TYPE_LABEL: Record<TaskTypeKey, string> = {
  CALL: 'تماس',
  SMS: 'پیامک',
  FOLLOW_UP: 'پیگیری',
  VACCINE_REMINDER: 'یادآوری واکسن',
  WIN_BACK: 'بازگرداندن مشتری',
  CART: 'سبد خرید',
  OTHER: 'سایر',
}
export const TASK_PRIORITY_LABEL: Record<number, string> = { 1: 'فوری', 2: 'عادی', 3: 'کم‌اهمیت' }

const DAY = 86_400_000

/** Whole calendar-day distance between two instants in the local zone of the runtime (negative = past). */
export function dayDiff(target: Date, now: Date = new Date()): number {
  const a = new Date(target.getFullYear(), target.getMonth(), target.getDate()).getTime()
  const b = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
  return Math.round((a - b) / DAY)
}

const FA_DIGITS = '۰۱۲۳۴۵۶۷۸۹'
export const faNum = (n: number | string): string => String(n).replace(/\d/g, (d) => FA_DIGITS[Number(d)])

/** «امروز»، «فردا»، «۳ روز دیگر»، «۲ روز گذشته». */
export function relativeDayFa(target: Date | string | null, now: Date = new Date()): string {
  if (!target) return '—'
  const d = typeof target === 'string' ? new Date(target) : target
  if (Number.isNaN(d.getTime())) return '—'
  const n = dayDiff(d, now)
  if (n === 0) return 'امروز'
  if (n === 1) return 'فردا'
  if (n === -1) return 'دیروز'
  return n > 0 ? `${faNum(n)} روز دیگر` : `${faNum(-n)} روز گذشته`
}

/** Local ISO at 12:00 so a date-only pick survives timezone shifts. */
export function isoDayOffset(days: number, now: Date = new Date()): string {
  const d = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate() + days, 12))
  return d.toISOString()
}

/** Whole-name initials fallback for owner chips. */
export function ownerName(map: Record<string, string>, id: string | null | undefined): string {
  if (!id) return 'بدون مسئول'
  return map[id] ?? 'کاربر حذف‌شده'
}

/** Timeline filter chips: each group is a set of CrmActivity types (checked against the server catalogue in tests). */
export const TIMELINE_GROUPS: ReadonlyArray<{ id: string; label: string; types: readonly string[] }> = [
  { id: 'orders', label: 'سفارش‌ها', types: ['ORDER_PLACED', 'ORDER_PAID', 'ORDER_DELIVERED', 'ORDER_CANCELLED', 'CART_ABANDONED'] },
  { id: 'clinic', label: 'کلینیک', types: ['VISIT_LOGGED', 'PET_RECORD_ADDED', 'APPOINTMENT_REQUESTED', 'APPOINTMENT_STATUS_CHANGED'] },
  { id: 'messages', label: 'پیام‌ها', types: ['CONTACT_MESSAGE_RECEIVED', 'TICKET_REPLIED', 'TICKET_STATUS_CHANGED', 'SMS_SENT', 'SMS_FAILED', 'SMS_INBOUND'] },
  { id: 'points', label: 'امتیاز و کوپن', types: ['POINTS_AWARDED', 'POINTS_ADJUSTED', 'REWARD_REDEEMED', 'COUPON_ISSUED', 'COUPON_REDEEMED'] },
  { id: 'work', label: 'کار و یادداشت', types: ['NOTE_ADDED', 'TASK_CREATED', 'TASK_COMPLETED', 'OWNER_CHANGED'] },
  { id: 'lead', label: 'سرنخ', types: ['LEAD_CREATED', 'LEAD_STAGE_CHANGED', 'LEAD_PROMOTED', 'IMPORTED', 'CUSTOMER_MERGED', 'CONSENT_CHANGED'] },
]
