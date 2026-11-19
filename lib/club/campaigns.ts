import 'server-only'
import { Prisma, type MessageCampaign } from '@prisma/client'
import { db } from '@/lib/db'
import { COMPLETED_ORDER_STATUSES } from '@/lib/marketing/coupons'
import { normalizeRules, previewSegment, segmentCustomerIds, type SegmentRules } from '@/lib/club/segments'
import { renderTemplate, unknownVariables, usesCoupon } from '@/lib/club/messaging/render'
import { countSegments, withUnsubscribeFooter, MAX_BODY_CHARS } from '@/lib/club/messaging/rules'
import { enqueueMessage, syncCampaignProgress, type EnqueueFailure } from '@/lib/club/messaging/outbox'
import {
  baseVars,
  discardCoupon,
  findBrandForFood,
  formatExpiry,
  issueRecipientCoupon,
  loadRecipient,
  normalizeCouponTemplate,
  type CouponTemplate,
} from '@/lib/club/messaging/personalize'

/** Most recipients one launch will queue. Larger audiences are cut off (the admin sees the count). */
export const LAUNCH_CAP = 5000
export const CONVERSION_WINDOW_DAYS = 14

export interface CampaignInput {
  name: string
  body: string
  segmentId?: string | null
  rules?: unknown
  couponTemplate?: unknown
  scheduledFor?: Date | null
}

type Validated = { ok: true; name: string; body: string; segmentId: string | null; rules: SegmentRules; couponTemplate: CouponTemplate | null; scheduledFor: Date | null } | { ok: false; error: string }

async function validate(input: CampaignInput): Promise<Validated> {
  const name = (input.name ?? '').trim()
  const body = (input.body ?? '').trim()
  if (!name) return { ok: false, error: 'نام کمپین را وارد کنید.' }
  if (name.length > 80) return { ok: false, error: 'نام کمپین حداکثر ۸۰ نویسه باشد.' }
  if (!body) return { ok: false, error: 'متن پیام را بنویسید.' }
  if (Array.from(withUnsubscribeFooter(body)).length > MAX_BODY_CHARS) return { ok: false, error: 'متن پیام بیش از حد بلند است.' }
  const unknown = unknownVariables(body)
  if (unknown.length) return { ok: false, error: `متغیر ناشناخته در متن: ${unknown.map((u) => `{${u}}`).join('، ')}` }
  const couponTemplate = input.couponTemplate ? normalizeCouponTemplate(input.couponTemplate) : null
  if (input.couponTemplate && !couponTemplate) return { ok: false, error: 'تنظیمات کد تخفیف معتبر نیست.' }
  if (usesCoupon(body) && !couponTemplate) return { ok: false, error: 'متن پیام از {code} یا {expiry} استفاده می‌کند ولی کد تخفیفی برای کمپین تنظیم نشده است.' }
  let rules = normalizeRules(input.rules ?? {})
  let segmentId: string | null = null
  if (input.segmentId) {
    const seg = await db.segment.findUnique({ where: { id: input.segmentId }, select: { id: true, rules: true } })
    if (!seg) return { ok: false, error: 'گروه مخاطب پیدا نشد.' }
    segmentId = seg.id
    rules = normalizeRules(seg.rules)
  }
  const scheduledFor = input.scheduledFor && input.scheduledFor.getTime() > Date.now() ? input.scheduledFor : null
  return { ok: true, name, body, segmentId, rules, couponTemplate, scheduledFor }
}

export type DraftResult = { ok: true; id: string } | { ok: false; error: string }

export async function createCampaignDraft(input: CampaignInput, adminId?: string | null): Promise<DraftResult> {
  const v = await validate(input)
  if (!v.ok) return v
  const c = await db.messageCampaign.create({
    data: {
      name: v.name,
      body: v.body,
      segmentId: v.segmentId,
      rulesSnapshot: { rules: v.rules } as unknown as Prisma.InputJsonValue,
      couponTemplate: (v.couponTemplate ?? undefined) as unknown as Prisma.InputJsonValue | undefined,
      scheduledFor: v.scheduledFor,
      createdByAdminId: adminId ?? null,
    },
  })
  return { ok: true, id: c.id }
}

export async function updateCampaignDraft(id: string, input: CampaignInput): Promise<DraftResult> {
  const v = await validate(input)
  if (!v.ok) return v
  const r = await db.messageCampaign.updateMany({
    where: { id, status: 'DRAFT' },
    data: {
      name: v.name,
      body: v.body,
      segmentId: v.segmentId,
      rulesSnapshot: { rules: v.rules } as unknown as Prisma.InputJsonValue,
      couponTemplate: v.couponTemplate ? (v.couponTemplate as unknown as Prisma.InputJsonValue) : Prisma.JsonNull,
      scheduledFor: v.scheduledFor,
    },
  })
  return r.count === 1 ? { ok: true, id } : { ok: false, error: 'فقط پیش‌نویس قابل ویرایش است.' }
}

export interface PreviewSample {
  id: string
  name: string
  phone: string
  tier: string
  petNames: string[]
  text: string
  chars: number
  segments: number
  /** Why this particular customer would be skipped at launch (e.g. pet brand unknown); null when fine. */
  wouldSkip: string | null
}

export interface CampaignPreview {
  count: number
  consentExcluded: number
  /** Number of SMS parts for the longest sample (a cost indicator). */
  maxSegments: number
  willBeCut: boolean
  sample: PreviewSample[]
}

/** Audience size and a few fully rendered messages, without creating anything. */
export async function previewCampaign(args: { rules?: unknown; body: string; couponTemplate?: unknown; segmentId?: string | null; sampleSize?: number }): Promise<CampaignPreview> {
  let rules = normalizeRules(args.rules ?? {})
  if (args.segmentId) {
    const seg = await db.segment.findUnique({ where: { id: args.segmentId }, select: { rules: true } })
    if (seg) rules = normalizeRules(seg.rules)
  }
  const tpl = args.couponTemplate ? normalizeCouponTemplate(args.couponTemplate) : null
  const prev = await previewSegment({ ...rules, smsConsentOnly: true }, args.sampleSize ?? 5)
  const sample: PreviewSample[] = []
  const now = new Date()
  for (const s of prev.sample) {
    const rec = await loadRecipient(s.id)
    if (!rec) continue
    let wouldSkip: string | null = null
    if (tpl?.restrictToPetBrand) {
      if (!(await findBrandForFood(rec.pet?.foodBrand))) wouldSkip = 'no_pet_brand'
    }
    const text = withUnsubscribeFooter(
      renderTemplate(args.body, baseVars(rec, { code: tpl ? 'PB-XXXXXX' : undefined, expiry: tpl ? formatExpiry(new Date(now.getTime() + tpl.validDays * 86_400_000)) : undefined }))
    )
    const seg = countSegments(text)
    sample.push({ id: s.id, name: s.name, phone: s.phone, tier: s.tier, petNames: s.petNames, text, chars: seg.chars, segments: seg.segments, wouldSkip })
  }
  return {
    count: prev.count,
    consentExcluded: prev.consentExcluded,
    maxSegments: sample.reduce((m, s) => Math.max(m, s.segments), 0),
    willBeCut: prev.count > LAUNCH_CAP,
    sample,
  }
}

export interface LaunchResult {
  ok: boolean
  error?: string
  audience: number
  enqueued: number
  skipped: Record<string, number>
}

/**
 * Snapshots the audience and queues one personalised message per recipient (dedupe key
 * campaign:<id>:<customerId>, so a repeated launch can never double send). Consent is always enforced.
 */
export async function launchCampaign(id: string, now = new Date()): Promise<LaunchResult> {
  const camp = await db.messageCampaign.findUnique({ where: { id } })
  if (!camp) return { ok: false, error: 'کمپین پیدا نشد.', audience: 0, enqueued: 0, skipped: {} }
  const future = camp.scheduledFor && camp.scheduledFor.getTime() > now.getTime() ? camp.scheduledFor : null
  // Atomic: only one caller can move a draft to running.
  const claim = await db.messageCampaign.updateMany({ where: { id, status: 'DRAFT' }, data: { status: future ? 'SCHEDULED' : 'RUNNING', startedAt: now } })
  if (claim.count !== 1) return { ok: false, error: 'این کمپین قبلاً ارسال شده یا لغو شده است.', audience: 0, enqueued: 0, skipped: {} }

  const skipped: Record<string, number> = {}
  const bump = (r: string) => (skipped[r] = (skipped[r] ?? 0) + 1)
  let enqueued = 0
  let audience = 0
  try {
    let rules = normalizeRules((camp.rulesSnapshot as { rules?: unknown } | null)?.rules ?? {})
    if (camp.segmentId) {
      const seg = await db.segment.findUnique({ where: { id: camp.segmentId }, select: { rules: true } })
      if (seg) rules = normalizeRules(seg.rules)
    }
    rules = { ...rules, smsConsentOnly: true }
    const ids = await segmentCustomerIds(rules, LAUNCH_CAP, now)
    audience = ids.length
    const tpl = normalizeCouponTemplate(camp.couponTemplate)
    const baseTime = future ?? now

    for (const customerId of ids) {
      const dedupeKey = `campaign:${id}:${customerId}`
      const rec = await loadRecipient(customerId)
      if (!rec) {
        bump('no_customer')
        continue
      }
      let couponId: string | null = null
      let extra: { code?: string; expiry?: string } = {}
      if (tpl) {
        // Cheap pre-check so a duplicate or a closed door does not leave a stray coupon behind.
        if (await db.messageOutbox.findUnique({ where: { dedupeKey }, select: { id: true } })) {
          bump('duplicate')
          continue
        }
        const issued = await issueRecipientCoupon(rec, tpl, { source: 'campaign', title: camp.name, now: baseTime })
        if (!issued.ok) {
          bump(issued.reason)
          continue
        }
        couponId = issued.coupon.id
        extra = { code: issued.coupon.code, expiry: issued.expiry }
      }
      const res = await enqueueMessage({
        customerId,
        body: renderTemplate(camp.body, baseVars(rec, extra)),
        kind: 'campaign',
        scheduledFor: future ?? undefined,
        campaignId: id,
        couponId,
        dedupeKey,
        now,
      })
      if (res.ok) enqueued++
      else {
        bump(res.reason satisfies EnqueueFailure)
        if (couponId) await discardCoupon(couponId)
      }
    }
  } catch (err) {
    console.error('launchCampaign failed', id, err)
    if (enqueued === 0) await db.messageCampaign.updateMany({ where: { id, status: { in: ['RUNNING', 'SCHEDULED'] } }, data: { status: 'DRAFT', startedAt: null } })
    return { ok: false, error: 'ارسال کمپین با خطا روبه‌رو شد.', audience, enqueued, skipped }
  }

  await db.messageCampaign.update({
    where: { id },
    data: {
      recipientsCount: enqueued,
      rulesSnapshot: { rules: normalizeRules((camp.rulesSnapshot as { rules?: unknown } | null)?.rules ?? {}), launch: { audience, enqueued, skipped, at: now.toISOString(), cutAt: audience >= LAUNCH_CAP ? LAUNCH_CAP : null } } as unknown as Prisma.InputJsonValue,
    },
  })
  if (enqueued === 0) await db.messageCampaign.update({ where: { id }, data: { status: 'DONE', finishedAt: new Date() } })
  return { ok: true, audience, enqueued, skipped }
}

/** Stops a campaign: queued messages are cancelled and their unused coupons switched off. */
export async function cancelCampaign(id: string): Promise<{ ok: boolean; cancelledMessages: number }> {
  const claim = await db.messageCampaign.updateMany({ where: { id, status: { in: ['DRAFT', 'SCHEDULED', 'RUNNING'] } }, data: { status: 'CANCELLED', finishedAt: new Date() } })
  if (claim.count !== 1) return { ok: false, cancelledMessages: 0 }
  const queued = await db.messageOutbox.findMany({ where: { campaignId: id, status: 'QUEUED' }, select: { id: true, couponId: true } })
  const res = await db.messageOutbox.updateMany({ where: { campaignId: id, status: 'QUEUED' }, data: { status: 'CANCELLED' } })
  const couponIds = queued.map((q) => q.couponId).filter((x): x is string => !!x)
  if (couponIds.length) await db.coupon.updateMany({ where: { id: { in: couponIds }, usedCount: 0 }, data: { isActive: false } })
  await syncCampaignProgress(id).catch(() => {})
  return { ok: true, cancelledMessages: res.count }
}

export interface CampaignStats {
  recipients: number
  queued: number
  sent: number
  failed: number
  skipped: number
  cancelled: number
  /** Customers who placed an order within 14 days after their message was sent. */
  converted: number
  /** Of those, how many used the campaign coupon. */
  couponRedeemed: number
  revenue: number
}

/** Live numbers from the outbox and orders; also stored back on the campaign row. */
export async function getCampaignStats(id: string): Promise<CampaignStats> {
  const rows = await db.messageOutbox.findMany({ where: { campaignId: id }, select: { status: true, customerId: true, sentAt: true, couponId: true } })
  const count = (s: string) => rows.filter((r) => r.status === s).length
  const sentRows = rows.filter((r) => r.status === 'SENT' && r.sentAt && r.customerId)
  let converted = 0
  let couponRedeemed = 0
  let revenue = 0
  if (sentRows.length) {
    const earliest = new Date(Math.min(...sentRows.map((r) => r.sentAt!.getTime())))
    const latest = new Date(Math.max(...sentRows.map((r) => r.sentAt!.getTime())) + CONVERSION_WINDOW_DAYS * 86_400_000)
    const orders = await db.order.findMany({
      where: { customerId: { in: [...new Set(sentRows.map((r) => r.customerId!))] }, status: { in: [...COMPLETED_ORDER_STATUSES] }, createdAt: { gte: earliest, lte: latest } },
      select: { customerId: true, createdAt: true, couponId: true, total: true },
    })
    const bySent = new Map(sentRows.map((r) => [r.customerId!, r]))
    const seen = new Set<string>()
    for (const o of orders) {
      const s = bySent.get(o.customerId)
      if (!s?.sentAt) continue
      const t = o.createdAt.getTime()
      if (t < s.sentAt.getTime() || t > s.sentAt.getTime() + CONVERSION_WINDOW_DAYS * 86_400_000) continue
      revenue += o.total
      if (!seen.has(o.customerId)) {
        seen.add(o.customerId)
        converted++
      }
      if (s.couponId && o.couponId === s.couponId) couponRedeemed++
    }
  }
  const stats: CampaignStats = {
    recipients: rows.length,
    queued: count('QUEUED') + count('SENDING'),
    sent: count('SENT'),
    failed: count('FAILED'),
    skipped: count('SKIPPED'),
    cancelled: count('CANCELLED'),
    converted,
    couponRedeemed,
    revenue,
  }
  await db.messageCampaign.updateMany({ where: { id }, data: { sentCount: stats.sent, failedCount: stats.failed, convertedCount: converted } }).catch(() => {})
  return stats
}

export async function listCampaigns(take = 50): Promise<MessageCampaign[]> {
  return db.messageCampaign.findMany({ orderBy: { createdAt: 'desc' }, take })
}

export async function getCampaign(id: string): Promise<MessageCampaign | null> {
  return db.messageCampaign.findUnique({ where: { id } })
}
