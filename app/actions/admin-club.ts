'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import type { Role } from '@prisma/client'
import { db } from '@/lib/db'
import { getSessionWithRole } from '@/lib/auth'
import { logAdminChange } from '@/lib/audit'
import { checkRateLimit } from '@/lib/utils/rate-limit'
import { normalizeFa } from '@/lib/text/persian'
import {
  createCustomerByAdmin,
  updateCustomerByAdmin,
  addCustomerNote,
  customersCsv,
  type AdminCustomerInput,
  type CustomerFilters,
} from '@/lib/club/customers-admin'
import { createPetFor, updatePetFor, deletePetFor, addRecordFor, deleteRecordFor, type PetInput, type PetRecordInput } from '@/lib/club/pets'
import { recordVisit, updateVisit, deleteVisit, type VisitInput } from '@/lib/club/visits'
import { adjustPoints } from '@/lib/club/points'
import { getLoyaltyConfig, updateLoyaltyConfig } from '@/lib/club/config'
import { validateTiers, parseTiers, type TierDef } from '@/lib/club/tiers'
import { normalizeRules, previewSegment, type SegmentPreview } from '@/lib/club/segments'
import { buildInsights, draftMessage, factsForCustomer, DRAFT_GOALS, DRAFT_TONES, type DraftGoal, type DraftTone } from '@/lib/club/ai'
import { enqueueMessage, processOutbox, retryMessage, cancelMessage } from '@/lib/club/messaging/outbox'
import { senderStatus } from '@/lib/club/messaging/sender'
import { createCampaignDraft, previewCampaign, launchCampaign, cancelCampaign, getCampaign, type CampaignPreview, type CampaignInput } from '@/lib/club/campaigns'
import { updateAutomationRule, generateAutomationMessages, type AutomationRun } from '@/lib/club/automations'
import { loadRecipient, baseVars, issueRecipientCoupon, normalizeCouponTemplate } from '@/lib/club/messaging/personalize'
import { renderTemplate } from '@/lib/club/messaging/render'
import { getCartSnapshot } from '@/lib/club/cart'

export interface ClubResult<T = Record<string, never>> {
  ok: boolean
  error?: string
  data?: T
}

const DENIED = 'دسترسی غیرمجاز؛ این کار نیاز به نقش بالاتری دارد.'
const BUSY = 'تعداد درخواست‌ها زیاد است؛ کمی صبر کنید و دوباره تلاش کنید.'
const GENERIC = 'خطایی رخ داد. دوباره تلاش کنید.'

type Guard = { ok: true; userId: string; role: Role } | { ok: false; error: string }

async function guard(min: Role = 'EDITOR', kind: 'write' | 'export' | 'ai' = 'write'): Promise<Guard> {
  const session = await getSessionWithRole(min)
  if (!session) return { ok: false, error: DENIED }
  const limits = { write: [150, 60_000], export: [10, 60_000], ai: [20, 60_000] } as const
  const [max, win] = limits[kind]
  if (!checkRateLimit(`adm-club-${kind}:${session.userId}`, max, win).allowed) return { ok: false, error: BUSY }
  return { ok: true, userId: session.userId, role: session.role }
}

const CUSTOMER = '/admin/customers'
const refreshCustomer = (id: string) => {
  revalidatePath(`${CUSTOMER}/${id}`)
  revalidatePath(CUSTOMER)
}

async function adminName(userId: string): Promise<string | null> {
  const u = await db.user.findUnique({ where: { id: userId }, select: { name: true } }).catch(() => null)
  return u?.name ?? null
}

/* ----------------------------------------------------------------- customers */

export async function createCustomerAction(input: AdminCustomerInput): Promise<ClubResult<{ id: string }>> {
  const g = await guard()
  if (!g.ok) return { ok: false, error: g.error }
  const res = await createCustomerByAdmin(input)
  if (!res.ok || !res.id) return { ok: false, error: res.error ?? GENERIC }
  await logAdminChange({ action: 'CREATE', entity: 'CUSTOMER', entityId: res.id, after: { phone: (input as { phone?: string }).phone, createdByAdmin: true } })
  revalidatePath(CUSTOMER)
  return { ok: true, data: { id: res.id } }
}

export async function updateCustomerAction(customerId: string, input: AdminCustomerInput): Promise<ClubResult> {
  const g = await guard()
  if (!g.ok) return { ok: false, error: g.error }
  const before = await db.customer.findUnique({ where: { id: customerId }, select: { firstName: true, lastName: true, phone: true, email: true, city: true, tags: true, marketingSmsConsent: true } })
  const res = await updateCustomerByAdmin(customerId, input)
  if (!res.ok) return { ok: false, error: res.error ?? GENERIC }
  await logAdminChange({ action: 'UPDATE', entity: 'CUSTOMER', entityId: customerId, before, after: { ...(input as object), notes: undefined } })
  refreshCustomer(customerId)
  return { ok: true }
}

export async function addCustomerNoteAction(customerId: string, body: string): Promise<ClubResult> {
  const g = await guard()
  if (!g.ok) return { ok: false, error: g.error }
  const res = await addCustomerNote(customerId, g.userId, await adminName(g.userId), body)
  if (!res.ok) return { ok: false, error: res.error ?? GENERIC }
  await logAdminChange({ action: 'CREATE', entity: 'CUSTOMER_NOTE', entityId: res.id ?? customerId, details: { customerId } })
  refreshCustomer(customerId)
  return { ok: true }
}

export async function exportCustomersCsvAction(filters: CustomerFilters): Promise<ClubResult<{ csv: string }>> {
  const g = await guard('EDITOR', 'export')
  if (!g.ok) return { ok: false, error: g.error }
  const csv = await customersCsv({ ...filters, page: undefined })
  await logAdminChange({ action: 'EXPORT', entity: 'CUSTOMER', entityId: 'csv', details: { filters } })
  return { ok: true, data: { csv } }
}

/** Customers with orders cannot be deleted (they are history); block them instead. */
export async function deleteCustomerAction(customerId: string): Promise<ClubResult> {
  const g = await guard('ADMIN')
  if (!g.ok) return { ok: false, error: g.error }
  const c = await db.customer.findUnique({ where: { id: customerId }, select: { phone: true, _count: { select: { orders: true } } } })
  if (!c) return { ok: false, error: 'مشتری پیدا نشد.' }
  if (c._count.orders > 0) return { ok: false, error: 'این مشتری سفارش ثبت‌شده دارد و حذف نمی‌شود. در صورت نیاز او را مسدود کنید.' }
  try {
    await db.customer.delete({ where: { id: customerId } })
  } catch {
    return { ok: false, error: 'حذف انجام نشد؛ اطلاعات وابسته‌ای وجود دارد. به‌جای حذف، مشتری را مسدود کنید.' }
  }
  await logAdminChange({ action: 'DELETE', entity: 'CUSTOMER', entityId: customerId, before: { phone: c.phone } })
  revalidatePath(CUSTOMER)
  return { ok: true }
}

/* ---------------------------------------------------------------------- pets */

export async function adminCreatePetAction(customerId: string, input: PetInput): Promise<ClubResult<{ id: string }>> {
  const g = await guard()
  if (!g.ok) return { ok: false, error: g.error }
  const r = await createPetFor(customerId, input)
  if (!r.ok || !r.id) return { ok: false, error: r.error ?? GENERIC }
  await logAdminChange({ action: 'CREATE', entity: 'PET', entityId: r.id, after: { customerId, name: (input as { name?: string }).name } })
  refreshCustomer(customerId)
  return { ok: true, data: { id: r.id } }
}

export async function adminUpdatePetAction(customerId: string, petId: string, input: PetInput): Promise<ClubResult> {
  const g = await guard()
  if (!g.ok) return { ok: false, error: g.error }
  const r = await updatePetFor(customerId, petId, input)
  if (!r.ok) return { ok: false, error: r.error ?? GENERIC }
  await logAdminChange({ action: 'UPDATE', entity: 'PET', entityId: petId, after: { customerId } })
  refreshCustomer(customerId)
  return { ok: true }
}

export async function adminDeletePetAction(customerId: string, petId: string): Promise<ClubResult> {
  const g = await guard()
  if (!g.ok) return { ok: false, error: g.error }
  const r = await deletePetFor(customerId, petId)
  if (!r.ok) return { ok: false, error: r.error ?? GENERIC }
  await logAdminChange({ action: 'DELETE', entity: 'PET', entityId: petId, details: { customerId, soft: true } })
  refreshCustomer(customerId)
  return { ok: true }
}

export async function adminAddRecordAction(customerId: string, petId: string, input: PetRecordInput): Promise<ClubResult> {
  const g = await guard()
  if (!g.ok) return { ok: false, error: g.error }
  const r = await addRecordFor(customerId, petId, input, 'admin')
  if (!r.ok) return { ok: false, error: r.error ?? GENERIC }
  await logAdminChange({ action: 'CREATE', entity: 'PET_RECORD', entityId: r.id ?? petId, details: { customerId, petId } })
  refreshCustomer(customerId)
  return { ok: true }
}

export async function adminDeleteRecordAction(customerId: string, recordId: string): Promise<ClubResult> {
  const g = await guard()
  if (!g.ok) return { ok: false, error: g.error }
  const r = await deleteRecordFor(customerId, recordId, { allowVisitRecords: true })
  if (!r.ok) return { ok: false, error: r.error ?? GENERIC }
  await logAdminChange({ action: 'DELETE', entity: 'PET_RECORD', entityId: recordId, details: { customerId } })
  refreshCustomer(customerId)
  return { ok: true }
}

/* -------------------------------------------------------------------- visits */

export async function recordVisitAction(customerId: string, input: VisitInput, record?: PetRecordInput): Promise<ClubResult<{ pointsAwarded: number }>> {
  const g = await guard()
  if (!g.ok) return { ok: false, error: g.error }
  const r = await recordVisit(g.userId, customerId, input, record ? { record } : {})
  if (!r.ok || !r.id) return { ok: false, error: r.error ?? GENERIC }
  await logAdminChange({ action: 'CREATE', entity: 'SERVICE_VISIT', entityId: r.id, after: { customerId, ...(input as object) }, details: { pointsAwarded: r.pointsAwarded } })
  refreshCustomer(customerId)
  return { ok: true, data: { pointsAwarded: r.pointsAwarded ?? 0 } }
}

export async function updateVisitAction(customerId: string, visitId: string, input: VisitInput): Promise<ClubResult> {
  const g = await guard()
  if (!g.ok) return { ok: false, error: g.error }
  const owned = await db.serviceVisit.findFirst({ where: { id: visitId, customerId }, select: { id: true } })
  if (!owned) return { ok: false, error: 'سابقه‌ی مراجعه پیدا نشد.' }
  const r = await updateVisit(g.userId, visitId, input)
  if (!r.ok) return { ok: false, error: r.error ?? GENERIC }
  await logAdminChange({ action: 'UPDATE', entity: 'SERVICE_VISIT', entityId: visitId, after: { customerId, ...(input as object) } })
  refreshCustomer(customerId)
  return { ok: true }
}

export async function deleteVisitAction(customerId: string, visitId: string): Promise<ClubResult> {
  const g = await guard()
  if (!g.ok) return { ok: false, error: g.error }
  const owned = await db.serviceVisit.findFirst({ where: { id: visitId, customerId }, select: { id: true, amount: true, serviceName: true } })
  if (!owned) return { ok: false, error: 'سابقه‌ی مراجعه پیدا نشد.' }
  const r = await deleteVisit(g.userId, visitId)
  if (!r.ok) return { ok: false, error: r.error ?? GENERIC }
  await logAdminChange({ action: 'DELETE', entity: 'SERVICE_VISIT', entityId: visitId, before: owned, details: { customerId } })
  refreshCustomer(customerId)
  return { ok: true }
}

/* -------------------------------------------------------------------- points */

/** Adjustments above ±1000 points need the ADMIN role; a written reason is always required. */
export async function adjustPointsAction(customerId: string, points: number, note: string): Promise<ClubResult<{ balance: number }>> {
  const g = await guard()
  if (!g.ok) return { ok: false, error: g.error }
  const n = Math.trunc(Number(points))
  const reason = normalizeFa(note ?? '').trim().slice(0, 200)
  if (!Number.isFinite(n) || n === 0) return { ok: false, error: 'تعداد امتیاز را (مثبت یا منفی) وارد کنید.' }
  if (Math.abs(n) > 100_000) return { ok: false, error: 'حداکثر ۱۰۰٬۰۰۰ امتیاز در هر تعدیل مجاز است.' }
  if (reason.length < 3) return { ok: false, error: 'دلیل تعدیل را بنویسید؛ این متن در سابقه‌ی مشتری ثبت می‌شود.' }
  if (Math.abs(n) > 1000) {
    const strong = await getSessionWithRole('ADMIN')
    if (!strong) return { ok: false, error: 'تعدیل بیش از ۱٬۰۰۰ امتیاز فقط توسط مدیر انجام می‌شود.' }
  }
  const exists = await db.customer.findUnique({ where: { id: customerId }, select: { id: true } })
  if (!exists) return { ok: false, error: 'مشتری پیدا نشد.' }
  const r = await adjustPoints(db, { customerId, points: n, note: reason, adminId: g.userId })
  if (!r.ok) return { ok: false, error: 'تعدیل انجام نشد.' }
  await logAdminChange({ action: 'UPDATE', entity: 'CUSTOMER_POINTS', entityId: customerId, details: { points: n, note: reason, balance: r.balance } })
  refreshCustomer(customerId)
  return { ok: true, data: { balance: r.balance } }
}

/* ------------------------------------------------------------------- coupons */

const couponTplSchema = z.object({
  type: z.enum(['PERCENT', 'FIXED', 'FREE_SHIPPING']),
  value: z.coerce.number().int().min(0).max(100_000_000),
  maxDiscount: z.coerce.number().int().min(0).max(100_000_000).nullish(),
  minSubtotal: z.coerce.number().int().min(0).max(1_000_000_000).default(0),
  validDays: z.coerce.number().int().min(1).max(365).default(14),
  restrictToPetBrand: z.boolean().optional(),
})
export type PersonalCouponInput = z.input<typeof couponTplSchema>

export async function createPersonalCouponAction(customerId: string, input: PersonalCouponInput, petId?: string | null): Promise<ClubResult<{ code: string }>> {
  const g = await guard()
  if (!g.ok) return { ok: false, error: g.error }
  const p = couponTplSchema.safeParse(input)
  if (!p.success) return { ok: false, error: p.error.issues[0]?.message ?? 'مقدار تخفیف معتبر نیست.' }
  const t = p.data
  if (t.type === 'PERCENT' && (t.value < 1 || t.value > 100)) return { ok: false, error: 'درصد تخفیف باید بین ۱ تا ۱۰۰ باشد.' }
  if (t.type === 'FIXED' && t.value < 1000) return { ok: false, error: 'مبلغ تخفیف را به تومان وارد کنید.' }
  const tpl = normalizeCouponTemplate(t)
  if (!tpl) return { ok: false, error: 'تنظیمات کد تخفیف معتبر نیست.' }
  const rec = await loadRecipient(customerId, petId)
  if (!rec) return { ok: false, error: 'مشتری پیدا نشد.' }
  const issued = await issueRecipientCoupon(rec, tpl, { source: 'admin', title: 'کد اختصاصی از طرف پت‌باس' })
  if (!issued.ok) return { ok: false, error: 'برند غذای حیوان این مشتری ثبت نشده یا در فروشگاه موجود نیست؛ محدودیت برند را بردارید.' }
  await logAdminChange({ action: 'CREATE', entity: 'COUPON', entityId: issued.coupon.id, after: { customerId, code: issued.coupon.code, type: t.type, value: t.value } })
  refreshCustomer(customerId)
  return { ok: true, data: { code: issued.coupon.code } }
}

/* ----------------------------------------------------------------- messaging */

const REASON_FA: Record<string, string> = {
  no_phone: 'شماره‌ای ثبت نشده است.',
  invalid_phone: 'شماره موبایل معتبر نیست.',
  blocked: 'این مشتری مسدود است.',
  no_consent: 'مشتری رضایت دریافت پیامک تبلیغاتی را نداده است.',
  unsubscribed: 'مشتری دریافت پیامک را لغو کرده است.',
  daily_cap: 'امروز یک پیامک تبلیغاتی برای این مشتری ارسال یا در صف است.',
  duplicate: 'این پیام قبلاً در صف قرار گرفته است.',
  too_long: 'متن پیام بیش از حد بلند است.',
  empty: 'متن پیام را بنویسید.',
}

export async function sendCustomerMessageAction(customerId: string, body: string, petId?: string | null): Promise<ClubResult<{ text: string }>> {
  const g = await guard()
  if (!g.ok) return { ok: false, error: g.error }
  const rec = await loadRecipient(customerId, petId)
  if (!rec) return { ok: false, error: 'مشتری پیدا نشد.' }
  const text = renderTemplate(String(body ?? '').slice(0, 1000), baseVars(rec)).trim()
  const r = await enqueueMessage({ customerId, body: text, kind: 'admin', bypassDailyCap: true })
  if (!r.ok) return { ok: false, error: REASON_FA[r.reason] ?? GENERIC }
  await logAdminChange({ action: 'CREATE', entity: 'MESSAGE', entityId: r.id, details: { customerId, kind: 'admin' } })
  refreshCustomer(customerId)
  return { ok: true, data: { text: r.body } }
}

export async function draftMessageAction(goal: string, tone: string, customerId?: string | null): Promise<ClubResult<{ options: string[]; source: 'ai' | 'fallback' }>> {
  const g = await guard('EDITOR', 'ai')
  if (!g.ok) return { ok: false, error: g.error }
  const gl = (DRAFT_GOALS as readonly string[]).includes(goal) ? (goal as DraftGoal) : 'promo'
  const tn = (DRAFT_TONES as readonly string[]).includes(tone) ? (tone as DraftTone) : 'friendly'
  const facts = customerId ? await factsForCustomer(customerId).catch(() => ({})) : {}
  const r = await draftMessage({ goal: gl, tone: tn, facts })
  return { ok: true, data: r }
}

/** Runs one AI-insight suggestion. The insight is rebuilt on the server, never trusted from the browser. */
export async function applyInsightAction(customerId: string, insightId: string): Promise<ClubResult<{ message: string }>> {
  const g = await guard()
  if (!g.ok) return { ok: false, error: g.error }
  const insight = (await buildInsights(customerId)).find((i) => i.id === insightId)
  if (!insight) return { ok: false, error: 'این پیشنهاد دیگر معتبر نیست؛ صفحه را تازه کنید.' }
  const a = insight.action
  if (a.type === 'task') {
    await addCustomerNote(customerId, g.userId, await adminName(g.userId), `کار پیشنهادی: ${a.note}`)
    await logAdminChange({ action: 'CREATE', entity: 'CUSTOMER_NOTE', entityId: customerId, details: { insight: insightId } })
    refreshCustomer(customerId)
    return { ok: true, data: { message: 'به یادداشت‌های مشتری اضافه شد.' } }
  }
  const rec = await loadRecipient(customerId, a.petId)
  if (!rec) return { ok: false, error: 'مشتری پیدا نشد.' }
  const extra: Record<string, string> = {}
  let couponId: string | undefined
  if (a.type === 'coupon') {
    const issued = await issueRecipientCoupon(rec, a.couponTemplate, { source: 'admin', title: insight.title })
    if (!issued.ok) return { ok: false, error: 'برند غذای حیوان در فروشگاه پیدا نشد؛ از بخش کدهای تخفیف یک کد عمومی‌تر بسازید.' }
    extra.code = issued.coupon.code
    extra.expiry = issued.expiry
    couponId = issued.coupon.id
  }
  const text = renderTemplate(a.body, baseVars(rec, extra))
  const q = await enqueueMessage({ customerId, body: text, kind: 'admin', couponId, bypassDailyCap: true })
  if (!q.ok) {
    if (couponId) await db.coupon.update({ where: { id: couponId }, data: { isActive: false } }).catch(() => {})
    return { ok: false, error: REASON_FA[q.reason] ?? GENERIC }
  }
  await logAdminChange({ action: 'CREATE', entity: 'MESSAGE', entityId: q.id, details: { customerId, insight: insightId, couponId } })
  refreshCustomer(customerId)
  return { ok: true, data: { message: 'پیام در صف ارسال قرار گرفت.' } }
}

/* -------------------------------------------------------------------- config */

const configSchema = z.object({
  enabled: z.boolean(),
  pointsPerThousandToman: z.coerce.number().min(0).max(1000),
  serviceMultiplier: z.coerce.number().min(0).max(10),
  signupBonus: z.coerce.number().min(0).max(100000),
  firstPetBonus: z.coerce.number().min(0).max(100000),
  petProfileBonus: z.coerce.number().min(0).max(100000),
  reviewBonus: z.coerce.number().min(0).max(100000),
  birthdayBonus: z.coerce.number().min(0).max(100000),
  referralGiven: z.coerce.number().min(0).max(100000),
  referralJoined: z.coerce.number().min(0).max(100000),
  pointValueToman: z.coerce.number().min(0).max(1_000_000),
  pointsExpireMonths: z.coerce.number().min(1).max(120).nullable().optional(),
})

export async function saveLoyaltyConfigAction(input: z.input<typeof configSchema>, tiers: TierDef[]): Promise<ClubResult> {
  const g = await guard('ADMIN')
  if (!g.ok) return { ok: false, error: g.error }
  const p = configSchema.safeParse(input)
  if (!p.success) return { ok: false, error: 'یکی از مقادیر معتبر نیست؛ عددها را بررسی کنید.' }
  const clean = parseTiers(tiers)
  if (!Array.isArray(tiers) || clean.length !== tiers.length) return { ok: false, error: 'مشخصات سطح‌ها کامل نیست (کلید انگلیسی، نام، حداقل امتیاز).' }
  const bad = validateTiers(clean)
  if (bad) return { ok: false, error: bad }
  const before = await getLoyaltyConfig()
  await updateLoyaltyConfig({ ...p.data, tiers: clean })
  await logAdminChange({ action: 'UPDATE', entity: 'LOYALTY_CONFIG', entityId: 'main', before: { ...before, tiers: undefined }, after: { ...p.data, tiers: clean.map((t) => `${t.key}:${t.minPoints}`) } })
  revalidatePath('/admin/club')
  return { ok: true }
}

const rewardSchema = z.object({
  title: z.string().trim().min(2, 'عنوان جایزه را بنویسید.').max(80),
  description: z.string().trim().max(300).optional().nullable(),
  pointsCost: z.coerce.number().int().min(1, 'هزینه‌ی امتیازی باید حداقل ۱ باشد.').max(10_000_000),
  couponType: z.enum(['PERCENT', 'FIXED', 'FREE_SHIPPING']),
  couponValue: z.coerce.number().int().min(0).max(100_000_000),
  couponMaxDiscount: z.coerce.number().int().min(0).max(100_000_000).nullish(),
  couponMinSubtotal: z.coerce.number().int().min(0).max(1_000_000_000).default(0),
  couponValidDays: z.coerce.number().int().min(1).max(365).default(30),
  minTier: z.string().max(20).nullish(),
  stock: z.coerce.number().int().min(0).max(1_000_000).nullish(),
  isActive: z.boolean().default(true),
  sortOrder: z.coerce.number().int().min(0).max(10_000).default(0),
})
export type RewardInput = z.input<typeof rewardSchema>

export async function saveRewardAction(id: string | null, input: RewardInput): Promise<ClubResult<{ id: string }>> {
  const g = await guard()
  if (!g.ok) return { ok: false, error: g.error }
  const p = rewardSchema.safeParse(input)
  if (!p.success) return { ok: false, error: p.error.issues[0]?.message ?? 'اطلاعات جایزه معتبر نیست.' }
  const d = p.data
  if (d.couponType === 'PERCENT' && (d.couponValue < 1 || d.couponValue > 100)) return { ok: false, error: 'درصد تخفیف باید بین ۱ تا ۱۰۰ باشد.' }
  if (d.couponType === 'FIXED' && d.couponValue < 1000) return { ok: false, error: 'مبلغ تخفیف را به تومان وارد کنید.' }
  if (d.minTier) {
    const cfg = await getLoyaltyConfig()
    if (!cfg.tiers.some((t) => t.key === d.minTier)) return { ok: false, error: 'سطح انتخاب‌شده وجود ندارد.' }
  }
  const data = {
    title: normalizeFa(d.title),
    description: d.description ? normalizeFa(d.description) : null,
    pointsCost: d.pointsCost,
    couponType: d.couponType,
    couponValue: d.couponType === 'FREE_SHIPPING' ? 0 : d.couponValue,
    couponMaxDiscount: d.couponType === 'PERCENT' ? d.couponMaxDiscount ?? null : null,
    couponMinSubtotal: d.couponMinSubtotal,
    couponValidDays: d.couponValidDays,
    minTier: d.minTier || null,
    stock: d.stock ?? null,
    isActive: d.isActive,
    sortOrder: d.sortOrder,
  }
  try {
    const row = id ? await db.reward.update({ where: { id }, data }) : await db.reward.create({ data })
    await logAdminChange({ action: id ? 'UPDATE' : 'CREATE', entity: 'REWARD', entityId: row.id, after: data })
    revalidatePath('/admin/club')
    return { ok: true, data: { id: row.id } }
  } catch {
    return { ok: false, error: id ? 'جایزه پیدا نشد؛ شاید حذف شده است.' : GENERIC }
  }
}

export async function deleteRewardAction(id: string): Promise<ClubResult> {
  const g = await guard('ADMIN')
  if (!g.ok) return { ok: false, error: g.error }
  const r = await db.reward.findUnique({ where: { id }, select: { title: true, _count: { select: { redemptions: true } } } })
  if (!r) return { ok: false, error: 'جایزه پیدا نشد.' }
  if (r._count.redemptions > 0) {
    await db.reward.update({ where: { id }, data: { isActive: false } })
    await logAdminChange({ action: 'UPDATE', entity: 'REWARD', entityId: id, details: { deactivatedInsteadOfDelete: true, title: r.title } })
    revalidatePath('/admin/club')
    return { ok: true, error: 'این جایزه قبلاً دریافت شده است؛ به‌جای حذف غیرفعال شد.' }
  }
  await db.reward.delete({ where: { id } })
  await logAdminChange({ action: 'DELETE', entity: 'REWARD', entityId: id, before: { title: r.title } })
  revalidatePath('/admin/club')
  return { ok: true }
}

/* ------------------------------------------------------------------ segments */

export async function previewSegmentAction(rules: unknown): Promise<ClubResult<SegmentPreview>> {
  const g = await guard()
  if (!g.ok) return { ok: false, error: g.error }
  try {
    return { ok: true, data: await previewSegment(normalizeRules(rules), 8) }
  } catch {
    return { ok: false, error: GENERIC }
  }
}

export async function saveSegmentAction(id: string | null, input: { name: string; description?: string; rules: unknown }): Promise<ClubResult<{ id: string }>> {
  const g = await guard()
  if (!g.ok) return { ok: false, error: g.error }
  const name = normalizeFa(input.name ?? '').trim()
  if (name.length < 2 || name.length > 60) return { ok: false, error: 'نام گروه باید بین ۲ تا ۶۰ نویسه باشد.' }
  const rules = normalizeRules(input.rules)
  if (Object.keys(rules).filter((k) => k !== 'smsConsentOnly').length === 0) return { ok: false, error: 'حداقل یک شرط برای گروه تعیین کنید.' }
  const data = { name, description: input.description ? normalizeFa(input.description).trim().slice(0, 200) : null, rules: rules as object }
  try {
    const row = id ? await db.segment.update({ where: { id }, data }) : await db.segment.create({ data })
    await logAdminChange({ action: id ? 'UPDATE' : 'CREATE', entity: 'SEGMENT', entityId: row.id, after: { name, rules } })
    revalidatePath('/admin/segments')
    return { ok: true, data: { id: row.id } }
  } catch {
    return { ok: false, error: 'گروه پیدا نشد؛ شاید حذف شده است.' }
  }
}

export async function pinSegmentAction(id: string, pinned: boolean): Promise<ClubResult> {
  const g = await guard()
  if (!g.ok) return { ok: false, error: g.error }
  try {
    await db.segment.update({ where: { id }, data: { isPinned: !!pinned } })
  } catch {
    return { ok: false, error: 'گروه پیدا نشد.' }
  }
  await logAdminChange({ action: 'UPDATE', entity: 'SEGMENT', entityId: id, after: { isPinned: !!pinned } })
  revalidatePath('/admin/segments')
  return { ok: true }
}

export async function deleteSegmentAction(id: string): Promise<ClubResult> {
  const g = await guard()
  if (!g.ok) return { ok: false, error: g.error }
  const seg = await db.segment.findUnique({ where: { id }, select: { name: true } })
  if (!seg) return { ok: false, error: 'گروه پیدا نشد.' }
  await db.segment.delete({ where: { id } })
  await logAdminChange({ action: 'DELETE', entity: 'SEGMENT', entityId: id, before: seg })
  revalidatePath('/admin/segments')
  return { ok: true }
}

/* ----------------------------------------------------------------- campaigns */

export async function previewCampaignAction(input: { rules?: unknown; segmentId?: string | null; body: string; couponTemplate?: unknown }): Promise<ClubResult<CampaignPreview>> {
  const g = await guard()
  if (!g.ok) return { ok: false, error: g.error }
  try {
    return { ok: true, data: await previewCampaign({ ...input, body: String(input.body ?? '').slice(0, 1000), sampleSize: 3 }) }
  } catch {
    return { ok: false, error: GENERIC }
  }
}

export interface CampaignSubmit {
  name: string
  body: string
  segmentId?: string | null
  rules?: unknown
  couponTemplate?: unknown
  /** ISO datetime; empty = send now */
  scheduledFor?: string | null
  launch: boolean
}

export async function saveCampaignAction(input: CampaignSubmit): Promise<ClubResult<{ id: string; enqueued?: number; audience?: number; skipped?: Record<string, number> }>> {
  const g = await guard()
  if (!g.ok) return { ok: false, error: g.error }
  const when = input.scheduledFor ? new Date(input.scheduledFor) : null
  if (when && Number.isNaN(when.getTime())) return { ok: false, error: 'زمان ارسال معتبر نیست.' }
  const payload: CampaignInput = { name: input.name, body: input.body, segmentId: input.segmentId || null, rules: input.rules, couponTemplate: input.couponTemplate || null, scheduledFor: when }
  const draft = await createCampaignDraft(payload, g.userId)
  if (!draft.ok) return { ok: false, error: draft.error }
  await logAdminChange({ action: 'CREATE', entity: 'CAMPAIGN', entityId: draft.id, after: { name: input.name, launch: input.launch } })
  revalidatePath('/admin/campaigns')
  if (!input.launch) return { ok: true, data: { id: draft.id } }
  const res = await launchCampaign(draft.id)
  if (!res.ok) return { ok: false, error: res.error ?? GENERIC, data: { id: draft.id } }
  await logAdminChange({ action: 'UPDATE', entity: 'CAMPAIGN', entityId: draft.id, details: { launched: true, audience: res.audience, enqueued: res.enqueued, skipped: res.skipped } })
  revalidatePath('/admin/campaigns')
  return { ok: true, data: { id: draft.id, enqueued: res.enqueued, audience: res.audience, skipped: res.skipped } }
}

export async function launchCampaignAction(id: string): Promise<ClubResult<{ enqueued: number }>> {
  const g = await guard()
  if (!g.ok) return { ok: false, error: g.error }
  const res = await launchCampaign(id)
  if (!res.ok) return { ok: false, error: res.error ?? GENERIC }
  await logAdminChange({ action: 'UPDATE', entity: 'CAMPAIGN', entityId: id, details: { launched: true, enqueued: res.enqueued } })
  revalidatePath('/admin/campaigns')
  return { ok: true, data: { enqueued: res.enqueued } }
}

export async function cancelCampaignAction(id: string): Promise<ClubResult<{ cancelled: number }>> {
  const g = await guard()
  if (!g.ok) return { ok: false, error: g.error }
  const c = await getCampaign(id)
  if (!c) return { ok: false, error: 'کمپین پیدا نشد.' }
  const res = await cancelCampaign(id)
  await logAdminChange({ action: 'UPDATE', entity: 'CAMPAIGN', entityId: id, before: { status: c.status }, details: { cancelledMessages: res.cancelledMessages } })
  revalidatePath('/admin/campaigns')
  revalidatePath(`/admin/campaigns/${id}`)
  return { ok: true, data: { cancelled: res.cancelledMessages } }
}

/* --------------------------------------------------------------- automations */

export async function saveAutomationAction(kind: string, patch: { enabled?: boolean; params?: unknown; bodyTemplate?: string; couponTemplate?: unknown | null }): Promise<ClubResult> {
  const g = await guard()
  if (!g.ok) return { ok: false, error: g.error }
  const r = await updateAutomationRule(kind, patch)
  if (!r.ok) return { ok: false, error: r.error }
  await logAdminChange({ action: 'UPDATE', entity: 'AUTOMATION', entityId: kind, after: { enabled: r.rule.enabled, params: r.rule.params } })
  revalidatePath('/admin/automations')
  return { ok: true }
}

export async function dryRunAutomationAction(kind: string): Promise<ClubResult<AutomationRun>> {
  const g = await guard()
  if (!g.ok) return { ok: false, error: g.error }
  const runs = await generateAutomationMessages({ dryRun: true, kinds: [kind as never], includeDisabled: true, limitPerRule: 50 })
  const run = runs[0]
  return run ? { ok: true, data: run } : { ok: false, error: 'نوع خودکارسازی نامعتبر است.' }
}

/* -------------------------------------------------------------------- outbox */

export async function processOutboxAction(): Promise<ClubResult<{ sent: number; failed: number; configured: boolean }>> {
  const g = await guard()
  if (!g.ok) return { ok: false, error: g.error }
  const r = await processOutbox({ limit: 100 })
  await logAdminChange({ action: 'UPDATE', entity: 'OUTBOX', entityId: 'process', details: { sent: r.sent, failed: r.failed, configured: r.configured } })
  revalidatePath('/admin/outbox')
  if (!r.configured) return { ok: false, error: senderStatus().message ?? 'سرویس پیامک متصل نیست.' }
  return { ok: true, data: { sent: r.sent, failed: r.failed, configured: r.configured } }
}

export async function retryMessageAction(id: string): Promise<ClubResult> {
  const g = await guard()
  if (!g.ok) return { ok: false, error: g.error }
  const ok = await retryMessage(id)
  if (!ok) return { ok: false, error: 'فقط پیام‌های ناموفق دوباره در صف قرار می‌گیرند.' }
  await logAdminChange({ action: 'UPDATE', entity: 'OUTBOX', entityId: id, details: { retry: true } })
  revalidatePath('/admin/outbox')
  return { ok: true }
}

export async function cancelMessageAction(id: string): Promise<ClubResult> {
  const g = await guard()
  if (!g.ok) return { ok: false, error: g.error }
  const ok = await cancelMessage(id)
  if (!ok) return { ok: false, error: 'فقط پیام‌های در صف قابل لغو هستند.' }
  await logAdminChange({ action: 'UPDATE', entity: 'OUTBOX', entityId: id, details: { cancel: true } })
  revalidatePath('/admin/outbox')
  return { ok: true }
}

/* --------------------------------------------------------------------- carts */

export async function sendCartReminderAction(customerId: string, discountPercent: number): Promise<ClubResult<{ message: string }>> {
  const g = await guard()
  if (!g.ok) return { ok: false, error: g.error }
  const snap = await getCartSnapshot(customerId)
  if (!snap || snap.itemCount === 0) return { ok: false, error: 'سبد این مشتری خالی است.' }
  const rec = await loadRecipient(customerId)
  if (!rec) return { ok: false, error: 'مشتری پیدا نشد.' }
  const pct = Math.trunc(Number(discountPercent) || 0)
  if (pct < 0 || pct > 30) return { ok: false, error: 'درصد تخفیف یادآوری باید بین ۰ تا ۳۰ باشد.' }
  const extra: Record<string, string> = { item: snap.items[0]?.name ?? 'محصولات سبد' }
  let couponId: string | undefined
  let body = 'سلام {name} عزیز، {item} هنوز در سبد خرید شما منتظر است. برای تکمیل خرید: {link}'
  if (pct > 0) {
    const issued = await issueRecipientCoupon(rec, { type: 'PERCENT', value: pct, maxDiscount: 150_000, minSubtotal: 0, validDays: 3 }, { source: 'admin', title: 'یادآوری سبد خرید' })
    if (!issued.ok) return { ok: false, error: GENERIC }
    extra.code = issued.coupon.code
    extra.expiry = issued.expiry
    couponId = issued.coupon.id
    body = 'سلام {name} عزیز، {item} هنوز در سبد شماست. با کد {code} تا {expiry} تخفیف بگیرید: {link}'
  }
  const q = await enqueueMessage({ customerId, body: renderTemplate(body, baseVars(rec, extra)), kind: 'admin', couponId, bypassDailyCap: false })
  if (!q.ok) {
    if (couponId) await db.coupon.update({ where: { id: couponId }, data: { isActive: false } }).catch(() => {})
    return { ok: false, error: REASON_FA[q.reason] ?? GENERIC }
  }
  // Keep updatedAt as it was: it is the cart's idle clock, and a reminder is not customer activity.
  const snapNow = await db.cartSnapshot.findUnique({ where: { customerId }, select: { updatedAt: true } })
  if (snapNow) await db.cartSnapshot.update({ where: { customerId }, data: { lastReminderAt: new Date(), updatedAt: snapNow.updatedAt } }).catch(() => {})
  await logAdminChange({ action: 'CREATE', entity: 'MESSAGE', entityId: q.id, details: { customerId, cartReminder: true, discountPercent: pct } })
  revalidatePath('/admin/carts')
  return { ok: true, data: { message: 'یادآوری در صف ارسال قرار گرفت.' } }
}
