import 'server-only'
import { Prisma, type MessageOutbox, type MessageStatus } from '@prisma/client'
import { db } from '@/lib/db'
import { normalizeMobile } from '@/lib/text/iran'
import {
  MARKETING_DAILY_CAP,
  MAX_ATTEMPTS,
  MAX_BODY_CHARS,
  consentVerdict,
  isMarketingKind,
  isQuietHour,
  nextSendTime,
  retryDelayMinutes,
  withUnsubscribeFooter,
} from '@/lib/club/messaging/rules'
import { defaultSender, senderStatus, type SendFn } from '@/lib/club/messaging/sender'

type Client = Prisma.TransactionClient | typeof db

export interface EnqueueInput {
  customerId?: string | null
  phone?: string | null
  body: string
  /** campaign | automation:<rule> | admin | system */
  kind: string
  scheduledFor?: Date
  campaignId?: string | null
  couponId?: string | null
  /** Same key twice = the second call does nothing. */
  dedupeKey?: string | null
  /** Only for kind "admin": an admin who deliberately writes to one customer may exceed the daily cap. */
  bypassDailyCap?: boolean
  now?: Date
}

export type EnqueueFailure = 'no_phone' | 'invalid_phone' | 'blocked' | 'no_consent' | 'unsubscribed' | 'daily_cap' | 'duplicate' | 'too_long' | 'empty'

export type EnqueueResult =
  | { ok: true; id: string; scheduledFor: Date; delayedByQuietHours: boolean; body: string }
  | { ok: false; reason: EnqueueFailure }

interface Recipient {
  customerId: string | null
  phone: string
  allowed: { ok: true } | { ok: false; reason: 'blocked' | 'no_consent' | 'unsubscribed' }
}

/** Resolves who the phone belongs to and whether they agreed to marketing SMS. */
export async function resolveRecipient(client: Client, input: { customerId?: string | null; phone?: string | null }): Promise<Recipient | { error: 'no_phone' | 'invalid_phone' }> {
  let customer = input.customerId
    ? await client.customer.findUnique({ where: { id: input.customerId }, select: { id: true, phone: true, isBlocked: true, marketingSmsConsent: true } })
    : null
  const rawPhone = customer?.phone ?? input.phone ?? ''
  if (!rawPhone.trim()) return { error: 'no_phone' }
  const phone = normalizeMobile(rawPhone)
  if (!phone) return { error: 'invalid_phone' }
  if (!customer && !input.customerId) {
    customer = await client.customer.findUnique({ where: { phone }, select: { id: true, phone: true, isBlocked: true, marketingSmsConsent: true } })
  }
  const contact = await client.marketingContact.findUnique({ where: { phone }, select: { unsubscribedAt: true } })
  const unsubscribed = !!contact?.unsubscribedAt
  if (customer) {
    return { customerId: customer.id, phone, allowed: consentVerdict({ isBlocked: customer.isBlocked, marketingSmsConsent: customer.marketingSmsConsent, unsubscribed }) }
  }
  // A phone that is not a customer: only a marketing contact who opted in may be messaged.
  return { customerId: null, phone, allowed: consentVerdict({ marketingSmsConsent: !!contact, unsubscribed }) }
}

/** Marketing messages queued, being sent, or sent in the last 24 hours to this person. */
export async function marketingCountLast24h(client: Client, customerId: string | null, phone: string, now: Date): Promise<number> {
  const since = new Date(now.getTime() - 86_400_000)
  return client.messageOutbox.count({
    where: {
      kind: { not: 'system' },
      OR: [...(customerId ? [{ customerId }] : []), { phone }],
      AND: [{ OR: [{ status: 'QUEUED' as MessageStatus }, { status: 'SENDING' as MessageStatus, scheduledFor: { gte: new Date(now.getTime() - 10 * 60_000) } }, { status: 'SENT' as MessageStatus, sentAt: { gte: since } }] }],
    },
  })
}

/**
 * Puts one message in the queue, enforcing consent, valid number, one marketing SMS per 24h,
 * quiet hours (21:00-09:00 Tehran, held until 09:30), a length cap and the unsubscribe footer.
 * Never throws for policy reasons: the result says why a message was not queued.
 */
export async function enqueueMessage(input: EnqueueInput): Promise<EnqueueResult> {
  const now = input.now ?? new Date()
  const bodyRaw = (input.body ?? '').trim()
  if (!bodyRaw) return { ok: false, reason: 'empty' }
  const marketing = isMarketingKind(input.kind)
  const body = marketing ? withUnsubscribeFooter(bodyRaw) : bodyRaw
  if (Array.from(body).length > MAX_BODY_CHARS) return { ok: false, reason: 'too_long' }

  const lockKey = input.customerId ?? input.phone ?? 'anonymous'
  try {
    return await db.$transaction(async (tx) => {
      // Serialises writers for the same person so two parallel callers cannot both pass the daily cap.
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`outbox:${lockKey}`}))`
      if (input.dedupeKey) {
        const dup = await tx.messageOutbox.findUnique({ where: { dedupeKey: input.dedupeKey }, select: { id: true } })
        if (dup) return { ok: false, reason: 'duplicate' } as EnqueueResult
      }
      const who = await resolveRecipient(tx, input)
      if ('error' in who) return { ok: false, reason: who.error } as EnqueueResult
      if (marketing) {
        if (!who.allowed.ok) return { ok: false, reason: who.allowed.reason } as EnqueueResult
        const capApplies = !(input.kind === 'admin' && input.bypassDailyCap)
        if (capApplies && (await marketingCountLast24h(tx, who.customerId, who.phone, now)) >= MARKETING_DAILY_CAP) {
          return { ok: false, reason: 'daily_cap' } as EnqueueResult
        }
      }
      const wanted = input.scheduledFor && input.scheduledFor > now ? input.scheduledFor : now
      const when = marketing ? nextSendTime(wanted) : wanted
      const row = await tx.messageOutbox.create({
        data: {
          customerId: who.customerId,
          phone: who.phone,
          kind: input.kind,
          body,
          scheduledFor: when,
          campaignId: input.campaignId ?? null,
          couponId: input.couponId ?? null,
          dedupeKey: input.dedupeKey ?? null,
        },
      })
      return { ok: true, id: row.id, scheduledFor: when, delayedByQuietHours: when.getTime() !== wanted.getTime(), body } as EnqueueResult
    })
  } catch (err) {
    if ((err as { code?: string })?.code === 'P2002') return { ok: false, reason: 'duplicate' }
    throw err
  }
}

const STALE_SENDING_MS = 10 * 60_000

export interface ProcessResult {
  /** False when no provider is configured: nothing was touched, rows stay queued. */
  configured: boolean
  claimed: number
  sent: number
  failed: number
  retried: number
  skipped: number
  deferred: number
}

/**
 * Sends queued messages that are due. Each row is claimed with a conditional update
 * (QUEUED -> SENDING), so two overlapping cron runs can never send the same message twice.
 * Consent and quiet hours are checked again at send time.
 */
export async function processOutbox(opts: { limit?: number; now?: Date; send?: SendFn; /** Only these rows (e.g. "send this one now", tests). */ ids?: string[] } = {}): Promise<ProcessResult> {
  const now = opts.now ?? new Date()
  const send = opts.send ?? defaultSender
  const result: ProcessResult = { configured: true, claimed: 0, sent: 0, failed: 0, retried: 0, skipped: 0, deferred: 0 }
  if (!opts.send && !senderStatus().configured) return { ...result, configured: false }

  // A run that died mid-send leaves rows in SENDING (scheduledFor holds the claim time): put them back.
  if (!opts.ids) {
    await db.messageOutbox.updateMany({ where: { status: 'SENDING', scheduledFor: { lt: new Date(now.getTime() - STALE_SENDING_MS) } }, data: { status: 'QUEUED' } })
  }
  const limit = Math.min(500, Math.max(1, opts.limit ?? 100))
  const due = await db.messageOutbox.findMany({
    where: { status: 'QUEUED', scheduledFor: { lte: now }, ...(opts.ids ? { id: { in: opts.ids } } : {}) },
    orderBy: { scheduledFor: 'asc' },
    take: limit,
    select: { id: true },
  })
  const touchedCampaigns = new Set<string>()

  for (const { id } of due) {
    const claim = await db.messageOutbox.updateMany({ where: { id, status: 'QUEUED' }, data: { status: 'SENDING', attempts: { increment: 1 }, scheduledFor: now } })
    if (claim.count !== 1) continue
    result.claimed++
    const row = await db.messageOutbox.findUniqueOrThrow({ where: { id } })
    if (row.campaignId) touchedCampaigns.add(row.campaignId)
    try {
      if (isMarketingKind(row.kind)) {
        if (isQuietHour(now)) {
          await db.messageOutbox.update({ where: { id }, data: { status: 'QUEUED', attempts: { decrement: 1 }, scheduledFor: nextSendTime(now) } })
          result.deferred++
          continue
        }
        const who = await resolveRecipient(db, { customerId: row.customerId, phone: row.phone })
        if ('error' in who || !who.allowed.ok) {
          const reason = 'error' in who ? who.error : (who.allowed as { reason: string }).reason
          await db.messageOutbox.update({ where: { id }, data: { status: 'SKIPPED', error: reason } })
          result.skipped++
          continue
        }
      }
      const res = await send(row.phone, row.body)
      if (res.ok) {
        await db.messageOutbox.update({ where: { id }, data: { status: 'SENT', sentAt: new Date(), providerRef: res.ref ?? null, error: null } })
        result.sent++
      } else if (row.attempts >= MAX_ATTEMPTS) {
        await db.messageOutbox.update({ where: { id }, data: { status: 'FAILED', error: (res.error ?? 'unknown').slice(0, 300) } })
        result.failed++
      } else {
        const retryAt = new Date(now.getTime() + retryDelayMinutes(row.attempts) * 60_000)
        await db.messageOutbox.update({ where: { id }, data: { status: 'QUEUED', error: (res.error ?? 'unknown').slice(0, 300), scheduledFor: retryAt } })
        result.retried++
      }
    } catch (err) {
      console.error('outbox send crashed', id, err)
      await db.messageOutbox
        .update({ where: { id }, data: { status: row.attempts >= MAX_ATTEMPTS ? 'FAILED' : 'QUEUED', error: 'internal error', scheduledFor: new Date(now.getTime() + 15 * 60_000) } })
        .catch(() => {})
      result.retried++
    }
  }
  for (const campaignId of touchedCampaigns) await syncCampaignProgress(campaignId).catch((e) => console.error('campaign progress', e))
  return result
}

/** Recomputes a campaign's counters from its outbox rows and moves it SCHEDULED -> RUNNING -> DONE. */
export async function syncCampaignProgress(campaignId: string): Promise<void> {
  const groups = await db.messageOutbox.groupBy({ by: ['status'], where: { campaignId }, _count: { _all: true } })
  const n = (s: MessageStatus) => groups.find((g) => g.status === s)?._count._all ?? 0
  const sent = n('SENT')
  const failed = n('FAILED')
  const pending = n('QUEUED') + n('SENDING')
  const camp = await db.messageCampaign.findUnique({ where: { id: campaignId }, select: { status: true } })
  if (!camp || camp.status === 'CANCELLED' || camp.status === 'DRAFT') return
  const done = pending === 0
  await db.messageCampaign.update({
    where: { id: campaignId },
    data: {
      sentCount: sent,
      failedCount: failed,
      ...(done ? { status: 'DONE', finishedAt: new Date() } : sent + failed > 0 && camp.status === 'SCHEDULED' ? { status: 'RUNNING' } : {}),
    },
  })
}

/** Cancels a message that has not been sent yet. */
export async function cancelMessage(id: string): Promise<boolean> {
  const r = await db.messageOutbox.updateMany({ where: { id, status: 'QUEUED' }, data: { status: 'CANCELLED' } })
  return r.count === 1
}

/** Puts a failed (or skipped for a temporary reason) message back in the queue with a fresh attempt budget. */
export async function retryMessage(id: string, now = new Date()): Promise<boolean> {
  const r = await db.messageOutbox.updateMany({ where: { id, status: 'FAILED' }, data: { status: 'QUEUED', attempts: 0, error: null, scheduledFor: nextSendTime(now) } })
  return r.count === 1
}

export interface OutboxFilter {
  status?: MessageStatus
  kind?: string
  customerId?: string
  campaignId?: string
  page?: number
  pageSize?: number
}

export async function listOutbox(f: OutboxFilter = {}): Promise<{ rows: MessageOutbox[]; total: number; page: number; pages: number }> {
  const pageSize = Math.min(100, Math.max(1, f.pageSize ?? 30))
  const page = Math.max(1, f.page ?? 1)
  const where: Prisma.MessageOutboxWhereInput = {
    ...(f.status ? { status: f.status } : {}),
    ...(f.kind ? { kind: f.kind } : {}),
    ...(f.customerId ? { customerId: f.customerId } : {}),
    ...(f.campaignId ? { campaignId: f.campaignId } : {}),
  }
  const [rows, total] = await Promise.all([
    db.messageOutbox.findMany({ where, orderBy: { createdAt: 'desc' }, skip: (page - 1) * pageSize, take: pageSize }),
    db.messageOutbox.count({ where }),
  ])
  return { rows, total, page, pages: Math.max(1, Math.ceil(total / pageSize)) }
}

export async function outboxCounts(): Promise<Record<MessageStatus, number>> {
  const groups = await db.messageOutbox.groupBy({ by: ['status'], _count: { _all: true } })
  const out = { QUEUED: 0, SENDING: 0, SENT: 0, FAILED: 0, SKIPPED: 0, CANCELLED: 0 } as Record<MessageStatus, number>
  for (const g of groups) out[g.status] = g._count._all
  return out
}

/** Handles a customer replying "1" (or an admin's manual opt-out): stops marketing SMS and cancels queued ones. */
export async function unsubscribePhone(phoneRaw: string, now = new Date()): Promise<boolean> {
  const phone = normalizeMobile(phoneRaw)
  if (!phone) return false
  await db.$transaction([
    db.customer.updateMany({ where: { phone, marketingSmsConsent: true }, data: { marketingSmsConsent: false, marketingConsentAt: now } }),
    db.marketingContact.updateMany({ where: { phone, unsubscribedAt: null }, data: { unsubscribedAt: now } }),
    db.messageOutbox.updateMany({ where: { phone, status: 'QUEUED', kind: { not: 'system' } }, data: { status: 'CANCELLED', error: 'unsubscribed' } }),
  ])
  return true
}
