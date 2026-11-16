import 'server-only';
import { Prisma } from '@prisma/client';
import { db } from '@/lib/db';
import { sellableQuantity } from '@/lib/shop/expiry';
import { syncProductStock } from '@/lib/shop/stock-sync';
import { productImage } from '@/lib/shop/catalog';
import { dateToJalali } from '@/lib/date/jalali';

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
    if (!p.isActive || p.deletedAt) problem = 'این کالا دیگر فروخته نمی‌شود.';
    else if (p.price <= 0) problem = 'قیمت این کالا استعلامی است؛ برای خرید تماس بگیرید.';
    else if (p.stockStatus === 'OUT_OF_STOCK' || available === 0) problem = 'ناموجود';
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

/**
 * Takes ordered units out of dated stock batches, earliest expiry first (FEFO),
 * skipping expired batches.
 *
 * Concurrency-safe: the order is claimed with a conditional update (so two callers
 * can never allocate the same order twice), and each batch is decremented only if
 * it still holds enough units (so two orders can never drive a batch below zero).
 * Units that could not be covered are written to the order's admin note.
 */
export async function allocateOrderStock(orderId: string, now = new Date()): Promise<void> {
  const touched = await db.$transaction(async (tx) => {
    const claim = await tx.order.updateMany({ where: { id: orderId, stockAllocated: false }, data: { stockAllocated: true } });
    if (claim.count === 0) return [];
    const order = await tx.order.findUniqueOrThrow({
      where: { id: orderId },
      select: { adminNote: true, items: { select: { productId: true, nameFa: true, quantity: true } } },
    });

    const productIds: string[] = [];
    const shortages: string[] = [];
    for (const item of order.items) {
      if (!item.productId) continue;
      let remaining = item.quantity;
      const batches = await tx.inventory.findMany({
        where: { productId: item.productId, quantity: { gt: 0 }, OR: [{ expiryDate: null }, { expiryDate: { gte: now } }] },
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
            break;
          }
        }
        if (remaining <= 0) break;
      }
      // Products with no batch rows at all are not stock-tracked (manual status only).
      const tracked = batches.length > 0 || (await tx.inventory.count({ where: { productId: item.productId } })) > 0;
      if (tracked) {
        productIds.push(item.productId);
        if (remaining > 0) shortages.push(`${item.nameFa}: ${remaining}`);
      }
    }
    if (shortages.length) {
      const note = `⚠ کسری موجودی هنگام ثبت: ${shortages.join('، ')}`;
      await tx.order.update({
        where: { id: orderId },
        data: { adminNote: order.adminNote ? `${order.adminNote}\n${note}` : note },
      });
    }
    return productIds;
  });
  for (const id of touched) await syncProductStock(id);
}

/**
 * Puts allocated units back when an order is cancelled. Units left FEFO, so they
 * most likely came from the earliest-expiring batch that is still valid: return
 * them there (never into a batch that expires later than the real units).
 */
export async function releaseOrderStock(orderId: string, now = new Date()): Promise<void> {
  const touched = await db.$transaction(async (tx) => {
    // Claim the release so a double "cancel" click cannot return stock twice.
    const claim = await tx.order.updateMany({ where: { id: orderId, stockAllocated: true }, data: { stockAllocated: false } });
    if (claim.count === 0) return [];
    const order = await tx.order.findUniqueOrThrow({
      where: { id: orderId },
      select: { items: { select: { productId: true, quantity: true } } },
    });
    const ids: string[] = [];
    for (const item of order.items) {
      if (!item.productId) continue;
      const batch =
        (await tx.inventory.findFirst({
          where: { productId: item.productId, OR: [{ expiryDate: null }, { expiryDate: { gte: now } }] },
          orderBy: [{ expiryDate: { sort: 'asc', nulls: 'last' } }, { receivedAt: 'asc' }],
        })) ?? (await tx.inventory.findFirst({ where: { productId: item.productId }, orderBy: { receivedAt: 'desc' } }));
      if (!batch) continue;
      await tx.inventory.update({ where: { id: batch.id }, data: { quantity: { increment: item.quantity } } });
      ids.push(item.productId);
    }
    return ids;
  });
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
