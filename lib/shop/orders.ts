import 'server-only';
import { Prisma } from '@prisma/client';
import { db } from '@/lib/db';
import { sellableCutoff, sellableQuantity } from '@/lib/shop/expiry';
import { syncProductStock } from '@/lib/shop/stock-sync';
import { productImage } from '@/lib/shop/catalog';
import { dateToJalali } from '@/lib/date/jalali';
import { UNSELLABLE_MESSAGE_FA, unsellableReason } from '@/lib/shop/sellable';

export interface PricedLine {
  productId: string;
  nameFa: string;
  slugFa: string;
  sku: string | null;
  image: string;
  unitPrice: number;
  quantity: number;
  lineTotal: number;
  /** Units available (null = not tracked by batches) */
  available: number | null;
  problem?: string;
}

/**
 * Re-prices a cart from the database. Prices, availability and names always come
 * from the server; the browser only supplies product ids and quantities.
 */
export async function priceCart(items: { productId: string; quantity: number }[], now = new Date()) {
  const products = await db.product.findMany({
    where: { id: { in: items.map((i) => i.productId) } },
    select: {
      id: true,
      nameFa: true,
      slugFa: true,
      sku: true,
      price: true,
      isActive: true,
      deletedAt: true,
      stockStatus: true,
      images: { orderBy: { sortOrder: 'asc' }, take: 1, select: { imageId: true } },
      category: { select: { imageId: true } },
      inventory: { select: { quantity: true, expiryDate: true } },
    },
  });
  const byId = new Map(products.map((p) => [p.id, p]));

  const lines: PricedLine[] = [];
  for (const item of items) {
    const p = byId.get(item.productId);
    if (!p) continue;
    const available = p.inventory.length ? sellableQuantity(p.inventory, now) : null;
    let problem: string | undefined;
    // Same rule as the product page and the feeds (lib/shop/sellable.ts).
    const reason = unsellableReason(p, available);
    if (reason) problem = UNSELLABLE_MESSAGE_FA[reason];
    else if (available !== null && item.quantity > available) problem = `فقط ${available.toLocaleString('fa-IR')} عدد موجود است.`;

    lines.push({
      productId: p.id,
      nameFa: p.nameFa,
      slugFa: p.slugFa,
      sku: p.sku,
      image: productImage(p),
      unitPrice: p.price,
      quantity: item.quantity,
      lineTotal: p.price * item.quantity,
      available,
      problem,
    });
  }
  const subtotal = lines.filter((l) => !l.problem).reduce((s, l) => s + l.lineTotal, 0);
  return { lines, subtotal, hasProblems: lines.some((l) => l.problem) };
}

/** Next order number for the current Jalali year: PB-1405-000123 */
export async function nextOrderNumber(tx: Prisma.TransactionClient, now = new Date()): Promise<string> {
  const { jy } = dateToJalali(now);
  const prefix = `PB-${jy}-`;
  const last = await tx.order.findFirst({
    where: { number: { startsWith: prefix } },
    orderBy: { number: 'desc' },
    select: { number: true },
  });
  const seq = last ? Number(last.number.slice(prefix.length)) + 1 : 1;
  return `${prefix}${String(seq).padStart(6, '0')}`;
}

// ─── Stock allocation ───────────────────────────────────────────────────────

/** Units an order line could not get from stock. */
export interface StockShortage {
  productId: string;
  nameFa: string;
  missing: number;
}

export interface AllocationResult {
  /** True when this call took the stock (false: already allocated, or rolled back in strict mode). */
  allocated: boolean;
  shortages: StockShortage[];
}

/** What was taken from one batch for one order line (stored in OrderItem.allocations). */
export interface BatchTake {
  batchId: string;
  quantity: number;
}

/** Thrown inside a transaction (strict mode) so everything rolls back. */
export class StockShortageError extends Error {
  constructor(public readonly shortages: StockShortage[]) {
    super('stock shortage');
    this.name = 'StockShortageError';
  }
}

/** Reads OrderItem.allocations defensively. Null means "legacy / unknown". */
export function parseAllocations(value: unknown): BatchTake[] | null {
  if (!Array.isArray(value)) return null;
  const out: BatchTake[] = [];
  for (const v of value) {
    if (!v || typeof v !== 'object') continue;
    const { batchId, quantity } = v as { batchId?: unknown; quantity?: unknown };
    const q = Math.floor(Number(quantity));
    if (typeof batchId === 'string' && batchId && Number.isFinite(q) && q > 0) out.push({ batchId, quantity: q });
  }
  return out;
}

export function shortageNote(shortages: StockShortage[]): string {
  return `⚠ کسری موجودی هنگام ثبت: ${shortages.map((s) => `${s.nameFa}: ${s.missing}`).join('، ')}`;
}

const TX_OPTIONS = { maxWait: 10_000, timeout: 20_000 };

/**
 * Allocation inside an existing transaction. Returns the ids of batch-tracked
 * products that were touched (call syncProductStock for them after commit).
 * In strict mode a shortage throws StockShortageError so the caller's whole
 * transaction (including the order it just created) is rolled back.
 */
export async function allocateOrderStockTx(
  tx: Prisma.TransactionClient,
  orderId: string,
  now = new Date(),
  opts: { strict?: boolean } = {}
): Promise<{ claimed: boolean; shortages: StockShortage[]; productIds: string[] }> {
  const claim = await tx.order.updateMany({ where: { id: orderId, stockAllocated: false }, data: { stockAllocated: true } });
  if (claim.count === 0) return { claimed: false, shortages: [], productIds: [] };
  const order = await tx.order.findUniqueOrThrow({
    where: { id: orderId },
    select: { adminNote: true, items: { select: { id: true, productId: true, nameFa: true, quantity: true } } },
  });

  const cutoff = sellableCutoff(now);
  const productIds: string[] = [];
  const shortages: StockShortage[] = [];
  for (const item of order.items) {
    if (!item.productId) continue;
    let remaining = item.quantity;
    const taken: BatchTake[] = [];
    const batches = await tx.inventory.findMany({
      where: { productId: item.productId, quantity: { gt: 0 }, OR: [{ expiryDate: null }, { expiryDate: { gte: cutoff } }] },
      orderBy: [{ expiryDate: { sort: 'asc', nulls: 'last' } }, { receivedAt: 'asc' }],
      select: { id: true },
    });
    for (const b of batches) {
      // Retry a few times if another order took units from this batch meanwhile.
      for (let attempt = 0; attempt < 3 && remaining > 0; attempt++) {
        const fresh = await tx.inventory.findUnique({ where: { id: b.id }, select: { quantity: true } });
        const take = Math.min(fresh?.quantity ?? 0, remaining);
        if (take <= 0) break;
        const res = await tx.inventory.updateMany({
          where: { id: b.id, quantity: { gte: take } },
          data: { quantity: { decrement: take } },
        });
        if (res.count === 1) {
          remaining -= take;
          taken.push({ batchId: b.id, quantity: take });
          break;
        }
      }
      if (remaining <= 0) break;
    }
    // Products with no batch rows at all are not stock-tracked (manual status only).
    const tracked = batches.length > 0 || (await tx.inventory.count({ where: { productId: item.productId } })) > 0;
    if (tracked) {
      productIds.push(item.productId);
      if (remaining > 0) shortages.push({ productId: item.productId, nameFa: item.nameFa, missing: remaining });
    }
    // Remember exactly what was taken, so a cancellation returns exactly that.
    await tx.orderItem.update({
      where: { id: item.id },
      data: { allocations: taken as unknown as Prisma.InputJsonValue },
    });
  }
  if (shortages.length) {
    if (opts.strict) throw new StockShortageError(shortages);
    const note = shortageNote(shortages);
    await tx.order.update({
      where: { id: orderId },
      data: { adminNote: order.adminNote ? `${order.adminNote}\n${note}` : note },
    });
  }
  return { claimed: true, shortages, productIds };
}

/**
 * Takes ordered units out of dated stock batches, earliest expiry first (FEFO),
 * skipping batches that are expired or below the minimum shelf life.
 *
 * Concurrency-safe: the order is claimed with a conditional update (so two callers
 * can never allocate the same order twice), and each batch is decremented only if
 * it still holds enough units (so two orders can never drive a batch below zero).
 *
 * Default mode: units that could not be covered are written to the order's admin
 * note and returned as `shortages` (the order keeps what it got).
 * Strict mode: on any shortage nothing is taken at all and `allocated` is false.
 */
export async function allocateOrderStock(
  orderId: string,
  now = new Date(),
  opts: { strict?: boolean } = {}
): Promise<AllocationResult> {
  let result: { claimed: boolean; shortages: StockShortage[]; productIds: string[] };
  try {
    result = await db.$transaction((tx) => allocateOrderStockTx(tx, orderId, now, opts), TX_OPTIONS);
  } catch (err) {
    if (err instanceof StockShortageError) return { allocated: false, shortages: err.shortages };
    throw err;
  }
  for (const id of result.productIds) await syncProductStock(id);
  return { allocated: result.claimed, shortages: result.shortages };
}

/**
 * Puts allocated units back when an order is cancelled.
 *
 * Orders allocated by the current code return exactly the units they took, to the
 * batches they came from (so a short allocation can never create phantom stock).
 * Legacy orders (no stored allocations) fall back to the old behaviour: the full
 * quantity goes to the earliest-expiring valid batch.
 */
export async function releaseOrderStock(orderId: string, now = new Date()): Promise<void> {
  const touched = await db.$transaction(async (tx) => {
    // Claim the release so a double "cancel" click cannot return stock twice.
    const claim = await tx.order.updateMany({ where: { id: orderId, stockAllocated: true }, data: { stockAllocated: false } });
    if (claim.count === 0) return [];
    const order = await tx.order.findUniqueOrThrow({
      where: { id: orderId },
      select: { items: { select: { productId: true, quantity: true, allocations: true } } },
    });

    const fallbackBatch = async (productId: string) =>
      (await tx.inventory.findFirst({
        where: { productId, OR: [{ expiryDate: null }, { expiryDate: { gte: now } }] },
        orderBy: [{ expiryDate: { sort: 'asc', nulls: 'last' } }, { receivedAt: 'asc' }],
        select: { id: true },
      })) ?? (await tx.inventory.findFirst({ where: { productId }, orderBy: { receivedAt: 'desc' }, select: { id: true } }));

    const ids = new Set<string>();
    for (const item of order.items) {
      if (!item.productId) continue;
      const takes = parseAllocations(item.allocations);
      let orphaned = takes === null ? item.quantity : 0;
      for (const t of takes ?? []) {
        const res = await tx.inventory.updateMany({
          where: { id: t.batchId, productId: item.productId },
          data: { quantity: { increment: t.quantity } },
        });
        if (res.count === 1) ids.add(item.productId);
        else orphaned += t.quantity; // the batch row was deleted meanwhile
      }
      if (orphaned > 0) {
        const batch = await fallbackBatch(item.productId);
        if (batch) {
          await tx.inventory.update({ where: { id: batch.id }, data: { quantity: { increment: orphaned } } });
          ids.add(item.productId);
        }
      }
    }
    await tx.orderItem.updateMany({ where: { orderId }, data: { allocations: Prisma.DbNull } });
    return [...ids];
  }, TX_OPTIONS);
  for (const id of touched) await syncProductStock(id);
}

export const ORDER_STATUS_FA: Record<string, string> = {
  PENDING_PAYMENT: 'در انتظار پرداخت',
  PAYMENT_FAILED: 'پرداخت ناموفق',
  CONFIRMED: 'ثبت و تأیید شد',
  PROCESSING: 'در حال آماده‌سازی',
  SHIPPED: 'ارسال شد',
  DELIVERED: 'تحویل داده شد',
  CANCELLED: 'لغو شد',
};
