import type { LeadStage, LostReason, Prisma, Role } from '@prisma/client'
import { db } from '@/lib/db'
import { CrmError, MSG } from '@/lib/crm/errors'
import { recordActivity } from '@/lib/crm/activity'
import { roleAtLeast } from '@/lib/crm/roles'
import { cleanQuery, pageArgs, type Paged } from '@/lib/crm/types'
import { normalizeContactPhone } from '@/lib/crm/contacts'
import { phoneVariants, promoteLeadsForCustomer } from '@/lib/crm/promote'

export const LEAD_STAGES: readonly LeadStage[] = ['NEW', 'CONTACTED', 'QUALIFIED', 'APPOINTMENT_BOOKED', 'WON', 'LOST']
export const LOST_REASONS: readonly LostReason[] = ['NO_RESPONSE', 'PRICE', 'NOT_INTERESTED', 'WENT_ELSEWHERE', 'DUPLICATE', 'OTHER']

/** CRM-SPEC section 3. WON is terminal; only an ADMIN may reopen it, and only to QUALIFIED. */
export const LEAD_TRANSITIONS: Record<LeadStage, LeadStage[]> = {
  NEW: ['CONTACTED', 'QUALIFIED', 'LOST'],
  CONTACTED: ['QUALIFIED', 'APPOINTMENT_BOOKED', 'LOST', 'NEW'],
  QUALIFIED: ['APPOINTMENT_BOOKED', 'WON', 'LOST', 'CONTACTED'],
  APPOINTMENT_BOOKED: ['WON', 'LOST', 'QUALIFIED'],
  WON: [],
  LOST: ['NEW'],
}

export function canTransition(from: LeadStage, to: LeadStage): boolean {
  return LEAD_TRANSITIONS[from]?.includes(to) ?? false
}

/** The old free-text `Lead.status` column is kept in sync for anything still reading it. */
export function legacyStatusForStage(s: LeadStage): string {
  switch (s) {
    case 'APPOINTMENT_BOOKED':
      return 'BOOKED'
    case 'WON':
      return 'CONVERTED'
    default:
      return s
  }
}

/** Maps a legacy status string to a stage (CRM-SPEC section 3). Unknown values become NEW. */
export function stageForLegacyStatus(status: string | null | undefined): LeadStage {
  switch ((status ?? '').trim().toUpperCase()) {
    case 'CONTACTED':
      return 'CONTACTED'
    case 'QUALIFIED':
      return 'QUALIFIED'
    case 'BOOKED':
      return 'APPOINTMENT_BOOKED'
    case 'CONVERTED':
    case 'WON':
      return 'WON'
    case 'LOST':
    case 'CLOSED':
      return 'LOST'
    default:
      return 'NEW'
  }
}

export const STAGE_LABEL_FA: Record<LeadStage, string> = {
  NEW: 'جدید',
  CONTACTED: 'تماس گرفته شد',
  QUALIFIED: 'واجد شرایط',
  APPOINTMENT_BOOKED: 'نوبت رزرو شد',
  WON: 'موفق',
  LOST: 'از دست رفته',
}

export const LOST_REASON_LABEL_FA: Record<LostReason, string> = {
  NO_RESPONSE: 'پاسخ نداد',
  PRICE: 'قیمت',
  NOT_INTERESTED: 'علاقه‌ای نداشت',
  WENT_ELSEWHERE: 'جای دیگری رفت',
  DUPLICATE: 'تکراری',
  OTHER: 'سایر',
}

export async function changeLeadStage(
  leadId: string,
  to: LeadStage,
  opts: { lostReason?: LostReason; actorUserId: string; actorRole?: Role }
): Promise<void> {
  const lead = await db.lead.findUnique({ where: { id: leadId }, select: { id: true, stage: true, contactId: true, customerId: true, name: true } })
  if (!lead) throw new CrmError('NOT_FOUND', MSG.notFound)
  const from = lead.stage
  if (from === to) return
  const reopenWon = from === 'WON' && to === 'QUALIFIED' && roleAtLeast(opts.actorRole ?? 'VIEWER', 'ADMIN')
  if (!canTransition(from, to) && !reopenWon) {
    throw new CrmError('BAD_TRANSITION', from === 'WON' ? 'سرنخ موفق را فقط مدیر می‌تواند دوباره باز کند.' : 'این جابه‌جایی مرحله مجاز نیست.')
  }
  if (to === 'LOST' && (!opts.lostReason || !LOST_REASONS.includes(opts.lostReason))) {
    throw new CrmError('LOST_REASON_REQUIRED', 'برای از دست رفتن سرنخ، دلیل را انتخاب کنید.')
  }
  const now = new Date()
  // Compare-and-swap on the stage we validated against: two parallel moves cannot both succeed.
  const res = await db.lead.updateMany({
    where: { id: leadId, stage: from },
    data: {
      stage: to,
      status: legacyStatusForStage(to),
      stageChangedAt: now,
      lostReason: to === 'LOST' ? opts.lostReason : null,
    },
  })
  if (res.count !== 1) throw new CrmError('STALE', MSG.stale)
  if (to === 'WON' || to === 'LOST') {
    await db.crmTask.updateMany({ where: { leadId, system: true, status: { in: ['OPEN', 'IN_PROGRESS'] } }, data: { status: 'CANCELLED' } })
  }
  await recordActivity({
    type: 'LEAD_STAGE_CHANGED',
    summary: `${STAGE_LABEL_FA[from]} ← ${STAGE_LABEL_FA[to]}`,
    contactId: lead.contactId,
    customerId: lead.customerId,
    actorUserId: opts.actorUserId,
    refType: 'lead-stage',
    refId: `${leadId}:${now.getTime()}:${to}`,
    meta: { leadId, from, to, lostReason: to === 'LOST' ? opts.lostReason : null },
    occurredAt: now,
  })
}

export async function assignLead(leadId: string, ownerId: string | null, actorUserId: string): Promise<void> {
  if (ownerId) {
    const u = await db.user.findFirst({ where: { id: ownerId, deletedAt: null }, select: { id: true } })
    if (!u) throw new CrmError('BAD_OWNER', 'کاربر انتخاب‌شده پیدا نشد.')
  }
  const lead = await db.lead.findUnique({ where: { id: leadId }, select: { id: true, ownerId: true, contactId: true, customerId: true } })
  if (!lead) throw new CrmError('NOT_FOUND', MSG.notFound)
  if (lead.ownerId === ownerId) return
  await db.lead.update({ where: { id: leadId }, data: { ownerId, assignedTo: ownerId } })
  await db.crmTask.updateMany({ where: { leadId, system: true, status: { in: ['OPEN', 'IN_PROGRESS'] } }, data: { ownerId } })
  await recordActivity({
    type: 'OWNER_CHANGED',
    summary: ownerId ? 'سرنخ به مسئول جدید سپرده شد' : 'مسئول سرنخ برداشته شد',
    contactId: lead.contactId,
    customerId: lead.customerId,
    actorUserId,
    refType: 'lead-owner',
    refId: `${leadId}:${Date.now()}`,
    meta: { leadId, from: lead.ownerId, to: ownerId },
  })
}

export async function setLeadFollowUp(leadId: string, when: Date | null): Promise<void> {
  const res = await db.lead.updateMany({ where: { id: leadId }, data: { followUpDate: when } })
  if (res.count !== 1) throw new CrmError('NOT_FOUND', MSG.notFound)
}

export type LeadRow = {
  id: string
  name: string | null
  phone: string
  email: string | null
  petType: string | null
  serviceInterest: string | null
  message: string | null
  source: string | null
  utmSource: string | null
  utmCamp: string | null
  stage: LeadStage
  lostReason: LostReason | null
  ownerId: string | null
  contactId: string | null
  customerId: string | null
  followUpDate: Date | null
  stageChangedAt: Date | null
  createdAt: Date
}

export type LeadListQuery = {
  q?: string
  stage?: LeadStage
  /** A user id, or 'none' for unassigned. */
  owner?: string
  source?: string
  from?: Date
  to?: Date
  page?: number
  size?: number
  sort?: 'newest' | 'oldest' | 'followup' | 'stage'
}

export function buildLeadWhere(q: LeadListQuery): Prisma.LeadWhereInput {
  const and: Prisma.LeadWhereInput[] = []
  const term = cleanQuery(q.q)
  if (term) {
    const phone = normalizeContactPhone(term)
    and.push({
      OR: [
        { name: { contains: term, mode: 'insensitive' } },
        { email: { contains: term, mode: 'insensitive' } },
        { phone: { contains: term } },
        ...(phone ? [{ normalizedPhone: phone }, { phone: { in: phoneVariants(phone) } }] : []),
      ],
    })
  }
  if (q.stage) and.push({ stage: q.stage })
  if (q.owner === 'none') and.push({ ownerId: null })
  else if (q.owner) and.push({ ownerId: q.owner })
  if (q.source) and.push({ source: q.source })
  if (q.from || q.to) and.push({ createdAt: { ...(q.from ? { gte: q.from } : {}), ...(q.to ? { lte: q.to } : {}) } })
  return and.length ? { AND: and } : {}
}

export async function listLeads(q: LeadListQuery): Promise<Paged<LeadRow>> {
  const { page, size, skip } = pageArgs(q)
  const where = buildLeadWhere(q)
  const orderBy: Prisma.LeadOrderByWithRelationInput[] =
    q.sort === 'oldest' ? [{ createdAt: 'asc' }] : q.sort === 'followup' ? [{ followUpDate: { sort: 'asc', nulls: 'last' } }, { createdAt: 'desc' }] : q.sort === 'stage' ? [{ stage: 'asc' }, { createdAt: 'desc' }] : [{ createdAt: 'desc' }]
  const [rows, total] = await Promise.all([db.lead.findMany({ where, orderBy, skip, take: size }), db.lead.count({ where })])
  return {
    rows: rows.map((l) => ({
      id: l.id,
      name: l.name,
      phone: l.phone,
      email: l.email,
      petType: l.petType,
      serviceInterest: l.serviceInterest,
      message: l.message,
      source: l.source,
      utmSource: l.utmSource,
      utmCamp: l.utmCamp,
      stage: l.stage,
      lostReason: l.lostReason,
      ownerId: l.ownerId,
      contactId: l.contactId,
      customerId: l.customerId,
      followUpDate: l.followUpDate,
      stageChangedAt: l.stageChangedAt,
      createdAt: l.createdAt,
    })),
    total,
    page,
    size,
  }
}

/** Stage counts for the board header (one grouped query). */
export async function leadStageCounts(): Promise<Record<LeadStage, number>> {
  const rows = await db.lead.groupBy({ by: ['stage'], _count: { _all: true } })
  const out = Object.fromEntries(LEAD_STAGES.map((s) => [s, 0])) as Record<LeadStage, number>
  for (const r of rows) out[r.stage] = r._count._all
  return out
}

/**
 * Turns a lead into a customer (or links it to the customer that already has this phone) and marks it WON.
 * Returns the customer id.
 */
export async function convertLeadToCustomer(leadId: string, _actorUserId: string): Promise<{ customerId: string; created: boolean }> {
  const lead = await db.lead.findUnique({ where: { id: leadId } })
  if (!lead) throw new CrmError('NOT_FOUND', MSG.notFound)
  const phone = normalizeContactPhone(lead.normalizedPhone ?? lead.phone)
  if (!phone) throw new CrmError('NO_MOBILE', 'این سرنخ شمارهٔ موبایل معتبر ندارد؛ ابتدا شماره را اصلاح کنید.')
  let customer = await db.customer.findUnique({ where: { phone }, select: { id: true, mergedIntoId: true } })
  let created = false
  if (customer?.mergedIntoId) customer = await db.customer.findUnique({ where: { id: customer.mergedIntoId }, select: { id: true, mergedIntoId: true } })
  if (!customer) {
    const { createCustomerByAdmin } = await import('@/lib/club/customers-admin')
    const [firstName, ...rest] = (lead.name ?? '').trim().split(/\s+/)
    const r = await createCustomerByAdmin({ phone, firstName: firstName || 'مشتری', lastName: rest.join(' ') || undefined, email: lead.email, source: 'lead' })
    if (!r.ok || !r.id) throw new CrmError('CREATE_FAILED', r.error ?? MSG.generic)
    customer = { id: r.id, mergedIntoId: null }
    created = true
  }
  await db.lead.updateMany({ where: { id: leadId }, data: { customerId: customer.id } })
  await promoteLeadsForCustomer(customer.id)
  return { customerId: customer.id, created }
}
