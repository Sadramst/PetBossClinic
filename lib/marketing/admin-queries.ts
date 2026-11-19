import 'server-only'
import type { Prisma } from '@prisma/client'
import { db } from '@/lib/db'
import { normalizeMobile } from '@/lib/text/iran'
import { couponStatus, type CouponStatus } from '@/lib/marketing/admin-validators'

export const CONTACT_SOURCES = ['popup', 'footer', 'signup', 'checkout', 'admin'] as const
export const PAGE_SIZE = 25
const PAID: Prisma.OrderWhereInput = { status: { in: ['CONFIRMED', 'PROCESSING', 'SHIPPED', 'DELIVERED'] } }
const DAY = 86_400_000

/** Shared by the contacts page and the CSV export. */
export function contactsWhere(filter: { q?: string; source?: string }): Prisma.MarketingContactWhereInput {
  const where: Prisma.MarketingContactWhereInput = {}
  const q = (filter.q ?? '').trim().slice(0, 80)
  if (q) {
    const phone = normalizeMobile(q)
    const digits = q.replace(/\D/g, '')
    where.OR = [
      { email: { contains: q.toLowerCase() } },
      { name: { contains: q, mode: 'insensitive' } },
      ...(phone ? [{ phone }] : digits.length >= 3 ? [{ phone: { contains: digits } }] : []),
    ]
  }
  if (filter.source && (CONTACT_SOURCES as readonly string[]).includes(filter.source)) where.source = filter.source
  return where
}

export const COUPON_TYPES = ['PERCENT', 'FIXED', 'FREE_SHIPPING'] as const

export interface CouponRow {
  id: string
  code: string
  title: string
  description: string | null
  type: 'PERCENT' | 'FIXED' | 'FREE_SHIPPING'
  value: number
  maxDiscount: number | null
  minSubtotal: number
  startsAt: string | null
  endsAt: string | null
  isActive: boolean
  autoApply: boolean
  usageLimit: number | null
  usedCount: number
  perCustomerLimit: number | null
  firstOrderOnly: boolean
  customerId: string | null
  customerLabel: string | null
  customerPhone: string | null
  groupId: string | null
  groupName: string | null
  categoryIds: string[]
  brandIds: string[]
  productIds: string[]
  productLabels: { id: string; name: string }[]
  source: string
  batchId: string | null
  status: CouponStatus
}

async function usedUpIds(): Promise<string[]> {
  const rows = await db.$queryRaw<{ id: string }[]>`SELECT "id" FROM "Coupon" WHERE "usageLimit" IS NOT NULL AND "usedCount" >= "usageLimit" LIMIT 5000`
  return rows.map((r) => r.id)
}

export async function listCoupons(opts: { q?: string; status?: string; type?: string; page?: number; source?: string }) {
  const now = new Date()
  const and: Prisma.CouponWhereInput[] = []
  const q = (opts.q ?? '').trim().slice(0, 60)
  if (q) and.push({ OR: [{ code: { contains: q.toUpperCase() } }, { title: { contains: q, mode: 'insensitive' } }] })
  if ((COUPON_TYPES as readonly string[]).includes(opts.type ?? '')) and.push({ type: opts.type as 'PERCENT' })
  if (opts.source === 'manual' || opts.source === 'welcome' || opts.source === 'bulk') and.push({ source: opts.source })
  switch (opts.status) {
    case 'inactive':
      and.push({ isActive: false })
      break
    case 'expired':
      and.push({ isActive: true, endsAt: { lte: now } })
      break
    case 'scheduled':
      and.push({ isActive: true, startsAt: { gt: now } })
      break
    case 'used_up':
      and.push({ id: { in: await usedUpIds() } })
      break
    case 'active':
      and.push({
        isActive: true,
        AND: [{ OR: [{ endsAt: null }, { endsAt: { gt: now } }] }, { OR: [{ startsAt: null }, { startsAt: { lte: now } }] }, { id: { notIn: await usedUpIds() } }],
      })
      break
  }
  const where: Prisma.CouponWhereInput = and.length ? { AND: and } : {}
  const page = Math.max(1, Math.floor(opts.page ?? 1))
  const [total, rows] = await Promise.all([
    db.coupon.count({ where }),
    db.coupon.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: { group: { select: { name: true } }, customer: { select: { firstName: true, lastName: true, phone: true } } },
    }),
  ])
  const productIds = [...new Set(rows.flatMap((r) => r.productIds))]
  const products = productIds.length ? await db.product.findMany({ where: { id: { in: productIds } }, select: { id: true, nameFa: true } }) : []
  const pname = new Map(products.map((p) => [p.id, p.nameFa]))
  const mapped: CouponRow[] = rows.map((r) => ({
    id: r.id,
    code: r.code,
    title: r.title,
    description: r.description,
    type: r.type,
    value: r.value,
    maxDiscount: r.maxDiscount,
    minSubtotal: r.minSubtotal,
    startsAt: r.startsAt?.toISOString() ?? null,
    endsAt: r.endsAt?.toISOString() ?? null,
    isActive: r.isActive,
    autoApply: r.autoApply,
    usageLimit: r.usageLimit,
    usedCount: r.usedCount,
    perCustomerLimit: r.perCustomerLimit,
    firstOrderOnly: r.firstOrderOnly,
    customerId: r.customerId,
    customerLabel: r.customer ? [r.customer.firstName, r.customer.lastName].filter(Boolean).join(' ') || r.customer.phone : null,
    customerPhone: r.customer?.phone ?? null,
    groupId: r.groupId,
    groupName: r.group?.name ?? null,
    categoryIds: r.categoryIds,
    brandIds: r.brandIds,
    productIds: r.productIds,
    productLabels: r.productIds.map((id) => ({ id, name: pname.get(id) ?? 'محصول حذف‌شده' })),
    source: r.source,
    batchId: r.batchId,
    status: couponStatus(r, now),
  }))
  return { rows: mapped, total, page, pages: Math.max(1, Math.ceil(total / PAGE_SIZE)) }
}

export async function couponFormOptions() {
  const [categories, brands, groups, batches] = await Promise.all([
    db.productCategory.findMany({ where: { deletedAt: null }, select: { id: true, nameFa: true }, orderBy: { nameFa: 'asc' }, take: 300 }),
    db.brand.findMany({ where: { deletedAt: null }, select: { id: true, nameFa: true }, orderBy: { nameFa: 'asc' }, take: 300 }),
    db.customerGroup.findMany({ select: { id: true, name: true }, orderBy: { name: 'asc' }, take: 200 }),
    db.coupon.groupBy({
      by: ['batchId', 'title'],
      where: { batchId: { not: null } },
      _count: { _all: true },
      _sum: { usedCount: true },
      _max: { createdAt: true },
      orderBy: { _max: { createdAt: 'desc' } },
      take: 20,
    }),
  ])
  return {
    categories: categories.map((c) => ({ id: c.id, name: c.nameFa })),
    brands: brands.map((b) => ({ id: b.id, name: b.nameFa })),
    groups,
    batches: batches.map((b) => ({
      batchId: b.batchId as string,
      title: b.title,
      count: b._count._all,
      used: b._sum.usedCount ?? 0,
      createdAt: b._max.createdAt?.toISOString() ?? '',
    })),
  }
}
export type CouponFormOptions = Awaited<ReturnType<typeof couponFormOptions>>

export async function listGroups() {
  const groups = await db.customerGroup.findMany({ orderBy: { createdAt: 'desc' }, include: { _count: { select: { members: true, coupons: true } } }, take: 200 })
  return groups.map((g) => ({ id: g.id, name: g.name, description: g.description, members: g._count.members, coupons: g._count.coupons }))
}

export async function listContacts(opts: { q?: string; source?: string; page?: number }) {
  const where = contactsWhere(opts)
  const page = Math.max(1, Math.floor(opts.page ?? 1))
  const [total, rows] = await Promise.all([
    db.marketingContact.count({ where }),
    db.marketingContact.findMany({ where, orderBy: { createdAt: 'desc' }, skip: (page - 1) * PAGE_SIZE, take: PAGE_SIZE }),
  ])
  const ids = rows.map((r) => r.welcomeCouponId).filter((v): v is string => !!v)
  const coupons = ids.length ? await db.coupon.findMany({ where: { id: { in: ids } }, select: { id: true, code: true, usedCount: true, endsAt: true } }) : []
  const byId = new Map(coupons.map((c) => [c.id, c]))
  const now = new Date()
  return {
    total,
    page,
    pages: Math.max(1, Math.ceil(total / PAGE_SIZE)),
    rows: rows.map((r) => {
      const c = r.welcomeCouponId ? byId.get(r.welcomeCouponId) : undefined
      const couponState: 'none' | 'used' | 'expired' | 'unused' = !c ? 'none' : c.usedCount > 0 ? 'used' : c.endsAt && c.endsAt <= now ? 'expired' : 'unused'
      return {
        id: r.id,
        phone: r.phone,
        email: r.email,
        name: r.name,
        source: r.source,
        createdAt: r.createdAt.toISOString(),
        isCustomer: !!r.customerId,
        unsubscribed: !!r.unsubscribedAt,
        couponCode: c?.code ?? null,
        couponState,
      }
    }),
  }
}
export type ContactRow = Awaited<ReturnType<typeof listContacts>>['rows'][number]

export interface MarketingReport {
  redemptions: number
  totalDiscount: number
  discountedOrders: number
  discountedRevenue: number
  contacts7: number
  contacts30: number
  contactsTotal: number
  converted: number
  welcomeIssued: number
  welcomeUsed: number
  topCoupons: { code: string; title: string; uses: number; amount: number }[]
  activeCoupons: number
}

export async function marketingReport(now: Date = new Date()): Promise<MarketingReport> {
  const d7 = new Date(now.getTime() - 7 * DAY)
  const d30 = new Date(now.getTime() - 30 * DAY)
  const [red, orders, c7, c30, cAll, converted, welcomeIssued, welcomeUsed, top, activeCoupons] = await Promise.all([
    db.couponRedemption.aggregate({ _count: { _all: true }, _sum: { amount: true } }),
    db.order.aggregate({ where: { ...PAID, couponId: { not: null } }, _count: { _all: true }, _sum: { total: true } }),
    db.marketingContact.count({ where: { createdAt: { gte: d7 } } }),
    db.marketingContact.count({ where: { createdAt: { gte: d30 } } }),
    db.marketingContact.count(),
    // converted = leads that became a customer and placed a completed order
    db.marketingContact.count({ where: { customerId: { not: null }, customer: { orders: { some: PAID } } } }),
    db.coupon.count({ where: { source: 'welcome' } }),
    db.coupon.count({ where: { source: 'welcome', usedCount: { gt: 0 } } }),
    db.couponRedemption.groupBy({ by: ['couponId'], _count: { _all: true }, _sum: { amount: true }, orderBy: { _count: { couponId: 'desc' } }, take: 8 }),
    db.coupon.count({ where: { isActive: true, OR: [{ endsAt: null }, { endsAt: { gt: now } }] } }),
  ])
  const coupons = top.length ? await db.coupon.findMany({ where: { id: { in: top.map((t) => t.couponId) } }, select: { id: true, code: true, title: true } }) : []
  const cm = new Map(coupons.map((c) => [c.id, c]))
  return {
    redemptions: red._count._all,
    totalDiscount: red._sum.amount ?? 0,
    discountedOrders: orders._count._all,
    discountedRevenue: orders._sum.total ?? 0,
    contacts7: c7,
    contacts30: c30,
    contactsTotal: cAll,
    converted,
    welcomeIssued,
    welcomeUsed,
    topCoupons: top.map((t) => ({ code: cm.get(t.couponId)?.code ?? '—', title: cm.get(t.couponId)?.title ?? '', uses: t._count._all, amount: t._sum.amount ?? 0 })),
    activeCoupons,
  }
}
