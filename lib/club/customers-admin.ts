import { z } from 'zod'
import { Prisma } from '@prisma/client'
import { db } from '@/lib/db'
import { dateField, firstError, text } from '@/lib/club/input'
import { normalizeMobile } from '@/lib/text/iran'
import { normalizeEmail } from '@/lib/customer/email'
import { onCustomerCreated } from '@/lib/club/hooks'

/** Data layer for the admin CRM. Authorization and audit logging belong to the calling server action. */

const tagList = z
  .union([z.array(z.string()), z.string(), z.null(), z.undefined()])
  .transform((v) => {
    const arr = Array.isArray(v) ? v : typeof v === 'string' ? v.split(/[,،\n]/) : []
    return [...new Set(arr.map((t) => t.trim().slice(0, 30)).filter(Boolean))].slice(0, 20)
  })

export const adminCustomerSchema = z.object({
  firstName: text(60).pipe(z.string({ message: 'نام را وارد کنید.' }).min(2, 'نام را کامل وارد کنید.')),
  lastName: text(60).optional(),
  phone: z.string().transform((v, ctx) => {
    const p = normalizeMobile(v)
    if (!p) {
      ctx.addIssue({ code: 'custom', message: 'شماره موبایل معتبر نیست. نمونه: ۰۹۱۲۱۲۳۴۵۶۷' })
      return z.NEVER
    }
    return p
  }),
  email: z
    .union([z.string(), z.null(), z.undefined()])
    .transform((v, ctx) => {
      if (!v || !v.trim()) return null
      const e = normalizeEmail(v)
      if (!e) {
        ctx.addIssue({ code: 'custom', message: 'ایمیل معتبر نیست.' })
        return z.NEVER
      }
      return e
    }),
  birthDate: dateField({ maxYearsAgo: 110 }).optional(),
  gender: z.enum(['MALE', 'FEMALE', 'OTHER']).nullable().optional(),
  city: text(40).optional(),
  tags: tagList.optional(),
  notes: text(2000).optional(),
  source: text(40).optional(),
  /** Only true when the person agreed to receive marketing SMS (e.g. at the clinic desk). */
  marketingSmsConsent: z.boolean().optional(),
})
export type AdminCustomerInput = z.input<typeof adminCustomerSchema>

export interface AdminCustomerResult {
  ok: boolean
  error?: string
  id?: string
}

export async function createCustomerByAdmin(raw: AdminCustomerInput): Promise<AdminCustomerResult> {
  const parsed = adminCustomerSchema.safeParse(raw)
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) }
  const d = parsed.data
  const clash = await db.customer.findFirst({ where: { OR: [{ phone: d.phone }, ...(d.email ? [{ email: d.email }] : [])] }, select: { phone: true } })
  if (clash) return { ok: false, error: clash.phone === d.phone ? 'مشتری‌ای با این شماره موبایل قبلاً ثبت شده است.' : 'مشتری‌ای با این ایمیل قبلاً ثبت شده است.' }
  const consent = d.marketingSmsConsent === true
  try {
    const c = await db.customer.create({
      data: {
        phone: d.phone,
        firstName: d.firstName,
        lastName: d.lastName ?? null,
        email: d.email,
        birthDate: d.birthDate ?? null,
        gender: d.gender ?? null,
        city: d.city ?? null,
        tags: d.tags ?? [],
        notes: d.notes ?? null,
        source: d.source ?? 'admin',
        createdByAdmin: true,
        marketingSmsConsent: consent,
        marketingConsentAt: consent ? new Date() : null,
      },
    })
    await onCustomerCreated(c.id, { createdByAdmin: true })
    return { ok: true, id: c.id }
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') return { ok: false, error: 'مشتری‌ای با این شماره یا ایمیل قبلاً ثبت شده است.' }
    throw err
  }
}

export async function updateCustomerByAdmin(customerId: string, raw: AdminCustomerInput): Promise<AdminCustomerResult> {
  const parsed = adminCustomerSchema.safeParse(raw)
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) }
  const d = parsed.data
  const current = await db.customer.findUnique({ where: { id: customerId }, select: { id: true, phone: true, marketingSmsConsent: true } })
  if (!current) return { ok: false, error: 'مشتری پیدا نشد.' }
  const clash = await db.customer.findFirst({ where: { id: { not: customerId }, OR: [{ phone: d.phone }, ...(d.email ? [{ email: d.email }] : [])] }, select: { phone: true } })
  if (clash) return { ok: false, error: clash.phone === d.phone ? 'شمارهٔ دیگری با این موبایل ثبت شده است.' : 'ایمیل برای مشتری دیگری ثبت شده است.' }
  const consentChanged = d.marketingSmsConsent !== undefined && d.marketingSmsConsent !== current.marketingSmsConsent
  await db.customer.update({
    where: { id: customerId },
    data: {
      phone: d.phone,
      firstName: d.firstName,
      lastName: d.lastName ?? null,
      email: d.email,
      birthDate: d.birthDate ?? null,
      gender: d.gender ?? null,
      city: d.city ?? null,
      tags: d.tags ?? [],
      notes: d.notes ?? null,
      ...(d.source !== undefined ? { source: d.source } : {}),
      // Changing the number of an account invalidates its sessions; consent changes are timestamped.
      ...(d.phone !== current.phone ? { sessionVersion: { increment: 1 }, phoneVerifiedAt: null } : {}),
      ...(consentChanged ? { marketingSmsConsent: d.marketingSmsConsent, marketingConsentAt: new Date() } : {}),
    },
  })
  return { ok: true, id: customerId }
}

export async function addCustomerNote(customerId: string, adminId: string | null, adminName: string | null, body: string): Promise<AdminCustomerResult> {
  const clean = body.trim().slice(0, 2000)
  if (!clean) return { ok: false, error: 'متن یادداشت را وارد کنید.' }
  const exists = await db.customer.findUnique({ where: { id: customerId }, select: { id: true } })
  if (!exists) return { ok: false, error: 'مشتری پیدا نشد.' }
  const n = await db.adminCustomerNote.create({ data: { customerId, adminId, adminName: adminName?.slice(0, 80) ?? null, body: clean } })
  return { ok: true, id: n.id }
}

// ─── Listing ─────────────────────────────────────────────────────────────────

export type CustomerSort = 'joined' | 'points' | 'spend' | 'lastOrder' | 'orders'

export interface CustomerFilters {
  q?: string
  tier?: string
  species?: string
  tag?: string
  city?: string
  hasOrders?: boolean
  consent?: boolean
  sort?: CustomerSort
  dir?: 'asc' | 'desc'
  page?: number
  pageSize?: number
}

export function buildCustomerWhere(f: CustomerFilters): Prisma.CustomerWhereInput {
  const and: Prisma.CustomerWhereInput[] = []
  const q = f.q?.trim().slice(0, 60)
  if (q) {
    const phoneNeedle = normalizeMobile(q) ?? q.replace(/\D/g, '')
    and.push({
      OR: [
        { firstName: { contains: q, mode: 'insensitive' } },
        { lastName: { contains: q, mode: 'insensitive' } },
        ...(phoneNeedle.length >= 3 ? [{ phone: { contains: phoneNeedle } }] : []),
        { email: { contains: q, mode: 'insensitive' } },
        { pets: { some: { name: { contains: q, mode: 'insensitive' } } } },
      ],
    })
  }
  if (f.tier) and.push({ tier: f.tier })
  if (f.species) and.push({ pets: { some: { species: f.species as never, isActive: true } } })
  if (f.tag) and.push({ tags: { has: f.tag } })
  if (f.city) and.push({ city: { contains: f.city.trim().slice(0, 40), mode: 'insensitive' } })
  if (f.hasOrders !== undefined) and.push(f.hasOrders ? { ordersCount: { gt: 0 } } : { ordersCount: 0 })
  if (f.consent !== undefined) and.push({ marketingSmsConsent: f.consent })
  return and.length ? { AND: and } : {}
}

const SORT_FIELD: Record<CustomerSort, keyof Prisma.CustomerOrderByWithRelationInput> = {
  joined: 'createdAt',
  points: 'pointsBalance',
  spend: 'totalSpent',
  lastOrder: 'lastOrderAt',
  orders: 'ordersCount',
}

export async function listCustomers(f: CustomerFilters = {}) {
  const pageSize = Math.min(100, Math.max(5, f.pageSize ?? 25))
  const page = Math.max(1, Math.floor(f.page ?? 1))
  const where = buildCustomerWhere(f)
  const field = SORT_FIELD[f.sort ?? 'joined'] ?? 'createdAt'
  const dir = f.dir === 'asc' ? 'asc' : 'desc'
  const primary = field === 'lastOrderAt' ? { lastOrderAt: { sort: dir, nulls: 'last' as const } } : { [field]: dir }
  const orderBy = [primary, { id: 'asc' }] as Prisma.CustomerOrderByWithRelationInput[]
  const [rows, total] = await Promise.all([
    db.customer.findMany({
      where,
      orderBy,
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: { pets: { where: { isActive: true }, select: { id: true, name: true, species: true }, take: 5 } },
    }),
    db.customer.count({ where }),
  ])
  return { rows, total, page, pageSize, pages: Math.max(1, Math.ceil(total / pageSize)) }
}

/** CSV cell safe against spreadsheet formula injection (leading = + - @ tab CR are neutralised). */
export function csvCell(value: unknown): string {
  let s = value == null ? '' : value instanceof Date ? value.toISOString().slice(0, 10) : String(value)
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

export async function customersCsv(f: CustomerFilters = {}, cap = 10_000): Promise<string> {
  const rows = await db.customer.findMany({
    where: buildCustomerWhere(f),
    orderBy: { createdAt: 'desc' },
    take: cap,
    include: { pets: { where: { isActive: true }, select: { name: true, species: true, breed: true } } },
  })
  const head = ['نام', 'نام خانوادگی', 'موبایل', 'ایمیل', 'شهر', 'سطح', 'امتیاز', 'تعداد سفارش', 'مجموع خرید', 'آخرین سفارش', 'حیوانات', 'برچسب‌ها', 'رضایت پیامک', 'تاریخ عضویت']
  const lines = [head.map(csvCell).join(',')]
  for (const c of rows) {
    lines.push(
      [
        c.firstName, c.lastName, c.phone, c.email, c.city, c.tier, c.pointsBalance, c.ordersCount, c.totalSpent, c.lastOrderAt,
        c.pets.map((p) => `${p.name} (${p.species}${p.breed ? ` ${p.breed}` : ''})`).join(' | '),
        c.tags.join(' | '), c.marketingSmsConsent ? 'بله' : 'خیر', c.createdAt,
      ].map(csvCell).join(',')
    )
  }
  return '﻿' + lines.join('\r\n')
}

/** Everything the 360 page needs in one round trip. */
export async function getCustomer360(customerId: string) {
  const customer = await db.customer.findUnique({ where: { id: customerId } })
  if (!customer) return null
  const [pets, visits, orders, ledger, coupons, notes, cart, messages] = await Promise.all([
    db.pet.findMany({ where: { customerId }, orderBy: { createdAt: 'asc' }, include: { records: { orderBy: { doneAt: 'desc' }, take: 50 } } }),
    db.serviceVisit.findMany({ where: { customerId }, orderBy: { visitedAt: 'desc' }, take: 100, include: { pet: { select: { name: true } } } }),
    db.order.findMany({ where: { customerId }, orderBy: { createdAt: 'desc' }, take: 50, select: { id: true, number: true, status: true, total: true, createdAt: true } }),
    db.pointsTransaction.findMany({ where: { customerId }, orderBy: { createdAt: 'desc' }, take: 100 }),
    db.coupon.findMany({ where: { customerId }, orderBy: { createdAt: 'desc' }, take: 50 }),
    db.adminCustomerNote.findMany({ where: { customerId }, orderBy: { createdAt: 'desc' }, take: 100 }),
    db.cartSnapshot.findUnique({ where: { customerId } }),
    db.messageOutbox.findMany({ where: { customerId }, orderBy: { createdAt: 'desc' }, take: 50 }),
  ])
  return { customer, pets, visits, orders, ledger, coupons, notes, cart, messages }
}
