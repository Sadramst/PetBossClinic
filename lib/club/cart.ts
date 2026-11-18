import { z } from 'zod'
import { db } from '@/lib/db'

export const CART_MAX_LINES = 50
const MAX_QTY = 99

export interface CartSnapshotItem {
  productId: string
  quantity: number
  name: string
  price: number
  image?: string | null
}

const itemsSchema = z
  .array(z.object({ productId: z.string().min(1).max(40), quantity: z.coerce.number().int().min(1).max(MAX_QTY) }))
  .max(500)

/**
 * Stores what the customer currently has in their cart. The client only supplies ids and quantities:
 * names and prices are read from the database, so a tampered request cannot plant fake values
 * (the admin sees them in the carts report). Unknown or inactive products are ignored.
 */
export async function syncCartSnapshot(customerId: string, rawItems: unknown): Promise<{ ok: boolean; itemCount: number; subtotal: number }> {
  const parsed = itemsSchema.safeParse(rawItems)
  if (!parsed.success) return { ok: false, itemCount: 0, subtotal: 0 }
  // Merge duplicates and cap the number of lines.
  const wanted = new Map<string, number>()
  for (const l of parsed.data) wanted.set(l.productId, Math.min(MAX_QTY, (wanted.get(l.productId) ?? 0) + l.quantity))
  const ids = [...wanted.keys()].slice(0, CART_MAX_LINES)

  if (ids.length === 0) {
    await clearCartSnapshot(customerId)
    return { ok: true, itemCount: 0, subtotal: 0 }
  }
  const products = await db.product.findMany({
    where: { id: { in: ids }, isActive: true },
    select: { id: true, nameFa: true, price: true },
  })
  const items: CartSnapshotItem[] = products.map((p) => ({
    productId: p.id,
    quantity: wanted.get(p.id) ?? 1,
    name: p.nameFa,
    price: p.price,
    image: null,
  })).sort((a, b) => a.productId.localeCompare(b.productId))
  const itemCount = items.reduce((s, i) => s + i.quantity, 0)
  const subtotal = items.reduce((s, i) => s + i.price * i.quantity, 0)
  if (items.length === 0) {
    await clearCartSnapshot(customerId)
    return { ok: true, itemCount: 0, subtotal: 0 }
  }
  // Unchanged cart (e.g. a page reload): keep the idle clock where it is.
  const prev = await db.cartSnapshot.findUnique({ where: { customerId }, select: { items: true, subtotal: true } })
  // (jsonb does not keep key order, so compare the meaningful fields, not the raw text)
  const sig = (list: Array<{ productId: string; quantity: number; price: number }>) =>
    list.map((i) => `${i.productId}:${i.quantity}:${i.price}`).sort().join('|')
  if (prev && prev.subtotal === subtotal && sig((Array.isArray(prev.items) ? prev.items : []) as never) === sig(items)) return { ok: true, itemCount, subtotal }
  await db.cartSnapshot.upsert({
    where: { customerId },
    create: { customerId, items: items as never, itemCount, subtotal },
    // A new change means the customer is active again: the idle clock restarts via updatedAt.
    update: { items: items as never, itemCount, subtotal, recoveredOrderId: null },
  })
  return { ok: true, itemCount, subtotal }
}

/**
 * Called when an order is placed. If a reminder had been sent for this cart, the snapshot is kept
 * (emptied) with the order id so the admin can see the reminder worked; otherwise it is removed.
 */
export async function clearCartSnapshot(customerId: string, orderId?: string): Promise<void> {
  const snap = await db.cartSnapshot.findUnique({ where: { customerId }, select: { id: true, lastReminderAt: true } })
  if (!snap) return
  if (orderId && snap.lastReminderAt) {
    await db.cartSnapshot.update({ where: { id: snap.id }, data: { items: [], itemCount: 0, subtotal: 0, recoveredOrderId: orderId } })
  } else {
    await db.cartSnapshot.deleteMany({ where: { id: snap.id } })
  }
}

export async function clearCartSnapshotSafe(customerId: string, orderId?: string): Promise<void> {
  try {
    await clearCartSnapshot(customerId, orderId)
  } catch (err) {
    console.error('club: cart clear failed', (err as Error)?.name)
  }
}

export async function getCartSnapshot(customerId: string) {
  const snap = await db.cartSnapshot.findUnique({ where: { customerId } })
  if (!snap) return null
  return { ...snap, items: (Array.isArray(snap.items) ? snap.items : []) as unknown as CartSnapshotItem[] }
}

/** Active carts, newest activity first; `idleHours` filters to abandoned ones. */
export async function listCarts(opts: { idleHours?: number; take?: number; skip?: number } = {}) {
  const where = {
    itemCount: { gt: 0 },
    ...(opts.idleHours ? { updatedAt: { lt: new Date(Date.now() - opts.idleHours * 3_600_000) } } : {}),
  }
  const [rows, total] = await Promise.all([
    db.cartSnapshot.findMany({
      where,
      orderBy: { updatedAt: 'desc' },
      take: Math.min(100, opts.take ?? 30),
      skip: opts.skip ?? 0,
      include: { customer: { select: { id: true, firstName: true, lastName: true, phone: true, marketingSmsConsent: true } } },
    }),
    db.cartSnapshot.count({ where }),
  ])
  return { rows: rows.map((r) => ({ ...r, items: (Array.isArray(r.items) ? r.items : []) as unknown as CartSnapshotItem[] })), total }
}

/** What customers put in carts most (by quantity) across current snapshots. */
export async function topCartedProducts(take = 10): Promise<Array<{ productId: string; name: string; quantity: number; carts: number }>> {
  const snaps = await db.cartSnapshot.findMany({ where: { itemCount: { gt: 0 } }, select: { items: true }, take: 5000 })
  const agg = new Map<string, { name: string; quantity: number; carts: number }>()
  for (const s of snaps) {
    for (const i of (Array.isArray(s.items) ? s.items : []) as unknown as CartSnapshotItem[]) {
      const a = agg.get(i.productId) ?? { name: i.name, quantity: 0, carts: 0 }
      a.quantity += i.quantity
      a.carts += 1
      agg.set(i.productId, a)
    }
  }
  return [...agg.entries()].map(([productId, a]) => ({ productId, ...a })).sort((x, y) => y.quantity - x.quantity).slice(0, take)
}
