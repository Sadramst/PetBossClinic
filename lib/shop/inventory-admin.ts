import 'server-only'
import type { Prisma } from '@prisma/client'
import { db } from '@/lib/db'
import { getExpiryConfig } from '@/lib/shop/expiry-config'
import { daysUntil, expiryState, type ExpiryState } from '@/lib/shop/expiry'

export type BatchRow = {
  id: string
  productId: string
  productName: string
  productSku: string | null
  productSlug: string
  tracksExpiry: boolean
  quantity: number
  batchNumber: string | null
  location: string | null
  expiryDate: string | null
  manufactureDate: string | null
  receivedAt: string
  costPrice: number | null
  state: ExpiryState
  daysLeft: number | null
  valueAtRisk: number | null
}

export type Paged<T> = { rows: T[]; total: number; page: number; size: number }

export type BatchQuery = { state?: ExpiryState; productId?: string; q?: string; location?: string; page?: number; size?: number }

const DAY = 86_400_000

type Thresholds = { soonDays: number; criticalDays: number }

/** Prisma filter for one state. Day boundaries match `expiryState` (floor of whole days). */
export function stateWhere(state: ExpiryState, cfg: Thresholds, now = new Date()): Prisma.InventoryWhereInput {
  const t = now.getTime()
  const edge = (days: number) => new Date(t + (days + 1) * DAY)
  switch (state) {
    case 'expired':
      return { expiryDate: { lt: now } }
    case 'critical':
      return { expiryDate: { gte: now, lt: edge(cfg.criticalDays) } }
    case 'soon':
      return { expiryDate: { gte: edge(cfg.criticalDays), lt: edge(cfg.soonDays) } }
    case 'ok':
      return { expiryDate: { gte: edge(cfg.soonDays) } }
    case 'none':
      return { expiryDate: null, product: { tracksExpiry: true } }
    default:
      return {}
  }
}

const productSelect = { select: { id: true, nameFa: true, sku: true, slugFa: true, tracksExpiry: true } } as const
type BatchWithProduct = Prisma.InventoryGetPayload<{ include: { product: typeof productSelect } }>

export function toBatchRow(b: BatchWithProduct, cfg: Thresholds, now = new Date()): BatchRow {
  const state = expiryState(b.expiryDate, cfg, now)
  const risky = state === 'expired' || state === 'critical'
  return {
    id: b.id,
    productId: b.product.id,
    productName: b.product.nameFa,
    productSku: b.product.sku,
    productSlug: b.product.slugFa,
    tracksExpiry: b.product.tracksExpiry,
    quantity: b.quantity,
    batchNumber: b.batchNumber,
    location: b.location,
    expiryDate: b.expiryDate?.toISOString() ?? null,
    manufactureDate: b.manufactureDate?.toISOString() ?? null,
    receivedAt: b.receivedAt.toISOString(),
    costPrice: b.costPrice,
    state,
    daysLeft: b.expiryDate ? daysUntil(b.expiryDate, now) : null,
    valueAtRisk: risky && b.costPrice != null ? b.costPrice * b.quantity : null,
  }
}

/** Batches with stock, most urgent first, filtered and paged on the server. */
export async function listBatches(q: BatchQuery = {}): Promise<Paged<BatchRow>> {
  const cfg = await getExpiryConfig()
  const now = new Date()
  const size = Math.min(100, Math.max(1, q.size ?? 25))
  const page = Math.max(1, q.page ?? 1)
  const and: Prisma.InventoryWhereInput[] = [{ quantity: { gt: 0 }, product: { deletedAt: null } }]
  if (q.state === 'none') and.push({ expiryDate: null, product: { tracksExpiry: true } })
  else if (q.state) and.push(stateWhere(q.state, cfg, now))
  if (q.productId) and.push({ productId: q.productId })
  if (q.location) and.push({ location: { contains: q.location, mode: 'insensitive' } })
  const text = q.q?.trim()
  if (text) {
    and.push({
      OR: [
        { batchNumber: { contains: text, mode: 'insensitive' } },
        { product: { nameFa: { contains: text, mode: 'insensitive' } } },
        { product: { sku: { contains: text, mode: 'insensitive' } } },
        { product: { barcode: { contains: text } } },
      ],
    })
  }
  const where: Prisma.InventoryWhereInput = { AND: and }
  const [total, rows] = await Promise.all([
    db.inventory.count({ where }),
    db.inventory.findMany({
      where,
      orderBy: [{ expiryDate: { sort: 'asc', nulls: 'last' } }, { createdAt: 'desc' }],
      include: { product: productSelect },
      skip: (page - 1) * size,
      take: size,
    }),
  ])
  return { rows: rows.map((r) => toBatchRow(r, cfg, now)), total, page, size }
}

/** Nearest sellable expiry per product with one grouped query (never per row). */
export async function nearestExpiryByProduct(productIds: string[]): Promise<Record<string, { date: Date | null; state: ExpiryState }>> {
  const out: Record<string, { date: Date | null; state: ExpiryState }> = {}
  if (productIds.length === 0) return out
  const cfg = await getExpiryConfig()
  const now = new Date()
  const cutoff = new Date(now.getTime() + cfg.minShelfLifeDays * DAY)
  const groups = await db.inventory.groupBy({
    by: ['productId'],
    where: { productId: { in: productIds }, quantity: { gt: 0 }, expiryDate: { gte: cutoff } },
    _min: { expiryDate: true },
  })
  for (const g of groups) out[g.productId] = { date: g._min.expiryDate, state: expiryState(g._min.expiryDate, cfg, now) }
  for (const id of productIds) if (!out[id]) out[id] = { date: null, state: 'none' }
  return out
}

export type ExpirySummary = { expired: number; critical: number; soon: number; undated: number; valueAtRisk: number }

export async function expirySummary(): Promise<ExpirySummary> {
  const cfg = await getExpiryConfig()
  const now = new Date()
  const base = { quantity: { gt: 0 }, product: { deletedAt: null } } as const
  const [expired, critical, soon, undated, risk] = await Promise.all([
    db.inventory.count({ where: { AND: [base, stateWhere('expired', cfg, now)] } }),
    db.inventory.count({ where: { AND: [base, stateWhere('critical', cfg, now)] } }),
    db.inventory.count({ where: { AND: [base, stateWhere('soon', cfg, now)] } }),
    db.inventory.count({ where: { AND: [base, { expiryDate: null, product: { tracksExpiry: true } }] } }),
    db.inventory.findMany({
      where: { AND: [base, { costPrice: { not: null }, expiryDate: { lt: new Date(now.getTime() + (cfg.criticalDays + 1) * DAY) } }] },
      select: { quantity: true, costPrice: true },
    }),
  ])
  const valueAtRisk = risk.reduce((s, r) => s + r.quantity * (r.costPrice ?? 0), 0)
  return { expired, critical, soon, undated, valueAtRisk }
}
