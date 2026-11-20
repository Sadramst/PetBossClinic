import 'server-only'
import { Prisma, type AutomationRule } from '@prisma/client'
import { db } from '@/lib/db'
import { awardPoints } from '@/lib/club/points'
import { getLoyaltyConfig } from '@/lib/club/config'
import { renderTemplate, unknownVariables, usesCoupon } from '@/lib/club/messaging/render'
import { MARKETING_DAILY_CAP, MAX_BODY_CHARS, tehranParts, withUnsubscribeFooter } from '@/lib/club/messaging/rules'
import { enqueueMessage, marketingCountLast24h, resolveRecipient } from '@/lib/club/messaging/outbox'
import {
  baseVars,
  discardCoupon,
  issueRecipientCoupon,
  loadRecipient,
  normalizeCouponTemplate,
  type CouponTemplate,
} from '@/lib/club/messaging/personalize'

export const AUTOMATION_KINDS = ['vaccine', 'petBirthday', 'ownerBirthday', 'repeatPurchase', 'winback', 'abandonedCart'] as const
export type AutomationKind = (typeof AUTOMATION_KINDS)[number]

interface AutomationDef {
  label: string
  description: string
  params: Record<string, number>
  /** Persian labels of the params, for the admin form. */
  paramLabels: Record<string, string>
  bodyTemplate: string
  couponTemplate: CouponTemplate | null
}

export const AUTOMATION_DEFAULTS: Record<AutomationKind, AutomationDef> = {
  vaccine: {
    label: 'یادآوری واکسن و معاینه',
    description: 'چند روز قبل از موعد واکسن، ضدانگل یا معاینه‌ی ثبت‌شده برای حیوان، پیامک یادآوری می‌رود.',
    params: { daysBefore: 7 },
    paramLabels: { daysBefore: 'چند روز قبل از موعد' },
    bodyTemplate: 'سلام {name} عزیز، موعد «{item}» برای {petName} نزدیک است. برای رزرو وقت با کلینیک پت‌باس تماس بگیرید.',
    couponTemplate: null,
  },
  petBirthday: {
    label: 'تولد حیوان خانگی',
    description: 'در روز تولد حیوان، پیام تبریک همراه با کد تخفیف شخصی.',
    params: {},
    paramLabels: {},
    bodyTemplate: 'تولد {petName} مبارک! پت‌باس یک هدیه‌ی کوچک دارد: کد {code} تا {expiry} روی خرید بعدی شما.',
    couponTemplate: { type: 'PERCENT', value: 10, maxDiscount: 150_000, minSubtotal: 0, validDays: 14, restrictToPetBrand: false },
  },
  ownerBirthday: {
    label: 'تولد مشتری',
    description: 'در روز تولد مشتری، امتیاز هدیه‌ی باشگاه واریز و پیام تبریک ارسال می‌شود.',
    params: {},
    paramLabels: {},
    bodyTemplate: '{name} عزیز، تولدتان مبارک! امتیاز هدیه‌ی تولد به باشگاه پت‌باس شما اضافه شد و موجودی‌تان {points} امتیاز است.',
    couponTemplate: null,
  },
  repeatPurchase: {
    label: 'یادآوری خرید مجدد',
    description: 'وقتی بسته‌ی غذا یا محصولی که مشتری خریده رو به اتمام است (بر اساس «مدت مصرف» محصول)، پیام خرید مجدد ارسال می‌شود.',
    params: { daysBeforeRunOut: 5, maxAgeDays: 240 },
    paramLabels: { daysBeforeRunOut: 'چند روز قبل از تمام شدن', maxAgeDays: 'حداکثر قدمت سفارش (روز)' },
    bodyTemplate: 'سلام {name} عزیز، {item} {petName} احتمالاً رو به اتمام است. برای سفارش دوباره: {link}',
    couponTemplate: null,
  },
  winback: {
    label: 'بازگرداندن مشتریان ساکت',
    description: 'مشتریانی که مدتی خرید نکرده‌اند پیام دلگرمی با کد تخفیف دریافت می‌کنند.',
    params: { afterDays: 60 },
    paramLabels: { afterDays: 'بعد از چند روز بدون خرید' },
    bodyTemplate: '{name} عزیز، دلمان برایتان تنگ شده! کد {code} تا {expiry} روی خرید بعدی شما برای {petName}: {link}',
    couponTemplate: { type: 'PERCENT', value: 10, maxDiscount: 200_000, minSubtotal: 300_000, validDays: 10, restrictToPetBrand: false },
  },
  abandonedCart: {
    label: 'یادآوری سبد خرید رها شده',
    description: 'اگر مشتری محصولی در سبد گذاشته و خرید را کامل نکرده، چند ساعت بعد یادآوری می‌شود.',
    params: { idleHours: 3, maxAgeDays: 7, reminderGapDays: 3 },
    paramLabels: { idleHours: 'بعد از چند ساعت بی‌حرکتی', maxAgeDays: 'حداکثر قدمت سبد (روز)', reminderGapDays: 'حداقل فاصله‌ی دو یادآوری (روز)' },
    bodyTemplate: '{name} عزیز، «{item}» هنوز در سبد خرید شماست. برای تکمیل خرید: {link}',
    couponTemplate: null,
  },
}

const PARAM_LIMITS: Record<AutomationKind, Record<string, [number, number]>> = {
  vaccine: { daysBefore: [1, 60] },
  petBirthday: {},
  ownerBirthday: {},
  repeatPurchase: { daysBeforeRunOut: [0, 30], maxAgeDays: [30, 720] },
  winback: { afterDays: [14, 720] },
  abandonedCart: { idleHours: [1, 72], maxAgeDays: [1, 30], reminderGapDays: [1, 30] },
}

export function isAutomationKind(k: string): k is AutomationKind {
  return (AUTOMATION_KINDS as readonly string[]).includes(k)
}

function cleanParams(kind: AutomationKind, raw: unknown): Record<string, number> {
  const base = AUTOMATION_DEFAULTS[kind].params
  const src = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {}
  const out: Record<string, number> = {}
  for (const [k, def] of Object.entries(base)) {
    const [lo, hi] = PARAM_LIMITS[kind][k]
    const n = Number(src[k])
    out[k] = Number.isFinite(n) ? Math.min(hi, Math.max(lo, Math.floor(n))) : def
  }
  return out
}

/** All rules, created lazily with defaults (every rule starts disabled: nothing is sent until an admin turns it on). */
export async function getAutomationRules(): Promise<Array<AutomationRule & { kind: AutomationKind }>> {
  const existing = await db.automationRule.findMany()
  const have = new Set(existing.map((r) => r.kind))
  const missing = AUTOMATION_KINDS.filter((k) => !have.has(k))
  if (missing.length) {
    await db.automationRule.createMany({
      data: missing.map((k) => ({
        kind: k,
        enabled: false,
        params: AUTOMATION_DEFAULTS[k].params as Prisma.InputJsonValue,
        bodyTemplate: AUTOMATION_DEFAULTS[k].bodyTemplate,
        couponTemplate: (AUTOMATION_DEFAULTS[k].couponTemplate ?? undefined) as unknown as Prisma.InputJsonValue | undefined,
      })),
      skipDuplicates: true,
    })
  }
  const all = missing.length ? await db.automationRule.findMany() : existing
  return AUTOMATION_KINDS.map((k) => all.find((r) => r.kind === k)!).filter(Boolean) as Array<AutomationRule & { kind: AutomationKind }>
}

export interface AutomationPatch {
  enabled?: boolean
  params?: unknown
  bodyTemplate?: string
  couponTemplate?: unknown | null
}

export async function updateAutomationRule(kind: string, patch: AutomationPatch): Promise<{ ok: true; rule: AutomationRule } | { ok: false; error: string }> {
  if (!isAutomationKind(kind)) return { ok: false, error: 'نوع خودکارسازی نامعتبر است.' }
  await getAutomationRules()
  const current = await db.automationRule.findUniqueOrThrow({ where: { kind } })
  const data: Prisma.AutomationRuleUpdateInput = {}
  let tpl: CouponTemplate | null = normalizeCouponTemplate(current.couponTemplate)
  if (patch.couponTemplate !== undefined) {
    tpl = patch.couponTemplate === null ? null : normalizeCouponTemplate(patch.couponTemplate)
    if (patch.couponTemplate !== null && !tpl) return { ok: false, error: 'تنظیمات کد تخفیف معتبر نیست.' }
    data.couponTemplate = tpl ? (tpl as unknown as Prisma.InputJsonValue) : Prisma.JsonNull
  }
  let body = current.bodyTemplate
  if (patch.bodyTemplate !== undefined) {
    body = patch.bodyTemplate.trim()
    if (!body) return { ok: false, error: 'متن پیام را بنویسید.' }
    if (Array.from(withUnsubscribeFooter(body)).length > MAX_BODY_CHARS) return { ok: false, error: 'متن پیام بیش از حد بلند است.' }
    const unknown = unknownVariables(body)
    if (unknown.length) return { ok: false, error: `متغیر ناشناخته در متن: ${unknown.map((u) => `{${u}}`).join('، ')}` }
    data.bodyTemplate = body
  }
  if (usesCoupon(body) && !tpl) return { ok: false, error: 'متن پیام از {code} یا {expiry} استفاده می‌کند؛ ابتدا کد تخفیف را تنظیم کنید.' }
  if (patch.params !== undefined) data.params = cleanParams(kind, patch.params) as Prisma.InputJsonValue
  if (patch.enabled !== undefined) data.enabled = patch.enabled
  const rule = await db.automationRule.update({ where: { kind }, data })
  return { ok: true, rule }
}

/** Per rule: when it last queued something and how much in the past 7 days (derived from the outbox). */
export async function getAutomationStats(now = new Date()): Promise<Record<string, { lastQueuedAt: Date | null; queued7d: number; sent7d: number }>> {
  const since = new Date(now.getTime() - 7 * 86_400_000)
  const rows = await db.messageOutbox.groupBy({
    by: ['kind', 'status'],
    where: { kind: { startsWith: 'automation:' }, createdAt: { gte: since } },
    _count: { _all: true },
    _max: { createdAt: true },
  })
  const last = await db.messageOutbox.groupBy({ by: ['kind'], where: { kind: { startsWith: 'automation:' } }, _max: { createdAt: true } })
  const out: Record<string, { lastQueuedAt: Date | null; queued7d: number; sent7d: number }> = {}
  for (const k of AUTOMATION_KINDS) {
    const kind = `automation:${k}`
    const mine = rows.filter((r) => r.kind === kind)
    out[k] = {
      lastQueuedAt: last.find((l) => l.kind === kind)?._max.createdAt ?? null,
      queued7d: mine.reduce((s, r) => s + r._count._all, 0),
      sent7d: mine.filter((r) => r.status === 'SENT').reduce((s, r) => s + r._count._all, 0),
    }
  }
  return out
}

// ── Candidate generation ─────────────────────────────────────────────────────

interface Candidate {
  customerId: string
  petId?: string | null
  dedupeKey: string
  item?: string | null
  /** Runs once the message is really queued (stamps the source row so it is not picked up again). */
  onQueued?: () => Promise<unknown>
}

const CONSENT_WHERE = { marketingSmsConsent: true, isBlocked: false } as const
const isoDay = (d: Date) => d.toISOString().slice(0, 10)

async function vaccineCandidates(now: Date, params: Record<string, number>, limit: number): Promise<Candidate[]> {
  const daysBefore = params.daysBefore ?? 7
  const records = await db.petRecord.findMany({
    where: {
      nextDueAt: { gte: new Date(now.getTime() - 7 * 86_400_000), lte: new Date(now.getTime() + daysBefore * 86_400_000) },
      reminderSentAt: null,
      pet: { isActive: true, deceasedAt: null, customer: CONSENT_WHERE },
    },
    include: { pet: { select: { id: true, customerId: true } } },
    orderBy: { nextDueAt: 'asc' },
    take: limit,
  })
  const out: Candidate[] = []
  for (const r of records) {
    // Already renewed (a newer record of the same kind exists): no reminder needed.
    const renewed = await db.petRecord.count({ where: { petId: r.petId, kind: r.kind, doneAt: { gt: r.doneAt }, id: { not: r.id } } })
    if (renewed > 0) continue
    out.push({
      customerId: r.pet.customerId,
      petId: r.petId,
      item: r.title,
      dedupeKey: `vaccine:${r.id}:${isoDay(r.nextDueAt!)}`,
      onQueued: () => db.petRecord.update({ where: { id: r.id }, data: { reminderSentAt: new Date() } }),
    })
  }
  return out
}

async function petBirthdayCandidates(now: Date, limit: number): Promise<Candidate[]> {
  const t = tehranParts(now)
  const rows = await db.$queryRaw<{ id: string; customerId: string }[]>`
    SELECT p."id", p."customerId" FROM "ClubPet" p JOIN "Customer" c ON c."id" = p."customerId"
    WHERE p."isActive" = true AND p."deceasedAt" IS NULL AND p."birthDate" IS NOT NULL
      AND EXTRACT(MONTH FROM p."birthDate") = ${t.month} AND EXTRACT(DAY FROM p."birthDate") = ${t.day}
      AND c."marketingSmsConsent" = true AND c."isBlocked" = false
    LIMIT ${limit}`
  return rows.map((r) => ({ customerId: r.customerId, petId: r.id, dedupeKey: `petBirthday:${r.id}:${t.year}` }))
}

async function ownerBirthdayCandidates(now: Date, limit: number, award: boolean): Promise<Candidate[]> {
  const t = tehranParts(now)
  const rows = await db.$queryRaw<{ id: string }[]>`
    SELECT "id" FROM "Customer"
    WHERE "birthDate" IS NOT NULL AND "isBlocked" = false
      AND EXTRACT(MONTH FROM "birthDate") = ${t.month} AND EXTRACT(DAY FROM "birthDate") = ${t.day}
    LIMIT ${limit}`
  if (award) {
    const cfg = await getLoyaltyConfig()
    if (cfg.enabled && cfg.birthdayBonus > 0) {
      for (const r of rows) {
        // Idempotent per customer and year: reruns and parallel runs never pay twice.
        await awardPoints(db, { customerId: r.id, kind: 'BIRTHDAY', points: cfg.birthdayBonus, refType: 'birthday', refId: `${r.id}:${t.year}`, note: 'هدیه‌ی تولد' }).catch((e) => console.error('birthday points', e))
      }
    }
  }
  return rows.map((r) => ({ customerId: r.id, dedupeKey: `ownerBirthday:${r.id}:${t.year}` }))
}

async function repeatPurchaseCandidates(now: Date, params: Record<string, number>, limit: number): Promise<Candidate[]> {
  const before = params.daysBeforeRunOut ?? 5
  const maxAge = params.maxAgeDays ?? 240
  const items = await db.orderItem.findMany({
    where: {
      productId: { not: null },
      product: { consumeDays: { not: null } },
      order: { status: 'DELIVERED', createdAt: { gte: new Date(now.getTime() - maxAge * 86_400_000) }, customer: CONSENT_WHERE },
    },
    include: { order: { select: { customerId: true, createdAt: true } }, product: { select: { consumeDays: true, nameFa: true } } },
    orderBy: { order: { createdAt: 'desc' } },
    take: limit * 4,
  })
  const seen = new Set<string>()
  const out: Candidate[] = []
  for (const it of items) {
    const key = `${it.order.customerId}:${it.productId}`
    if (seen.has(key)) continue // newest order per customer and product only
    seen.add(key)
    const days = (it.product?.consumeDays ?? 0) * Math.min(12, Math.max(1, it.quantity))
    if (days <= 0) continue
    const runOut = it.order.createdAt.getTime() + days * 86_400_000
    if (now.getTime() < runOut - before * 86_400_000 || now.getTime() > runOut + 10 * 86_400_000) continue
    const reordered = await db.orderItem.count({
      where: { productId: it.productId, order: { customerId: it.order.customerId, createdAt: { gt: it.order.createdAt }, status: { notIn: ['CANCELLED', 'PAYMENT_FAILED'] } } },
    })
    if (reordered > 0) continue
    const pet = await db.pet.findFirst({ where: { customerId: it.order.customerId, isActive: true, deceasedAt: null, foodProductId: it.productId }, select: { id: true } })
    out.push({ customerId: it.order.customerId, petId: pet?.id ?? null, item: it.nameFa, dedupeKey: `repeat:${it.id}` })
    if (out.length >= limit) break
  }
  return out
}

async function winbackCandidates(now: Date, params: Record<string, number>, limit: number): Promise<Candidate[]> {
  const afterDays = params.afterDays ?? 60
  const recent = new Date(now.getTime() - 30 * 86_400_000)
  const rows = await db.customer.findMany({
    where: {
      ...CONSENT_WHERE,
      ordersCount: { gt: 0 },
      lastOrderAt: { lt: new Date(now.getTime() - afterDays * 86_400_000), gte: new Date(now.getTime() - 400 * 86_400_000) },
      outbox: { none: { createdAt: { gte: recent }, status: { in: ['QUEUED', 'SENDING', 'SENT'] } } },
    },
    select: { id: true, lastOrderAt: true },
    orderBy: { lastOrderAt: 'desc' },
    take: limit,
  })
  return rows.map((r) => ({ customerId: r.id, dedupeKey: `winback:${r.id}:${isoDay(r.lastOrderAt!)}` }))
}

async function abandonedCartCandidates(now: Date, params: Record<string, number>, limit: number): Promise<Candidate[]> {
  const idle = params.idleHours ?? 3
  const maxAge = params.maxAgeDays ?? 7
  const gap = params.reminderGapDays ?? 3
  const carts = await db.cartSnapshot.findMany({
    where: {
      itemCount: { gt: 0 },
      updatedAt: { lte: new Date(now.getTime() - idle * 3_600_000), gte: new Date(now.getTime() - maxAge * 86_400_000) },
      OR: [{ lastReminderAt: null }, { lastReminderAt: { lt: new Date(now.getTime() - gap * 86_400_000) } }],
      customer: CONSENT_WHERE,
    },
    orderBy: { updatedAt: 'desc' },
    take: limit,
  })
  const out: Candidate[] = []
  for (const c of carts) {
    const ordered = await db.order.count({ where: { customerId: c.customerId, createdAt: { gt: c.updatedAt }, status: { notIn: ['CANCELLED', 'PAYMENT_FAILED'] } } })
    if (ordered > 0) continue
    const items = Array.isArray(c.items) ? (c.items as Array<{ name?: string; price?: number; quantity?: number }>) : []
    const top = [...items].sort((a, b) => (b.price ?? 0) * (b.quantity ?? 1) - (a.price ?? 0) * (a.quantity ?? 1))[0]
    out.push({
      customerId: c.customerId,
      item: top?.name ?? 'محصولات انتخابی شما',
      dedupeKey: `cart:${c.customerId}:${c.updatedAt.getTime()}`,
      // Conditional: only stamp the snapshot we reminded about, not a cart changed meanwhile.
      onQueued: () => db.cartSnapshot.updateMany({ where: { id: c.id, updatedAt: c.updatedAt }, data: { lastReminderAt: now, updatedAt: c.updatedAt } }),
    })
  }
  return out
}

// ── Running ──────────────────────────────────────────────────────────────────

export interface AutomationPreviewRow {
  customerId: string
  name: string
  phone: string
  text: string
  /** Why this person would not get a message right now (null = would be messaged). */
  wouldSkip: string | null
}

export interface AutomationRun {
  kind: AutomationKind
  label: string
  enabled: boolean
  candidates: number
  queued: number
  skipped: Record<string, number>
  /** Up to 20 rows: who is (or would be) messaged, with the final text. */
  preview: AutomationPreviewRow[]
}

export interface GenerateOptions {
  now?: Date
  /** Lists who would be messaged without queuing, creating coupons or awarding points. */
  dryRun?: boolean
  kinds?: AutomationKind[]
  /** Disabled rules are normally skipped; dry runs of a disabled rule are allowed with this. */
  includeDisabled?: boolean
  limitPerRule?: number
}

export async function generateAutomationMessages(opts: GenerateOptions = {}): Promise<AutomationRun[]> {
  const now = opts.now ?? new Date()
  const dry = !!opts.dryRun
  const limit = Math.min(500, Math.max(1, opts.limitPerRule ?? 200))
  const rules = await getAutomationRules()
  const runs: AutomationRun[] = []

  for (const rule of rules) {
    const kind = rule.kind
    if (opts.kinds && !opts.kinds.includes(kind)) continue
    const run: AutomationRun = { kind, label: AUTOMATION_DEFAULTS[kind].label, enabled: rule.enabled, candidates: 0, queued: 0, skipped: {}, preview: [] }
    if (!rule.enabled && !(dry && opts.includeDisabled)) {
      runs.push(run)
      continue
    }
    const bump = (r: string) => (run.skipped[r] = (run.skipped[r] ?? 0) + 1)
    try {
      const params = cleanParams(kind, rule.params)
      const tpl = normalizeCouponTemplate(rule.couponTemplate)
      let cands: Candidate[] = []
      if (kind === 'vaccine') cands = await vaccineCandidates(now, params, limit)
      else if (kind === 'petBirthday') cands = await petBirthdayCandidates(now, limit)
      else if (kind === 'ownerBirthday') cands = await ownerBirthdayCandidates(now, limit, !dry)
      else if (kind === 'repeatPurchase') cands = await repeatPurchaseCandidates(now, params, limit)
      else if (kind === 'winback') cands = await winbackCandidates(now, params, limit)
      else cands = await abandonedCartCandidates(now, params, limit)
      run.candidates = cands.length

      for (const c of cands) {
        const rec = await loadRecipient(c.customerId, c.petId)
        if (!rec) {
          bump('no_customer')
          continue
        }
        if (dry) {
          const prev = await dryRunRow(c, rec, rule.bodyTemplate, tpl, now)
          if (prev.wouldSkip) bump(prev.wouldSkip)
          else run.queued++
          if (run.preview.length < 20) run.preview.push(prev)
          continue
        }
        if (await db.messageOutbox.findUnique({ where: { dedupeKey: c.dedupeKey }, select: { id: true } })) {
          bump('duplicate')
          continue
        }
        let couponId: string | null = null
        let extra: { code?: string; expiry?: string } = {}
        if (tpl) {
          const issued = await issueRecipientCoupon(rec, tpl, { source: `automation`, title: AUTOMATION_DEFAULTS[kind].label, now })
          if (!issued.ok) {
            bump(issued.reason)
            continue
          }
          couponId = issued.coupon.id
          extra = { code: issued.coupon.code, expiry: issued.expiry }
        }
        const res = await enqueueMessage({
          customerId: c.customerId,
          body: renderTemplate(rule.bodyTemplate, baseVars(rec, { ...extra, item: c.item })),
          kind: `automation:${kind}`,
          couponId,
          dedupeKey: c.dedupeKey,
          now,
        })
        if (res.ok) {
          run.queued++
          await c.onQueued?.().catch((e) => console.error('automation onQueued', e))
        } else {
          bump(res.reason)
          if (couponId) await discardCoupon(couponId)
          // The reminder is moot when it can never be sent (no consent): stamp it so it is not rescanned forever.
          if (res.reason === 'no_consent' || res.reason === 'unsubscribed' || res.reason === 'blocked') await c.onQueued?.().catch(() => {})
        }
      }
    } catch (err) {
      console.error(`automation ${kind} failed`, err)
      bump('error')
    }
    runs.push(run)
  }
  return runs
}

async function dryRunRow(c: Candidate, rec: NonNullable<Awaited<ReturnType<typeof loadRecipient>>>, body: string, tpl: CouponTemplate | null, now: Date): Promise<AutomationPreviewRow> {
  const cust = await db.customer.findUnique({ where: { id: c.customerId }, select: { firstName: true, lastName: true, phone: true } })
  const text = withUnsubscribeFooter(renderTemplate(body, baseVars(rec, { item: c.item, code: tpl ? 'PB-XXXXXX' : undefined, expiry: tpl ? '—' : undefined })))
  let wouldSkip: string | null = null
  if (await db.messageOutbox.findUnique({ where: { dedupeKey: c.dedupeKey }, select: { id: true } })) wouldSkip = 'duplicate'
  else {
    const who = await resolveRecipient(db, { customerId: c.customerId })
    if ('error' in who) wouldSkip = who.error
    else if (!who.allowed.ok) wouldSkip = who.allowed.reason
    else if ((await marketingCountLast24h(db, who.customerId, who.phone, now)) >= MARKETING_DAILY_CAP) wouldSkip = 'daily_cap'
    else if (tpl?.restrictToPetBrand && !rec.pet?.foodBrand) wouldSkip = 'no_pet_brand'
  }
  return {
    customerId: c.customerId,
    name: [cust?.firstName, cust?.lastName].filter(Boolean).join(' ') || 'بدون نام',
    phone: cust?.phone ?? '',
    text,
    wouldSkip,
  }
}
