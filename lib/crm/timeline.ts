import { db } from '@/lib/db'
import { ACTIVITY_LABELS_FA, isActivityType, type ActivityType } from '@/lib/crm/activity'

export type TimelineItem = {
  /** Stable key: `${type}|${refId}`. */
  key: string
  type: ActivityType | string
  label: string
  summary: string
  occurredAt: Date
  refType: string
  refId: string
  actorUserId: string | null
  href?: string
  meta?: Record<string, unknown> | null
  source: 'live' | 'activity'
}

/**
 * Merges timeline rows from several sources: newest first, ties broken by key, and one entry per
 * (type, refId) with a "live" row (read straight from its table) winning over the logged copy.
 * Pure, so the ordering rules are unit-tested.
 */
export function mergeTimeline(lists: TimelineItem[][], take: number): TimelineItem[] {
  const byKey = new Map<string, TimelineItem>()
  for (const item of lists.flat()) {
    const cur = byKey.get(item.key)
    if (!cur || (cur.source === 'activity' && item.source === 'live')) byKey.set(item.key, item)
  }
  return [...byKey.values()]
    .sort((a, b) => b.occurredAt.getTime() - a.occurredAt.getTime() || (a.key < b.key ? 1 : -1))
    .slice(0, take)
}

const item = (type: ActivityType, refType: string, refId: string, summary: string, occurredAt: Date, extra: Partial<TimelineItem> = {}): TimelineItem => ({
  key: `${type}|${refId}`,
  type,
  label: ACTIVITY_LABELS_FA[type],
  summary,
  occurredAt,
  refType,
  refId,
  actorUserId: null,
  source: 'live',
  ...extra,
})

const POINTS_TYPE: Record<string, ActivityType> = { ADJUST: 'POINTS_ADJUSTED', EXPIRE: 'POINTS_ADJUSTED', REVERSAL: 'POINTS_ADJUSTED', REDEEM: 'REWARD_REDEEMED' }

/**
 * One customer's whole story: orders, clinic visits, health records, notes, points, support messages,
 * replies, tasks and everything logged in CrmActivity, merged and paginated by time.
 * `before` is the cursor (the occurredAt of the last item already shown).
 */
export async function getCustomerTimeline(
  customerId: string,
  opts: { before?: Date; take?: number; types?: ActivityType[] } = {}
): Promise<{ items: TimelineItem[]; nextCursor: string | null }> {
  const take = Math.min(100, Math.max(1, Math.floor(opts.take ?? 30)))
  const lim = take + 1
  const before = opts.before
  const customer = await db.customer.findUnique({ where: { id: customerId }, select: { id: true, phone: true, contactId: true } })
  if (!customer) return { items: [], nextCursor: null }
  const lt = (field: string) => (before ? { [field]: { lt: before } } : {})
  const want = (t: ActivityType) => !opts.types?.length || opts.types.includes(t)

  const msgWhere = { OR: [{ customerId }, { normalizedPhone: customer.phone }], ...lt('createdAt') }
  const [orders, visits, notes, points, messages, tasks, records, logged] = await Promise.all([
    want('ORDER_PLACED') || want('ORDER_PAID') || want('ORDER_CANCELLED')
      ? db.order.findMany({ where: { customerId, ...lt('createdAt') }, orderBy: { createdAt: 'desc' }, take: lim, select: { id: true, number: true, status: true, total: true, createdAt: true, paidAt: true, updatedAt: true } })
      : [],
    want('VISIT_LOGGED') ? db.serviceVisit.findMany({ where: { customerId, ...lt('visitedAt') }, orderBy: { visitedAt: 'desc' }, take: lim, select: { id: true, serviceName: true, visitedAt: true } }) : [],
    want('NOTE_ADDED') ? db.adminCustomerNote.findMany({ where: { customerId, ...lt('createdAt') }, orderBy: { createdAt: 'desc' }, take: lim, select: { id: true, body: true, createdAt: true, adminId: true } }) : [],
    want('POINTS_AWARDED') || want('POINTS_ADJUSTED') || want('REWARD_REDEEMED')
      ? db.pointsTransaction.findMany({ where: { customerId, ...lt('createdAt') }, orderBy: { createdAt: 'desc' }, take: lim, select: { id: true, kind: true, points: true, note: true, createdAt: true } })
      : [],
    want('CONTACT_MESSAGE_RECEIVED') ? db.contactMessage.findMany({ where: msgWhere, orderBy: { createdAt: 'desc' }, take: lim, select: { id: true, subject: true, message: true, createdAt: true } }) : [],
    want('TASK_CREATED') || want('TASK_COMPLETED')
      ? db.crmTask.findMany({ where: { customerId, ...lt('createdAt') }, orderBy: { createdAt: 'desc' }, take: lim, select: { id: true, title: true, status: true, createdAt: true, completedAt: true } })
      : [],
    want('PET_RECORD_ADDED') ? db.petRecord.findMany({ where: { pet: { customerId }, ...lt('createdAt') }, orderBy: { createdAt: 'desc' }, take: lim, select: { id: true, title: true, kind: true, createdAt: true, pet: { select: { name: true } } } }) : [],
    db.crmActivity.findMany({
      where: { OR: [{ customerId }, ...(customer.contactId ? [{ contactId: customer.contactId }] : [])], ...(opts.types?.length ? { type: { in: opts.types } } : {}), ...lt('occurredAt') },
      orderBy: [{ occurredAt: 'desc' }, { id: 'desc' }],
      take: lim,
    }),
  ])

  const lists: TimelineItem[][] = [
    orders.flatMap((o) => [
      ...(want('ORDER_PLACED') ? [item('ORDER_PLACED', 'order', o.id, `سفارش ${o.number} (${o.total.toLocaleString('en-US')} تومان)`, o.createdAt, { href: `/admin/orders/${o.id}` })] : []),
      ...(o.paidAt && want('ORDER_PAID') && (!before || o.paidAt < before) ? [item('ORDER_PAID', 'order', o.id, `پرداخت سفارش ${o.number}`, o.paidAt, { href: `/admin/orders/${o.id}` })] : []),
      ...(o.status === 'CANCELLED' && want('ORDER_CANCELLED') && (!before || o.updatedAt < before) ? [item('ORDER_CANCELLED', 'order', o.id, `لغو سفارش ${o.number}`, o.updatedAt, { href: `/admin/orders/${o.id}` })] : []),
    ]),
    visits.map((v) => item('VISIT_LOGGED', 'visit', v.id, v.serviceName, v.visitedAt)),
    notes.map((n) => item('NOTE_ADDED', 'note', n.id, n.body.slice(0, 160), n.createdAt, { actorUserId: n.adminId })),
    points.map((p) => item(p.kind in POINTS_TYPE ? POINTS_TYPE[p.kind] : p.points < 0 ? 'POINTS_ADJUSTED' : 'POINTS_AWARDED', 'points', p.id, `${p.points > 0 ? '+' : ''}${p.points} امتیاز${p.note ? ` — ${p.note}` : ''}`, p.createdAt)),
    messages.map((m) => item('CONTACT_MESSAGE_RECEIVED', 'message', m.id, (m.subject || m.message).slice(0, 120), m.createdAt, { href: '/admin/messages' })),
    tasks.flatMap((t) => [
      ...(want('TASK_CREATED') ? [item('TASK_CREATED', 'task', t.id, t.title, t.createdAt)] : []),
      ...(t.completedAt && want('TASK_COMPLETED') && (!before || t.completedAt < before) ? [item('TASK_COMPLETED', 'task', t.id, t.title, t.completedAt)] : []),
    ]),
    records.map((r) => item('PET_RECORD_ADDED', 'pet-record', r.id, `${r.pet.name}: ${r.title}`, r.createdAt)),
    logged.map((a) => ({
      key: `${a.type}|${a.refId}`,
      type: a.type,
      label: isActivityType(a.type) ? ACTIVITY_LABELS_FA[a.type] : a.type,
      summary: a.summary,
      occurredAt: a.occurredAt,
      refType: a.refType,
      refId: a.refId,
      actorUserId: a.actorUserId,
      meta: a.meta as Record<string, unknown> | null,
      source: 'activity' as const,
    })),
  ]
  const typeOk = (i: TimelineItem) => !opts.types?.length || opts.types.includes(i.type as ActivityType)
  const merged = mergeTimeline(
    lists.map((l) => l.filter(typeOk)),
    lim
  )
  const more = merged.length > take
  const page = more ? merged.slice(0, take) : merged
  return { items: page, nextCursor: more ? page[page.length - 1].occurredAt.toISOString() : null }
}
