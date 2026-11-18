'use server'

import crypto from 'crypto'
import { revalidatePath } from 'next/cache'
import { db } from '@/lib/db'
import { getSessionWithRole } from '@/lib/auth'
import { logAdminChange } from '@/lib/audit'
import { checkRateLimit } from '@/lib/utils/rate-limit'
import { normalizeMobile } from '@/lib/text/iran'
import { contactsWhere } from '@/lib/marketing/admin-queries'
import { normalizeEmail } from '@/lib/customer/email'
import { normalizeCode } from '@/lib/marketing/coupon-rules'
import { generateCode } from '@/lib/marketing/coupons'
import { getMarketingConfig, updateMarketingConfig } from '@/lib/marketing/config'
import {
  bulkInputSchema,
  configInputSchema,
  couponInputSchema,
  groupInputSchema,
  parseTehranLocal,
  toCsv,
  couponStatus,
  COUPON_STATUS_LABEL,
  type BulkInput,
  type ConfigInput,
  type CouponInputRaw,
} from '@/lib/marketing/admin-validators'

export interface MarketingActionResult<T = Record<string, never>> {
  ok: boolean
  error?: string
  data?: T
}

const DENIED = 'دسترسی غیرمجاز.'
const BUSY = 'تعداد درخواست‌ها زیاد است؛ کمی صبر کنید و دوباره تلاش کنید.'
const GENERIC = 'خطایی رخ داد. دوباره تلاش کنید.'

type Guard = { ok: true; userId: string } | { ok: false; error: string }

/** EDITOR and above, plus a per-user rate limit so scripts cannot hammer the writes. */
async function guard(kind: 'write' | 'export' = 'write'): Promise<Guard> {
  const session = await getSessionWithRole('EDITOR')
  if (!session) return { ok: false, error: DENIED }
  const limit = kind === 'export' ? checkRateLimit(`adm-mkt-x:${session.userId}`, 20, 60_000) : checkRateLimit(`adm-mkt:${session.userId}`, 120, 60_000)
  if (!limit.allowed) return { ok: false, error: BUSY }
  return { ok: true, userId: session.userId }
}

const firstIssue = (err: { issues: { message: string }[] }) => err.issues[0]?.message ?? 'اطلاعات واردشده معتبر نیست.'
const isUnique = (e: unknown) => (e as { code?: string })?.code === 'P2002'
const refresh = () => revalidatePath('/admin/marketing')

/* ---------------------------------------------------------------- coupons */

export async function saveCouponAction(id: string | null, raw: CouponInputRaw): Promise<MarketingActionResult<{ id: string; code: string }>> {
  const g = await guard()
  if (!g.ok) return { ok: false, error: g.error }
  const parsed = couponInputSchema.safeParse(raw)
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) }
  const c = parsed.data

  try {
    const before = id ? await db.coupon.findUnique({ where: { id } }) : null
    if (id && !before) return { ok: false, error: 'کد تخفیف پیدا نشد؛ شاید حذف شده است.' }

    let code = c.code.trim() ? normalizeCode(c.code) : null
    if (c.code.trim() && !code) return { ok: false, error: 'کد فقط می‌تواند شامل حروف انگلیسی، عدد و خط تیره باشد.' }
    if (!code) code = before?.code ?? (await freeCode('PB'))
    if (before && before.usedCount > 0 && code !== before.code) {
      return { ok: false, error: 'این کد قبلاً استفاده شده و کد آن قابل تغییر نیست.' }
    }
    const clash = await db.coupon.findUnique({ where: { code }, select: { id: true } })
    if (clash && clash.id !== id) return { ok: false, error: 'این کد قبلاً برای تخفیف دیگری ثبت شده است.' }

    let customerId: string | null = null
    if (c.customerPhone.trim()) {
      const phone = normalizeMobile(c.customerPhone)
      if (!phone) return { ok: false, error: 'شماره موبایل مشتری معتبر نیست.' }
      const customer = await db.customer.findUnique({ where: { phone }, select: { id: true } })
      if (!customer) return { ok: false, error: 'مشتری‌ای با این شماره ثبت‌نام نکرده است. کد شخصی فقط برای مشتریان ثبت‌نام‌شده ساخته می‌شود.' }
      customerId = customer.id
    }
    if (c.groupId) {
      const group = await db.customerGroup.findUnique({ where: { id: c.groupId }, select: { id: true } })
      if (!group) return { ok: false, error: 'گروه انتخاب‌شده پیدا نشد.' }
    }
    const [cats, brands, prods] = await Promise.all([
      c.categoryIds.length ? db.productCategory.count({ where: { id: { in: c.categoryIds } } }) : 0,
      c.brandIds.length ? db.brand.count({ where: { id: { in: c.brandIds } } }) : 0,
      c.productIds.length ? db.product.count({ where: { id: { in: c.productIds } } }) : 0,
    ])
    if (cats !== c.categoryIds.length || brands !== c.brandIds.length || prods !== c.productIds.length) {
      return { ok: false, error: 'بعضی از دسته‌ها، برندها یا محصولات انتخاب‌شده دیگر وجود ندارند.' }
    }

    const data = {
      code,
      title: c.title,
      description: c.description || null,
      type: c.type,
      value: c.type === 'FREE_SHIPPING' ? 0 : c.value,
      maxDiscount: c.type === 'PERCENT' ? c.maxDiscount : null,
      minSubtotal: c.minSubtotal,
      startsAt: parseTehranLocal(c.startsAt),
      endsAt: parseTehranLocal(c.endsAt),
      isActive: c.isActive,
      autoApply: c.autoApply,
      usageLimit: c.usageLimit,
      perCustomerLimit: c.perCustomerLimit,
      firstOrderOnly: c.firstOrderOnly,
      customerId,
      groupId: c.groupId || null,
      categoryIds: c.categoryIds,
      brandIds: c.brandIds,
      productIds: c.productIds,
    }
    if (before && data.usageLimit != null && data.usageLimit < before.usedCount) {
      return { ok: false, error: `این کد تاکنون ${before.usedCount.toLocaleString('fa-IR')} بار استفاده شده؛ سقف کل نمی‌تواند کمتر از آن باشد.` }
    }

    const saved = before
      ? await db.coupon.update({ where: { id: before.id }, data })
      : await db.coupon.create({ data: { ...data, source: 'manual' } })

    await logAdminChange({
      action: before ? 'UPDATE' : 'CREATE',
      entity: 'COUPON',
      entityId: saved.id,
      before: before ? auditCoupon(before) : undefined,
      after: auditCoupon(saved),
    })
    refresh()
    return { ok: true, data: { id: saved.id, code: saved.code } }
  } catch (e) {
    if (isUnique(e)) return { ok: false, error: 'این کد قبلاً برای تخفیف دیگری ثبت شده است.' }
    console.error('[admin-marketing] saveCoupon failed', (e as Error)?.message)
    return { ok: false, error: GENERIC }
  }
}

function auditCoupon(c: { code: string; title: string; type: string; value: number; isActive: boolean; usageLimit: number | null; autoApply: boolean }) {
  return { code: c.code, title: c.title, type: c.type, value: c.value, isActive: c.isActive, usageLimit: c.usageLimit, autoApply: c.autoApply }
}

async function freeCode(prefix: string): Promise<string> {
  for (let i = 0; i < 10; i++) {
    const code = generateCode(prefix)
    if (!(await db.coupon.findUnique({ where: { code }, select: { id: true } }))) return code
  }
  throw new Error('could not generate a unique coupon code')
}

export async function setCouponActiveAction(id: string, isActive: boolean): Promise<MarketingActionResult> {
  const g = await guard()
  if (!g.ok) return { ok: false, error: g.error }
  try {
    const before = await db.coupon.findUnique({ where: { id } })
    if (!before) return { ok: false, error: 'کد تخفیف پیدا نشد.' }
    await db.coupon.update({ where: { id }, data: { isActive: !!isActive } })
    await logAdminChange({ action: 'UPDATE', entity: 'COUPON', entityId: id, before: { isActive: before.isActive }, after: { isActive: !!isActive }, details: { code: before.code } })
    refresh()
    return { ok: true }
  } catch (e) {
    console.error('[admin-marketing] setCouponActive failed', (e as Error)?.message)
    return { ok: false, error: GENERIC }
  }
}

export async function duplicateCouponAction(id: string): Promise<MarketingActionResult<{ id: string; code: string }>> {
  const g = await guard()
  if (!g.ok) return { ok: false, error: g.error }
  try {
    const src = await db.coupon.findUnique({ where: { id } })
    if (!src) return { ok: false, error: 'کد تخفیف پیدا نشد.' }
    const copy = await db.coupon.create({
      data: {
        code: await freeCode('PB'),
        title: `${src.title} (کپی)`.slice(0, 80),
        description: src.description,
        type: src.type,
        value: src.value,
        maxDiscount: src.maxDiscount,
        minSubtotal: src.minSubtotal,
        startsAt: src.startsAt,
        endsAt: src.endsAt,
        isActive: false,
        autoApply: false,
        usageLimit: src.usageLimit,
        perCustomerLimit: src.perCustomerLimit,
        firstOrderOnly: src.firstOrderOnly,
        customerId: src.customerId,
        groupId: src.groupId,
        categoryIds: src.categoryIds,
        brandIds: src.brandIds,
        productIds: src.productIds,
        source: 'manual',
      },
    })
    await logAdminChange({ action: 'CREATE', entity: 'COUPON', entityId: copy.id, after: auditCoupon(copy), details: { duplicatedFrom: src.code } })
    refresh()
    return { ok: true, data: { id: copy.id, code: copy.code } }
  } catch (e) {
    console.error('[admin-marketing] duplicateCoupon failed', (e as Error)?.message)
    return { ok: false, error: GENERIC }
  }
}

export async function deleteCouponAction(id: string): Promise<MarketingActionResult> {
  const g = await guard()
  if (!g.ok) return { ok: false, error: g.error }
  try {
    const before = await db.coupon.findUnique({ where: { id }, include: { _count: { select: { redemptions: true, orders: true } } } })
    if (!before) return { ok: false, error: 'کد تخفیف پیدا نشد.' }
    if (before.usedCount > 0 || before._count.redemptions > 0 || before._count.orders > 0) {
      return { ok: false, error: 'این کد در سفارش‌ها استفاده شده و حذف نمی‌شود تا گزارش‌ها دست‌نخورده بماند. به‌جای حذف، آن را غیرفعال کنید.' }
    }
    // Conditional delete: a redemption landing right now keeps the row alive.
    const res = await db.coupon.deleteMany({ where: { id, usedCount: 0, redemptions: { none: {} }, orders: { none: {} } } })
    if (res.count === 0) return { ok: false, error: 'همین الان از این کد استفاده شد؛ آن را غیرفعال کنید.' }
    await logAdminChange({ action: 'DELETE', entity: 'COUPON', entityId: id, before: auditCoupon(before) })
    refresh()
    return { ok: true }
  } catch (e) {
    console.error('[admin-marketing] deleteCoupon failed', (e as Error)?.message)
    return { ok: false, error: GENERIC }
  }
}

/** Bulk: N unique single-use codes from one template. Returns the CSV so the admin can download it. */
export async function bulkGenerateCouponsAction(raw: unknown): Promise<MarketingActionResult<{ batchId: string; count: number; csv: string }>> {
  const g = await guard('export')
  if (!g.ok) return { ok: false, error: g.error }
  const parsed = bulkInputSchema.safeParse(raw)
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) }
  const b: BulkInput = parsed.data
  const t = b.template

  try {
    if (t.groupId && !(await db.customerGroup.findUnique({ where: { id: t.groupId }, select: { id: true } }))) {
      return { ok: false, error: 'گروه انتخاب‌شده پیدا نشد.' }
    }
    const batchId = crypto.randomUUID()
    const base = {
      title: t.title,
      description: t.description || null,
      type: t.type,
      value: t.type === 'FREE_SHIPPING' ? 0 : t.value,
      maxDiscount: t.type === 'PERCENT' ? t.maxDiscount : null,
      minSubtotal: t.minSubtotal,
      startsAt: parseTehranLocal(t.startsAt),
      endsAt: parseTehranLocal(t.endsAt),
      isActive: t.isActive,
      autoApply: false,
      usageLimit: 1,
      perCustomerLimit: 1,
      firstOrderOnly: t.firstOrderOnly,
      groupId: t.groupId || null,
      categoryIds: t.categoryIds,
      brandIds: t.brandIds,
      productIds: t.productIds,
      source: 'bulk',
      batchId,
    }
    let created = 0
    for (let round = 0; round < 6 && created < b.count; round++) {
      const need = b.count - created
      const codes = new Set<string>()
      while (codes.size < need) codes.add(generateCode(b.prefix))
      const res = await db.coupon.createMany({ data: [...codes].map((code) => ({ ...base, code })), skipDuplicates: true })
      created += res.count
    }
    if (created < b.count) return { ok: false, error: 'ساخت همه کدها ممکن نشد. تعداد کمتری را امتحان کنید.' }

    await logAdminChange({ action: 'CREATE', entity: 'COUPON_BATCH', entityId: batchId, after: { title: t.title, type: t.type, value: t.value }, details: { count: created } })
    refresh()
    const csv = await batchCsv(batchId)
    return { ok: true, data: { batchId, count: created, csv } }
  } catch (e) {
    console.error('[admin-marketing] bulkGenerate failed', (e as Error)?.message)
    return { ok: false, error: GENERIC }
  }
}

async function batchCsv(batchId: string): Promise<string> {
  const rows = await db.coupon.findMany({ where: { batchId }, orderBy: { code: 'asc' }, take: 5000 })
  return toCsv(
    ['کد', 'عنوان', 'وضعیت', 'استفاده‌شده', 'پایان اعتبار'],
    rows.map((r) => [r.code, r.title, COUPON_STATUS_LABEL[couponStatus(r)], r.usedCount > 0 ? 'بله' : 'خیر', r.endsAt ? r.endsAt.toISOString() : ''])
  )
}

export async function exportBatchCsvAction(batchId: string): Promise<MarketingActionResult<{ csv: string }>> {
  const g = await guard('export')
  if (!g.ok) return { ok: false, error: g.error }
  if (typeof batchId !== 'string' || batchId.length > 60) return { ok: false, error: 'دسته نامعتبر است.' }
  try {
    const csv = await batchCsv(batchId)
    return { ok: true, data: { csv } }
  } catch {
    return { ok: false, error: GENERIC }
  }
}

export async function searchProductsAction(query: string): Promise<{ id: string; name: string; sku: string | null }[]> {
  const session = await getSessionWithRole('EDITOR')
  if (!session) return []
  const q = String(query ?? '').trim().slice(0, 60)
  if (q.length < 2) return []
  const rows = await db.product.findMany({
    where: { deletedAt: null, OR: [{ nameFa: { contains: q, mode: 'insensitive' } }, { sku: { contains: q, mode: 'insensitive' } }] },
    select: { id: true, nameFa: true, sku: true },
    orderBy: { nameFa: 'asc' },
    take: 12,
  })
  return rows.map((r) => ({ id: r.id, name: r.nameFa, sku: r.sku }))
}

/* ---------------------------------------------------------------- groups */

export async function createGroupAction(raw: { name: string; description?: string }): Promise<MarketingActionResult<{ id: string }>> {
  const g = await guard()
  if (!g.ok) return { ok: false, error: g.error }
  const parsed = groupInputSchema.safeParse(raw)
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) }
  try {
    const group = await db.customerGroup.create({ data: { name: parsed.data.name, description: parsed.data.description || null } })
    await logAdminChange({ action: 'CREATE', entity: 'CUSTOMER_GROUP', entityId: group.id, after: { name: group.name } })
    refresh()
    return { ok: true, data: { id: group.id } }
  } catch (e) {
    if (isUnique(e)) return { ok: false, error: 'گروهی با این نام وجود دارد.' }
    return { ok: false, error: GENERIC }
  }
}

export async function updateGroupAction(id: string, raw: { name: string; description?: string }): Promise<MarketingActionResult> {
  const g = await guard()
  if (!g.ok) return { ok: false, error: g.error }
  const parsed = groupInputSchema.safeParse(raw)
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) }
  try {
    const before = await db.customerGroup.findUnique({ where: { id } })
    if (!before) return { ok: false, error: 'گروه پیدا نشد.' }
    await db.customerGroup.update({ where: { id }, data: { name: parsed.data.name, description: parsed.data.description || null } })
    await logAdminChange({ action: 'UPDATE', entity: 'CUSTOMER_GROUP', entityId: id, before: { name: before.name }, after: { name: parsed.data.name } })
    refresh()
    return { ok: true }
  } catch (e) {
    if (isUnique(e)) return { ok: false, error: 'گروهی با این نام وجود دارد.' }
    return { ok: false, error: GENERIC }
  }
}

export async function deleteGroupAction(id: string): Promise<MarketingActionResult> {
  const g = await guard()
  if (!g.ok) return { ok: false, error: g.error }
  try {
    const before = await db.customerGroup.findUnique({ where: { id }, include: { _count: { select: { members: true, coupons: true } } } })
    if (!before) return { ok: false, error: 'گروه پیدا نشد.' }
    if (before._count.coupons > 0) {
      return { ok: false, error: `${before._count.coupons.toLocaleString('fa-IR')} کد تخفیف به این گروه وابسته است. ابتدا گروه را از آن کدها بردارید.` }
    }
    await db.customerGroup.delete({ where: { id } })
    await logAdminChange({ action: 'DELETE', entity: 'CUSTOMER_GROUP', entityId: id, before: { name: before.name, members: before._count.members } })
    refresh()
    return { ok: true }
  } catch {
    return { ok: false, error: GENERIC }
  }
}

export interface GroupMemberRow {
  customerId: string
  name: string
  phone: string
  email: string | null
}

export async function getGroupMembersAction(groupId: string): Promise<MarketingActionResult<{ members: GroupMemberRow[] }>> {
  const session = await getSessionWithRole('EDITOR')
  if (!session) return { ok: false, error: DENIED }
  const rows = await db.customerGroupMember.findMany({
    where: { groupId },
    orderBy: { createdAt: 'desc' },
    take: 300,
    include: { customer: { select: { id: true, firstName: true, lastName: true, phone: true, email: true } } },
  })
  return {
    ok: true,
    data: {
      members: rows.map((r) => ({
        customerId: r.customerId,
        name: [r.customer.firstName, r.customer.lastName].filter(Boolean).join(' ') || 'بدون نام',
        phone: r.customer.phone,
        email: r.customer.email,
      })),
    },
  }
}

/** Adds registered customers by mobile or email. Accepts several entries separated by newline, comma or space. */
export async function addGroupMembersAction(
  groupId: string,
  text: string
): Promise<MarketingActionResult<{ added: number; already: number; missing: string[] }>> {
  const g = await guard()
  if (!g.ok) return { ok: false, error: g.error }
  const tokens = [...new Set(String(text ?? '').split(/[\s,؛;،]+/).map((t) => t.trim()).filter(Boolean))].slice(0, 200)
  if (tokens.length === 0) return { ok: false, error: 'شماره موبایل یا ایمیل مشتری را وارد کنید.' }
  try {
    const group = await db.customerGroup.findUnique({ where: { id: groupId }, select: { id: true, name: true } })
    if (!group) return { ok: false, error: 'گروه پیدا نشد.' }

    const found: string[] = []
    const missing: string[] = []
    for (const t of tokens) {
      const phone = normalizeMobile(t)
      const email = phone ? null : normalizeEmail(t)
      const where = phone ? { phone } : email ? { email } : null
      const customer = where ? await db.customer.findUnique({ where, select: { id: true } }) : null
      if (customer) found.push(customer.id)
      else missing.push(t)
    }
    const res = found.length
      ? await db.customerGroupMember.createMany({ data: [...new Set(found)].map((customerId) => ({ groupId, customerId })), skipDuplicates: true })
      : { count: 0 }
    await logAdminChange({ action: 'UPDATE', entity: 'CUSTOMER_GROUP', entityId: groupId, details: { addedMembers: res.count, group: group.name } })
    refresh()
    return { ok: true, data: { added: res.count, already: new Set(found).size - res.count, missing } }
  } catch (e) {
    console.error('[admin-marketing] addGroupMembers failed', (e as Error)?.message)
    return { ok: false, error: GENERIC }
  }
}

export async function removeGroupMemberAction(groupId: string, customerId: string): Promise<MarketingActionResult> {
  const g = await guard()
  if (!g.ok) return { ok: false, error: g.error }
  try {
    const res = await db.customerGroupMember.deleteMany({ where: { groupId, customerId } })
    if (res.count === 0) return { ok: false, error: 'این مشتری عضو گروه نیست.' }
    await logAdminChange({ action: 'UPDATE', entity: 'CUSTOMER_GROUP', entityId: groupId, details: { removedMember: customerId } })
    refresh()
    return { ok: true }
  } catch {
    return { ok: false, error: GENERIC }
  }
}

/* -------------------------------------------------------------- contacts */

export async function setContactUnsubscribedAction(id: string, unsubscribed: boolean): Promise<MarketingActionResult> {
  const g = await guard()
  if (!g.ok) return { ok: false, error: g.error }
  try {
    const res = await db.marketingContact.updateMany({ where: { id }, data: { unsubscribedAt: unsubscribed ? new Date() : null } })
    if (res.count === 0) return { ok: false, error: 'مخاطب پیدا نشد.' }
    await logAdminChange({ action: 'UPDATE', entity: 'MARKETING_CONTACT', entityId: id, details: { unsubscribed: !!unsubscribed } })
    refresh()
    return { ok: true }
  } catch {
    return { ok: false, error: GENERIC }
  }
}

export async function exportContactsCsvAction(filter: { q?: string; source?: string } = {}): Promise<MarketingActionResult<{ csv: string; count: number }>> {
  const g = await guard('export')
  if (!g.ok) return { ok: false, error: g.error }
  try {
    const where = contactsWhere(filter)
    const rows = await db.marketingContact.findMany({ where, orderBy: { createdAt: 'desc' }, take: 20000 })
    const couponIds = rows.map((r) => r.welcomeCouponId).filter((v): v is string => !!v)
    const coupons = couponIds.length ? await db.coupon.findMany({ where: { id: { in: couponIds } }, select: { id: true, code: true, usedCount: true } }) : []
    const byId = new Map(coupons.map((c) => [c.id, c]))
    const csv = toCsv(
      ['موبایل', 'ایمیل', 'نام', 'منبع', 'تاریخ ثبت', 'کد خوش‌آمد', 'کد استفاده شد', 'ثبت‌نام کرده', 'لغو عضویت'],
      rows.map((r) => {
        const c = r.welcomeCouponId ? byId.get(r.welcomeCouponId) : undefined
        return [r.phone ?? '', r.email ?? '', r.name ?? '', r.source, r.createdAt.toISOString(), c?.code ?? '', c ? (c.usedCount > 0 ? 'بله' : 'خیر') : '', r.customerId ? 'بله' : 'خیر', r.unsubscribedAt ? 'بله' : 'خیر']
      })
    )
    await logAdminChange({ action: 'EXPORT', entity: 'MARKETING_CONTACT', entityId: 'csv', details: { count: rows.length } })
    return { ok: true, data: { csv, count: rows.length } }
  } catch (e) {
    console.error('[admin-marketing] exportContacts failed', (e as Error)?.message)
    return { ok: false, error: GENERIC }
  }
}

/* --------------------------------------------------------------- config */

export async function saveMarketingConfigAction(raw: unknown): Promise<MarketingActionResult> {
  const g = await guard()
  if (!g.ok) return { ok: false, error: g.error }
  const parsed = configInputSchema.safeParse(raw)
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) }
  const c: ConfigInput = parsed.data
  try {
    let bannerCouponCode: string | null = null
    if (c.bannerCouponCode.trim()) {
      bannerCouponCode = normalizeCode(c.bannerCouponCode)
      if (!bannerCouponCode) return { ok: false, error: 'کد روی بنر معتبر نیست.' }
      const exists = await db.coupon.findUnique({ where: { code: bannerCouponCode }, select: { id: true } })
      if (!exists) return { ok: false, error: 'کدی با این نام برای نمایش روی بنر وجود ندارد؛ ابتدا آن را بسازید.' }
    }
    const before = await getMarketingConfig()
    const after = await updateMarketingConfig({
      popupEnabled: c.popupEnabled,
      popupTitle: c.popupTitle,
      popupText: c.popupText,
      popupDelaySeconds: c.popupDelaySeconds,
      welcomeEnabled: c.welcomeEnabled,
      welcomeType: c.welcomeType,
      welcomeValue: c.welcomeType === 'FREE_SHIPPING' ? 0 : c.welcomeValue,
      welcomeMaxDiscount: c.welcomeType === 'PERCENT' ? c.welcomeMaxDiscount : null,
      welcomeMinSubtotal: c.welcomeMinSubtotal,
      welcomeValidDays: c.welcomeValidDays,
      bannerEnabled: c.bannerEnabled,
      bannerText: c.bannerText || null,
      bannerLink: c.bannerLink || null,
      bannerEndsAt: parseTehranLocal(c.bannerEndsAt),
      bannerCouponCode,
    })
    const { updatedAt: _a, ...b } = before
    const { updatedAt: _b, ...a } = after
    void _a
    void _b
    await logAdminChange({ action: 'UPDATE', entity: 'MARKETING_CONFIG', entityId: 'main', before: b, after: a })
    // The popup and banner come from the root layout of statically cached pages (home revalidates every 5 minutes).
    revalidatePath('/', 'layout')
    refresh()
    return { ok: true }
  } catch (e) {
    console.error('[admin-marketing] saveConfig failed', (e as Error)?.message)
    return { ok: false, error: GENERIC }
  }
}
