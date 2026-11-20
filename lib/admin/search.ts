import 'server-only'
import type { Role } from '@prisma/client'
import { db } from '@/lib/db'
import { toLatinDigits } from '@/lib/date/jalali'
import { phoneNeedle, textVariants } from '@/lib/admin/search-text'
import { roleAtLeast } from '@/components/admin/format'

export type SearchGroupKey = 'customer' | 'order' | 'product' | 'lead' | 'pet' | 'coupon'

export interface SearchHit {
  id: string
  title: string
  subtitle?: string
  href: string
}
export interface SearchGroup {
  key: SearchGroupKey
  label: string
  hits: SearchHit[]
}

export const SEARCH_GROUP_LABEL: Record<SearchGroupKey, string> = {
  customer: 'مشتری',
  order: 'سفارش',
  product: 'محصول',
  lead: 'سرنخ',
  pet: 'پت',
  coupon: 'کوپن',
}

const PER_GROUP = 5

/**
 * Fast capped search across the admin's main records. At most 5 hits per group,
 * every query is an indexed or bounded `contains` with `take`, and groups the role cannot open are skipped.
 */
export async function searchAdmin(rawQuery: string, role: Role): Promise<SearchGroup[]> {
  const q = rawQuery.trim().slice(0, 60)
  if (q.length < 2) return []
  const variants = textVariants(q)
  const phone = phoneNeedle(q)
  const isEditor = roleAtLeast(role, 'EDITOR')
  const isAdmin = roleAtLeast(role, 'ADMIN')
  const contains = (field: string) => variants.map((v) => ({ [field]: { contains: v, mode: 'insensitive' as const } }))

  const [customers, orders, products, leads, pets, coupons] = await Promise.all([
    isEditor ? db.customer.findMany({
      where: {
        OR: [...contains('firstName'), ...contains('lastName'), ...contains('email'), ...(phone ? [{ phone: { contains: phone } }] : [])],
      },
      orderBy: { createdAt: 'desc' },
      take: PER_GROUP,
      select: { id: true, firstName: true, lastName: true, phone: true },
    }) : [],
    isEditor ? db.order.findMany({
      where: { OR: [{ number: { contains: q.toUpperCase() } }, ...(phone ? [{ shipPhone: { contains: phone } }] : []), ...contains('shipName')] },
      orderBy: { createdAt: 'desc' },
      take: PER_GROUP,
      select: { id: true, number: true, shipName: true },
    }) : [],
    isEditor
      ? db.product.findMany({
          where: { deletedAt: null, OR: [...contains('nameFa'), ...contains('sku'), { barcode: { contains: q } }] },
          orderBy: { updatedAt: 'desc' },
          take: PER_GROUP,
          select: { id: true, nameFa: true, sku: true },
        })
      : [],
    db.lead.findMany({
      where: { OR: [...contains('name'), ...(phone ? [{ phone: { contains: phone } }] : [])] },
      orderBy: { createdAt: 'desc' },
      take: PER_GROUP,
      select: { id: true, name: true, phone: true },
    }),
    isEditor ? db.pet.findMany({
      where: { OR: [...contains('name'), { microchip: { contains: toLatinDigits(q) } }] },
      orderBy: { createdAt: 'desc' },
      take: PER_GROUP,
      select: { id: true, name: true, customerId: true, microchip: true },
    }) : [],
    isAdmin
      ? db.coupon.findMany({
          where: { OR: [{ code: { contains: q.toUpperCase() } }, ...contains('title')] },
          orderBy: { createdAt: 'desc' },
          take: PER_GROUP,
          select: { id: true, code: true, title: true },
        })
      : [],
  ])

  const groups: SearchGroup[] = [
    {
      key: 'customer',
      label: SEARCH_GROUP_LABEL.customer,
      hits: customers.map((c) => ({
        id: c.id,
        title: [c.firstName, c.lastName].filter(Boolean).join(' ') || c.phone,
        subtitle: c.phone,
        href: `/admin/customers/${c.id}`,
      })),
    },
    {
      key: 'order',
      label: SEARCH_GROUP_LABEL.order,
      hits: orders.map((o) => ({ id: o.id, title: o.number, subtitle: o.shipName, href: `/admin/orders?status=all&q=${encodeURIComponent(o.number)}` })),
    },
    {
      key: 'product',
      label: SEARCH_GROUP_LABEL.product,
      hits: products.map((p) => ({ id: p.id, title: p.nameFa, subtitle: p.sku ?? undefined, href: `/admin/products?q=${encodeURIComponent(p.sku || p.nameFa)}` })),
    },
    {
      key: 'lead',
      label: SEARCH_GROUP_LABEL.lead,
      hits: leads.map((l) => ({ id: l.id, title: l.name || l.phone, subtitle: l.phone, href: `/admin/leads?q=${encodeURIComponent(l.phone)}` })),
    },
    {
      key: 'pet',
      label: SEARCH_GROUP_LABEL.pet,
      hits: pets.map((p) => ({ id: p.id, title: p.name, subtitle: p.microchip ?? undefined, href: `/admin/customers/${p.customerId}` })),
    },
    {
      key: 'coupon',
      label: SEARCH_GROUP_LABEL.coupon,
      hits: coupons.map((c) => ({ id: c.id, title: c.code, subtitle: c.title, href: `/admin/marketing?q=${encodeURIComponent(c.code)}` })),
    },
  ]
  return groups.filter((g) => g.hits.length > 0)
}
