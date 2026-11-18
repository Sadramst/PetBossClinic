import { db } from '@/lib/db'

const DAY = 86_400_000

export interface ClubReport {
  members: number
  activeThisMonth: number
  pointsOutstanding: number
  liabilityToman: number
  issued30: number
  redeemed30: number
  issuedAll: number
  redeemedAll: number
  byTier: Record<string, number>
  topEarners: { id: string; name: string; phone: string; lifetimePoints: number; pointsBalance: number; tier: string }[]
  topRewards: { title: string; count: number }[]
}

/** Numbers for the club report and the dashboard cards. */
export async function getClubReport(pointValueToman: number, now = new Date()): Promise<ClubReport> {
  const since = new Date(now.getTime() - 30 * DAY)
  const [members, active, balance, issued30, redeemed30, issuedAll, redeemedAll, tiers, top, rewards] = await Promise.all([
    db.customer.count({ where: { isBlocked: false } }),
    db.customer.count({ where: { OR: [{ lastOrderAt: { gte: since } }, { pointsTransactions: { some: { createdAt: { gte: since }, kind: { in: ['ORDER', 'SERVICE'] } } } }] } }),
    db.customer.aggregate({ _sum: { pointsBalance: true } }),
    db.pointsTransaction.aggregate({ where: { points: { gt: 0 }, createdAt: { gte: since } }, _sum: { points: true } }),
    db.pointsTransaction.aggregate({ where: { kind: 'REDEEM', createdAt: { gte: since } }, _sum: { points: true } }),
    db.pointsTransaction.aggregate({ where: { points: { gt: 0 } }, _sum: { points: true } }),
    db.pointsTransaction.aggregate({ where: { kind: 'REDEEM' }, _sum: { points: true } }),
    db.customer.groupBy({ by: ['tier'], _count: { _all: true } }),
    db.customer.findMany({ orderBy: { lifetimePoints: 'desc' }, where: { lifetimePoints: { gt: 0 } }, take: 10, select: { id: true, firstName: true, lastName: true, phone: true, lifetimePoints: true, pointsBalance: true, tier: true } }),
    db.rewardRedemption.groupBy({ by: ['rewardId'], _count: { _all: true }, orderBy: { _count: { rewardId: 'desc' } }, take: 5 }),
  ])
  const titles = rewards.length ? await db.reward.findMany({ where: { id: { in: rewards.map((r) => r.rewardId) } }, select: { id: true, title: true } }) : []
  const pointsOutstanding = balance._sum.pointsBalance ?? 0
  return {
    members,
    activeThisMonth: active,
    pointsOutstanding,
    liabilityToman: pointsOutstanding * pointValueToman,
    issued30: issued30._sum.points ?? 0,
    redeemed30: Math.abs(redeemed30._sum.points ?? 0),
    issuedAll: issuedAll._sum.points ?? 0,
    redeemedAll: Math.abs(redeemedAll._sum.points ?? 0),
    byTier: Object.fromEntries(tiers.map((t) => [t.tier, t._count._all])),
    topEarners: top.map((c) => ({ id: c.id, name: [c.firstName, c.lastName].filter(Boolean).join(' ') || 'بدون نام', phone: c.phone, lifetimePoints: c.lifetimePoints, pointsBalance: c.pointsBalance, tier: c.tier })),
    topRewards: rewards.map((r) => ({ title: titles.find((t) => t.id === r.rewardId)?.title ?? '—', count: r._count._all })),
  }
}
