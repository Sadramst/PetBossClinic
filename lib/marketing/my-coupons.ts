import 'server-only'
import { db } from '@/lib/db'
import { describeOffer } from '@/lib/marketing/coupon-rules'

export type MyCouponStatus = 'available' | 'used' | 'expired' | 'upcoming' | 'inactive'

export interface MyCoupon {
  id: string
  code: string
  title: string
  description: string | null
  offer: string
  kind: 'welcome' | 'personal' | 'group'
  status: MyCouponStatus
  minSubtotal: number
  startsAt: string | null
  endsAt: string | null
  firstOrderOnly: boolean
}

/**
 * The codes that belong to this customer: personal, group and welcome codes.
 * Public codes are deliberately not listed.
 */
export async function getMyCoupons(customer: { id: string; phone: string; email: string | null }): Promise<MyCoupon[]> {
  // Phone only: an email typed at sign-up is not verified, so it never entitles anyone to a lead's coupon.
  const identity = [{ phone: customer.phone }]
  const [memberships, contacts] = await Promise.all([
    db.customerGroupMember.findMany({ where: { customerId: customer.id }, select: { groupId: true } }),
    db.marketingContact.findMany({ where: { OR: identity }, select: { welcomeCouponId: true } }),
  ])
  const welcomeIds = contacts.map((c) => c.welcomeCouponId).filter((x): x is string => !!x)
  const groupIds = memberships.map((m) => m.groupId)

  const rows = await db.coupon.findMany({
    where: {
      OR: [
        { customerId: customer.id },
        ...(groupIds.length ? [{ groupId: { in: groupIds } }] : []),
        ...(welcomeIds.length ? [{ id: { in: welcomeIds } }] : []),
      ],
    },
    orderBy: { createdAt: 'desc' },
    take: 100,
  })
  if (rows.length === 0) return []

  const mine = await db.couponRedemption.groupBy({
    by: ['couponId'],
    where: { customerId: customer.id, couponId: { in: rows.map((r) => r.id) } },
    _count: { _all: true },
  })
  const usedBy = new Map(mine.map((m) => [m.couponId, m._count._all]))
  const now = Date.now()

  const list = rows.map<MyCoupon>((c) => {
    const used = usedBy.get(c.id) ?? 0
    let status: MyCouponStatus = 'available'
    if (!c.isActive) status = 'inactive'
    else if (c.endsAt && c.endsAt.getTime() < now) status = 'expired'
    else if (c.startsAt && c.startsAt.getTime() > now) status = 'upcoming'
    else if ((c.perCustomerLimit != null && used >= c.perCustomerLimit) || (c.usageLimit != null && c.usedCount >= c.usageLimit)) status = 'used'
    const kind: MyCoupon['kind'] = c.source === 'welcome' ? 'welcome' : c.customerId === customer.id ? 'personal' : 'group'
    return {
      id: c.id,
      code: c.code,
      title: c.title,
      description: c.description,
      offer: describeOffer(c),
      kind,
      status,
      minSubtotal: c.minSubtotal,
      startsAt: c.startsAt?.toISOString() ?? null,
      endsAt: c.endsAt?.toISOString() ?? null,
      firstOrderOnly: c.firstOrderOnly,
    }
  })
  const rank: Record<MyCouponStatus, number> = { available: 0, upcoming: 1, used: 2, expired: 3, inactive: 4 }
  return list.sort((a, b) => rank[a.status] - rank[b.status])
}

/** The customer's unused, still-valid welcome code (for the account banner and popup). */
export async function getUnusedWelcomeCode(customer: { id: string; phone: string; email: string | null }): Promise<string | null> {
  const list = await getMyCoupons(customer)
  return list.find((c) => c.kind === 'welcome' && c.status === 'available')?.code ?? null
}
