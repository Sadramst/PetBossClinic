import { db } from '@/lib/db'
import { getLoyaltyConfig } from '@/lib/club/config'
import { spendPoints } from '@/lib/club/points'
import { tierRank } from '@/lib/club/tiers'
import { createCouponWithUniqueCode } from '@/lib/marketing/coupons'

export interface RedeemResult {
  ok: boolean
  error?: string
  couponCode?: string
  couponId?: string
  balance?: number
  expiresAt?: Date
}

class Abort extends Error {
  constructor(public readonly userMessage: string) {
    super(userMessage)
  }
}

/** Active rewards, cheapest first within the admin's order. */
export async function listRewards(opts: { includeInactive?: boolean } = {}) {
  return db.reward.findMany({ where: opts.includeInactive ? {} : { isActive: true }, orderBy: [{ sortOrder: 'asc' }, { pointsCost: 'asc' }] })
}

/**
 * Exchanges points for a personal, single-use coupon. One transaction: the stock slot, the points
 * and the coupon are all taken together or not at all, so parallel clicks can never overspend.
 */
export async function redeemReward(customerId: string, rewardId: string, now = new Date()): Promise<RedeemResult> {
  const cfg = await getLoyaltyConfig()
  if (!cfg.enabled) return { ok: false, error: 'باشگاه مشتریان فعلاً غیرفعال است.' }
  try {
    return await db.$transaction(
      async (tx) => {
        const reward = await tx.reward.findUnique({ where: { id: rewardId } })
        if (!reward || !reward.isActive) throw new Abort('این جایزه در دسترس نیست.')
        const customer = await tx.customer.findUnique({ where: { id: customerId }, select: { tier: true, isBlocked: true } })
        if (!customer || customer.isBlocked) throw new Abort('حساب کاربری شما فعال نیست.')
        if (reward.minTier && tierRank(cfg.tiers, customer.tier) < tierRank(cfg.tiers, reward.minTier)) {
          const label = cfg.tiers.find((t) => t.key === reward.minTier)?.label ?? reward.minTier
          throw new Abort(`این جایزه از سطح «${label}» به بالا قابل دریافت است.`)
        }
        // One conditional UPDATE decides who gets the last unit.
        const slot = await tx.$executeRaw`
          UPDATE "Reward" SET "redeemedCount" = "redeemedCount" + 1
          WHERE "id" = ${reward.id} AND "isActive" = true AND ("stock" IS NULL OR "redeemedCount" < "stock")`
        if (slot !== 1) throw new Abort('موجودی این جایزه تمام شده است.')

        const redemption = await tx.rewardRedemption.create({ data: { rewardId: reward.id, customerId, points: reward.pointsCost } })
        const spent = await spendPoints(tx, {
          customerId,
          points: reward.pointsCost,
          refType: 'reward',
          refId: redemption.id,
          note: `دریافت جایزه: ${reward.title}`,
        })
        if (!spent.ok) throw new Abort('امتیاز شما برای دریافت این جایزه کافی نیست.')

        const endsAt = new Date(now.getTime() + Math.max(1, reward.couponValidDays) * 86_400_000)
        const coupon = await createCouponWithUniqueCode(
          {
            title: `جایزهٔ باشگاه: ${reward.title}`,
            description: 'کد شخصی و یک‌بارمصرف از باشگاه مشتریان',
            type: reward.couponType,
            value: reward.couponValue,
            maxDiscount: reward.couponType === 'PERCENT' ? reward.couponMaxDiscount : null,
            minSubtotal: reward.couponMinSubtotal,
            endsAt,
            isActive: true,
            autoApply: false,
            usageLimit: 1,
            perCustomerLimit: 1,
            customerId,
            source: 'reward',
          },
          'PB',
          tx
        )
        await tx.rewardRedemption.update({ where: { id: redemption.id }, data: { couponId: coupon.id } })
        return { ok: true, couponCode: coupon.code, couponId: coupon.id, balance: spent.balance, expiresAt: endsAt } as RedeemResult
      },
      { timeout: 15_000 }
    )
  } catch (err) {
    if (err instanceof Abort) return { ok: false, error: err.userMessage }
    throw err
  }
}
