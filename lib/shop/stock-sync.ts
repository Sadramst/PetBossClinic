import 'server-only';
import { StockStatus } from '@prisma/client';
import { db } from '@/lib/db';
import { sellableQuantity } from '@/lib/shop/expiry';

/** At or below this many sellable units a product shows "limited stock". */
export const LOW_STOCK_THRESHOLD = 3;

export function stockStatusFor(sellable: number): StockStatus {
  if (sellable <= 0) return 'OUT_OF_STOCK';
  if (sellable <= LOW_STOCK_THRESHOLD) return 'LOW_STOCK';
  return 'IN_STOCK';
}

/**
 * Recomputes Product.stockStatus from its dated batches (expired units never count).
 * Products with no batches keep their manually managed status.
 * Returns the product slug when the status changed, so callers can revalidate its page.
 */
export async function syncProductStock(productId: string, now = new Date()): Promise<string | null> {
  const product = await db.product.findUnique({
    where: { id: productId },
    select: {
      slugFa: true,
      price: true,
      stockStatus: true,
      inventory: { select: { quantity: true, expiryDate: true } },
    },
  });
  if (!product || product.inventory.length === 0) return null;

  const next = stockStatusFor(sellableQuantity(product.inventory, now));
  if (next === product.stockStatus) return null;

  await db.product.update({
    where: { id: productId },
    data: { stockStatus: next, isPurchasable: next !== 'OUT_OF_STOCK' && product.price > 0 },
  });
  return product.slugFa;
}
