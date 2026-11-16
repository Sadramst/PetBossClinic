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
 * skipping expired batches. Idempotent per order via Order.stockAllocated.
 */
export async function allocateOrderStock(orderId: string, now = new Date()): Promise<void> {
  const touched = await db.$transaction(async (tx) => {
    const order = await tx.order.findUnique({
      where: { id: orderId },
      select: { stockAllocated: true, items: { select: { productId: true, quantity: true } } },
    });
    if (!order || order.stockAllocated) return [];

    const productIds: string[] = [];
    for (const item of order.items) {
      if (!item.productId) continue;
      let remaining = item.quantity;
      const batches = await tx.inventory.findMany({
        where: { productId: item.productId, quantity: { gt: 0 }, OR: [{ expiryDate: null }, { expiryDate: { gte: now } }] },
        orderBy: [{ expiryDate: { sort: 'asc', nulls: 'last' } }, { receivedAt: 'asc' }],
      });
      for (const b of batches) {
        if (remaining <= 0) break;
        const take = Math.min(b.quantity, remaining);
        await tx.inventory.update({ where: { id: b.id }, data: { quantity: { decrement: take } } });
        remaining -= take;
      }
      if (batches.length) productIds.push(item.productId);
    }
    await tx.order.update({ where: { id: orderId }, data: { stockAllocated: true } });
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
    const order = await tx.order.findUnique({
      where: { id: orderId },
      select: { stockAllocated: true, items: { select: { productId: true, quantity: true } } },
    });
    if (!order?.stockAllocated) return [];
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
    await tx.order.update({ where: { id: orderId }, data: { stockAllocated: false } });
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
