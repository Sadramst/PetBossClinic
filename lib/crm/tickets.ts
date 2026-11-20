import type { Prisma, TicketPriority, TicketStatus } from '@prisma/client'
import { db } from '@/lib/db'
import { CrmError, MSG } from '@/lib/crm/errors'
import { recordActivity } from '@/lib/crm/activity'
import { notifyStaff } from '@/lib/crm/notify'
import { normalizeContactPhone, resolveContact } from '@/lib/crm/contacts'
import { newId, pageArgs, cleanQuery, type Paged } from '@/lib/crm/types'

export const TICKET_STATUSES: readonly TicketStatus[] = ['OPEN', 'PENDING', 'RESOLVED', 'CLOSED']
export const TICKET_PRIORITIES: readonly TicketPriority[] = ['LOW', 'NORMAL', 'HIGH']

export const TICKET_STATUS_LABEL_FA: Record<TicketStatus, string> = {
  OPEN: 'باز',
  PENDING: 'در انتظار مشتری',
  RESOLVED: 'حل‌شده',
  CLOSED: 'بسته',
}

/** OPEN -> PENDING (waiting on the customer) -> RESOLVED -> CLOSED; any customer inbound reopens. */
export const TICKET_TRANSITIONS: Record<TicketStatus, TicketStatus[]> = {
  OPEN: ['PENDING', 'RESOLVED', 'CLOSED'],
  PENDING: ['OPEN', 'RESOLVED', 'CLOSED'],
  RESOLVED: ['OPEN', 'CLOSED'],
  CLOSED: ['OPEN'],
}

/* ------------------------------------------------------------------ SLA */

/** Tehran is a fixed UTC+03:30. Working time: Saturday to Thursday, 09:00-18:00. */
const TEHRAN_MS = (3 * 60 + 30) * 60_000
const DAY_MS = 86_400_000
export const WORK_START_H = 9
export const WORK_END_H = 18
export const FIRST_RESPONSE_HOURS = 4
export const RESOLUTION_DAYS = 2

/** Working hours that elapsed between two instants (Tehran calendar, Friday off). Pure. */
export function elapsedWorkingHours(from: Date, to: Date): number {
  if (to.getTime() <= from.getTime()) return 0
  const a = from.getTime() + TEHRAN_MS
  const b = to.getTime() + TEHRAN_MS
  let total = 0
  for (let dayStart = Math.floor(a / DAY_MS) * DAY_MS; dayStart < b; dayStart += DAY_MS) {
    const weekday = new Date(dayStart).getUTCDay() // 0 Sunday .. 5 Friday .. 6 Saturday
    if (weekday === 5) continue
    const s = Math.max(a, dayStart + WORK_START_H * 3_600_000)
    const e = Math.min(b, dayStart + WORK_END_H * 3_600_000)
    if (e > s) total += e - s
  }
  return total / 3_600_000
}

/** ok: on track; due: past 75% of the first-response target; breached: target missed (or resolution over 2 days). */
export function slaState(t: { createdAt: Date; firstResponseAt: Date | null; status: TicketStatus }, now: Date = new Date()): 'ok' | 'due' | 'breached' {
  if (t.status === 'RESOLVED' || t.status === 'CLOSED') return 'ok'
  if ((now.getTime() - t.createdAt.getTime()) / DAY_MS > RESOLUTION_DAYS) return 'breached'
  if (t.firstResponseAt) return 'ok'
  const h = elapsedWorkingHours(t.createdAt, now)
  if (h >= FIRST_RESPONSE_HOURS) return 'breached'
  if (h >= FIRST_RESPONSE_HOURS * 0.75) return 'due'
  return 'ok'
}

/* ---------------------------------------------------------------- reading */

export type TicketRow = {
  id: string
  name: string
  email: string | null
  phone: string
  subject: string | null
  message: string
  isRead: boolean
  status: TicketStatus
  priority: TicketPriority
  assigneeId: string | null
  contactId: string | null
  customerId: string | null
  firstResponseAt: Date | null
  resolvedAt: Date | null
  createdAt: Date
  sla: 'ok' | 'due' | 'breached'
}

export type TicketReplyRow = {
  id: string
  messageId: string
  authorUserId: string | null
  internal: boolean
  channel: string | null
  body: string
  outboxId: string | null
  createdAt: Date
}

type RawTicket = Omit<TicketRow, 'sla'> & Record<string, unknown>

function toRow(m: RawTicket, now: Date): TicketRow {
  return {
    id: m.id,
    name: m.name,
    email: m.email,
    phone: m.phone,
    subject: m.subject,
    message: m.message,
    isRead: m.isRead,
    status: m.status,
    priority: m.priority,
    assigneeId: m.assigneeId,
    contactId: m.contactId,
    customerId: m.customerId,
    firstResponseAt: m.firstResponseAt,
    resolvedAt: m.resolvedAt,
    createdAt: m.createdAt,
    sla: slaState(m, now),
  }
}

export type TicketListQuery = { q?: string; status?: TicketStatus; assignee?: string; priority?: TicketPriority; breached?: boolean; page?: number; size?: number; now?: Date }

export function buildTicketWhere(q: TicketListQuery): Prisma.ContactMessageWhereInput {
  const and: Prisma.ContactMessageWhereInput[] = []
  const term = cleanQuery(q.q)
  if (term) {
    const phone = normalizeContactPhone(term)
    and.push({
      OR: [
        { name: { contains: term, mode: 'insensitive' } },
        { subject: { contains: term, mode: 'insensitive' } },
        { message: { contains: term, mode: 'insensitive' } },
        { phone: { contains: term } },
        ...(phone ? [{ normalizedPhone: phone }] : []),
      ],
    })
  }
  if (q.status) and.push({ status: q.status })
  if (q.priority) and.push({ priority: q.priority })
  if (q.assignee === 'none') and.push({ assigneeId: null })
  else if (q.assignee) and.push({ assigneeId: q.assignee })
  return and.length ? { AND: and } : {}
}

export async function listTickets(q: TicketListQuery): Promise<Paged<TicketRow>> {
  const now = q.now ?? new Date()
  const { page, size, skip } = pageArgs(q)
  const where = buildTicketWhere(q)
  const orderBy: Prisma.ContactMessageOrderByWithRelationInput[] = [{ createdAt: 'desc' }]
  if (q.breached) {
    // Working-hours maths cannot run in SQL: take the active candidates (bounded) and filter in memory.
    const cand = await db.contactMessage.findMany({ where: { AND: [where, { status: { in: ['OPEN', 'PENDING'] } }] }, orderBy, take: 1000 })
    const hits = cand.map((m) => toRow(m as unknown as RawTicket, now)).filter((r) => r.sla === 'breached')
    return { rows: hits.slice(skip, skip + size), total: hits.length, page, size }
  }
  const [rows, total] = await Promise.all([db.contactMessage.findMany({ where, orderBy, skip, take: size }), db.contactMessage.count({ where })])
  return { rows: rows.map((m) => toRow(m as unknown as RawTicket, now)), total, page, size }
}

/** Opening a ticket marks it read. */
export async function getTicket(id: string): Promise<{ ticket: TicketRow; replies: TicketReplyRow[] }> {
  const m = await db.contactMessage.findUnique({ where: { id } })
  if (!m) throw new CrmError('NOT_FOUND', MSG.notFound)
  if (!m.isRead) await db.contactMessage.updateMany({ where: { id, isRead: false }, data: { isRead: true } })
  const replies = await db.ticketReply.findMany({ where: { messageId: id }, orderBy: { createdAt: 'asc' }, take: 200 })
  return { ticket: toRow({ ...m, isRead: true } as unknown as RawTicket, new Date()), replies }
}

/* ---------------------------------------------------------------- writing */

/**
 * Called by the public contact form after it stored a ContactMessage: links it to the contact spine,
 * reopens a recently resolved ticket from the same person, logs the event and rings the bell.
 */
export async function registerIncomingMessage(messageId: string): Promise<void> {
  const m = await db.contactMessage.findUnique({ where: { id: messageId } })
  if (!m) return
  const phone = normalizeContactPhone(m.phone)
  const contact = await resolveContact({ phone: m.phone, email: m.email, name: m.name })
  const customer = phone ? await db.customer.findUnique({ where: { phone }, select: { id: true, mergedIntoId: true } }) : null
  const customerId = customer?.mergedIntoId ?? customer?.id ?? null
  await db.contactMessage.update({ where: { id: m.id }, data: { contactId: contact?.id ?? null, customerId, normalizedPhone: phone } })
  if (phone) {
    await db.contactMessage.updateMany({
      where: { normalizedPhone: phone, status: 'RESOLVED', id: { not: m.id }, resolvedAt: { gte: new Date(Date.now() - 7 * DAY_MS) } },
      data: { status: 'OPEN', resolvedAt: null },
    })
  }
  await recordActivity({ type: 'CONTACT_MESSAGE_RECEIVED', summary: m.subject?.slice(0, 120) || 'پیام جدید از فرم تماس', contactId: contact?.id ?? null, customerId, refType: 'message', refId: m.id, occurredAt: m.createdAt })
  await notifyStaff({ kind: 'NEW_TICKET', title: 'پیام جدید', body: `${m.name}: ${(m.subject || m.message).slice(0, 80)}`, href: '/admin/messages', dedupeKey: `ticket:${m.id}` })
}

export async function setTicketStatus(id: string, to: TicketStatus, actorUserId: string): Promise<void> {
  const m = await db.contactMessage.findUnique({ where: { id }, select: { id: true, status: true, contactId: true, customerId: true } })
  if (!m) throw new CrmError('NOT_FOUND', MSG.notFound)
  if (m.status === to) return
  if (!TICKET_TRANSITIONS[m.status].includes(to)) throw new CrmError('BAD_TRANSITION', 'این تغییر وضعیت مجاز نیست.')
  const now = new Date()
  const finished = to === 'RESOLVED' || to === 'CLOSED'
  const res = await db.contactMessage.updateMany({
    where: { id, status: m.status },
    data: { status: to, isRead: true, resolvedAt: finished ? now : to === 'OPEN' ? null : undefined },
  })
  if (res.count !== 1) throw new CrmError('STALE', MSG.stale)
  await recordActivity({
    type: 'TICKET_STATUS_CHANGED',
    summary: `${TICKET_STATUS_LABEL_FA[m.status]} ← ${TICKET_STATUS_LABEL_FA[to]}`,
    contactId: m.contactId,
    customerId: m.customerId,
    actorUserId,
    refType: 'ticket-status',
    refId: `${id}:${now.getTime()}:${to}`,
    meta: { from: m.status, to },
    occurredAt: now,
  })
}

export async function assignTicket(id: string, assigneeId: string | null): Promise<void> {
  if (assigneeId) {
    const u = await db.user.findFirst({ where: { id: assigneeId, deletedAt: null }, select: { id: true } })
    if (!u) throw new CrmError('BAD_OWNER', 'کاربر انتخاب‌شده پیدا نشد.')
  }
  const res = await db.contactMessage.updateMany({ where: { id }, data: { assigneeId } })
  if (res.count !== 1) throw new CrmError('NOT_FOUND', MSG.notFound)
}

export async function setTicketPriority(id: string, priority: TicketPriority): Promise<void> {
  if (!TICKET_PRIORITIES.includes(priority)) throw new CrmError('BAD_INPUT', MSG.badInput)
  const res = await db.contactMessage.updateMany({ where: { id }, data: { priority } })
  if (res.count !== 1) throw new CrmError('NOT_FOUND', MSG.notFound)
}

export async function replyToTicket(id: string, a: { body: string; internal: boolean; sendSms: boolean; actorUserId: string }): Promise<void> {
  const body = a.body.trim()
  if (!body) throw new CrmError('EMPTY', 'متن پاسخ را بنویسید.')
  if (body.length > 640) throw new CrmError('TOO_LONG', 'متن پاسخ نباید از ۶۴۰ نویسه بیشتر باشد.')
  const m = await db.contactMessage.findUnique({ where: { id } })
  if (!m) throw new CrmError('NOT_FOUND', MSG.notFound)
  if (m.status === 'CLOSED') throw new CrmError('CLOSED', 'این پیام بسته شده است؛ ابتدا آن را دوباره باز کنید.')
  const replyId = newId()
  let outboxId: string | null = null
  let channel: string | null = null
  if (a.sendSms && !a.internal) {
    const phone = m.normalizedPhone ?? normalizeContactPhone(m.phone)
    if (!phone) throw new CrmError('NO_MOBILE', 'شمارهٔ موبایل معتبری برای ارسال پیامک وجود ندارد.')
    const stop = await db.marketingContact.findUnique({ where: { phone }, select: { unsubscribedAt: true } })
    if (stop?.unsubscribedAt) throw new CrmError('STOPPED', 'این شماره دریافت پیامک را لغو کرده است؛ پاسخ را به‌صورت یادداشت یا تماس تلفنی انجام دهید.')
    const { enqueueMessage } = await import('@/lib/club/messaging/outbox')
    const r = await enqueueMessage({ phone, customerId: m.customerId, body, kind: 'system', dedupeKey: `ticket-reply:${replyId}` })
    if (!r.ok) throw new CrmError('SMS_REFUSED', 'پیامک در صف ارسال قرار نگرفت. دوباره تلاش کنید.')
    outboxId = r.id
    channel = 'SMS'
  }
  const now = new Date()
  await db.ticketReply.create({ data: { id: replyId, messageId: id, authorUserId: a.actorUserId, internal: a.internal, channel, body, outboxId, createdAt: now } })
  if (!a.internal) {
    // First public answer stops the SLA clock; an OPEN ticket now waits on the customer.
    await db.contactMessage.updateMany({ where: { id, firstResponseAt: null }, data: { firstResponseAt: now } })
    await db.contactMessage.updateMany({ where: { id, status: 'OPEN' }, data: { status: 'PENDING' } })
  }
  await db.contactMessage.updateMany({ where: { id, isRead: false }, data: { isRead: true } })
  await recordActivity({
    type: 'TICKET_REPLIED',
    summary: a.internal ? 'یادداشت داخلی روی پیام' : channel === 'SMS' ? 'پاسخ با پیامک ارسال شد' : 'پاسخ ثبت شد',
    contactId: m.contactId,
    customerId: m.customerId,
    actorUserId: a.actorUserId,
    refType: 'ticket-reply',
    refId: replyId,
    meta: { messageId: id, internal: a.internal, channel },
    occurredAt: now,
  })
}
