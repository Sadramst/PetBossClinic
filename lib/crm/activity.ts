import { db } from '@/lib/db'
import { newId, type DbClient } from '@/lib/crm/types'

/** Event catalogue (CRM-SPEC section 5). Labels are the Persian copy shown on the timeline. */
export const ACTIVITY_LABELS_FA = {
  LEAD_CREATED: 'درخواست جدید ثبت شد',
  LEAD_STAGE_CHANGED: 'مرحلهٔ سرنخ تغییر کرد',
  LEAD_PROMOTED: 'سرنخ به مشتری تبدیل شد',
  CONTACT_MESSAGE_RECEIVED: 'پیام جدید رسید',
  TICKET_REPLIED: 'به پیام پاسخ داده شد',
  TICKET_STATUS_CHANGED: 'وضعیت پیام تغییر کرد',
  NOTE_ADDED: 'یادداشت ثبت شد',
  TASK_CREATED: 'کار جدید ایجاد شد',
  TASK_COMPLETED: 'کار انجام شد',
  ORDER_PLACED: 'سفارش ثبت شد',
  ORDER_PAID: 'سفارش پرداخت شد',
  ORDER_DELIVERED: 'سفارش تحویل شد',
  ORDER_CANCELLED: 'سفارش لغو شد',
  VISIT_LOGGED: 'مراجعه به کلینیک ثبت شد',
  PET_RECORD_ADDED: 'سابقهٔ سلامت حیوان ثبت شد',
  POINTS_AWARDED: 'امتیاز دریافت شد',
  POINTS_ADJUSTED: 'امتیاز اصلاح شد',
  REWARD_REDEEMED: 'جایزه دریافت شد',
  COUPON_ISSUED: 'کد تخفیف صادر شد',
  COUPON_REDEEMED: 'کد تخفیف استفاده شد',
  SMS_SENT: 'پیامک ارسال شد',
  SMS_FAILED: 'ارسال پیامک ناموفق بود',
  SMS_INBOUND: 'پیامک دریافتی',
  CONSENT_CHANGED: 'رضایت دریافت پیام تغییر کرد',
  CART_ABANDONED: 'سبد خرید رها شد',
  APPOINTMENT_REQUESTED: 'درخواست نوبت ثبت شد',
  APPOINTMENT_STATUS_CHANGED: 'وضعیت نوبت تغییر کرد',
  CUSTOMER_MERGED: 'پروندهٔ تکراری ادغام شد',
  OWNER_CHANGED: 'مسئول پرونده تغییر کرد',
  IMPORTED: 'از فایل وارد شد',
} as const

export type ActivityType = keyof typeof ACTIVITY_LABELS_FA
export const ACTIVITY_TYPES = Object.keys(ACTIVITY_LABELS_FA) as ActivityType[]

export function isActivityType(v: string): v is ActivityType {
  return Object.prototype.hasOwnProperty.call(ACTIVITY_LABELS_FA, v)
}

export type ActivityInput = {
  type: ActivityType
  summary: string
  contactId?: string | null
  customerId?: string | null
  actorUserId?: string | null
  refType?: string
  refId?: string
  meta?: Record<string, unknown>
  occurredAt?: Date
}

export type ActivityRow = {
  id: string
  type: ActivityType | string
  label: string
  summary: string
  contactId: string | null
  customerId: string | null
  actorUserId: string | null
  refType: string
  refId: string
  meta: Record<string, unknown> | null
  occurredAt: Date
}

/**
 * Appends one event. Idempotent on (type, refType, refId): a repeated call with the same reference does
 * nothing. An event without a reference is always new. Never throws into the caller.
 */
export async function recordActivity(input: ActivityInput, tx?: DbClient): Promise<void> {
  try {
    const client: DbClient = tx ?? db
    const hasRef = !!input.refId
    await client.crmActivity.createMany({
      data: [
        {
          id: newId(),
          type: input.type,
          summary: input.summary.slice(0, 300),
          contactId: input.contactId ?? null,
          customerId: input.customerId ?? null,
          actorUserId: input.actorUserId ?? null,
          refType: hasRef ? (input.refType ?? '') : 'auto',
          refId: hasRef ? input.refId! : newId(),
          meta: (input.meta ?? undefined) as never,
          occurredAt: input.occurredAt ?? new Date(),
        },
      ],
      skipDuplicates: true,
    })
  } catch (err) {
    console.error('crm activity failed', (err as Error)?.name, (err as Error)?.message?.slice(0, 120))
  }
}

type RawActivity = {
  id: string
  type: string
  summary: string
  contactId: string | null
  customerId: string | null
  actorUserId: string | null
  refType: string
  refId: string
  meta: unknown
  occurredAt: Date
}

export function toActivityRow(r: RawActivity): ActivityRow {
  return {
    id: r.id,
    type: r.type,
    label: isActivityType(r.type) ? ACTIVITY_LABELS_FA[r.type] : r.type,
    summary: r.summary,
    contactId: r.contactId,
    customerId: r.customerId,
    actorUserId: r.actorUserId,
    refType: r.refType,
    refId: r.refId,
    meta: (r.meta as Record<string, unknown> | null) ?? null,
    occurredAt: r.occurredAt,
  }
}

/** Newest first, cursor paginated (the cursor is the id of the last row seen). */
export async function listActivity(args: {
  customerId?: string
  contactId?: string
  types?: ActivityType[]
  cursor?: string
  take?: number
}): Promise<{ items: ActivityRow[]; nextCursor: string | null }> {
  const take = Math.min(100, Math.max(1, Math.floor(args.take ?? 30)))
  const or = [args.customerId ? { customerId: args.customerId } : null, args.contactId ? { contactId: args.contactId } : null].filter(Boolean) as Array<{ customerId: string } | { contactId: string }>
  if (or.length === 0) return { items: [], nextCursor: null }
  const rows = await db.crmActivity.findMany({
    where: { OR: or, ...(args.types?.length ? { type: { in: args.types } } : {}) },
    orderBy: [{ occurredAt: 'desc' }, { id: 'desc' }],
    take: take + 1,
    ...(args.cursor ? { cursor: { id: args.cursor }, skip: 1 } : {}),
  })
  const more = rows.length > take
  const page = more ? rows.slice(0, take) : rows
  return { items: page.map(toActivityRow), nextCursor: more ? page[page.length - 1].id : null }
}
