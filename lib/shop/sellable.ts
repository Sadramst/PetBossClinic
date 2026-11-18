/**
 * One rule for "can this product be bought online right now", shared by the product
 * page, the cart/checkout pricing and the shopping feeds. Pure (no database).
 */
export interface SellableProduct {
  price: number;
  stockStatus: string;
  isActive?: boolean;
  deletedAt?: Date | string | null;
}

export type UnsellableReason = 'inactive' | 'call-for-price' | 'out-of-stock' | 'backorder';

/**
 * @param available Sellable units from dated batches, or null when the product is
 *                  not batch-tracked (its manual stock status decides).
 */
export function unsellableReason(p: SellableProduct, available: number | null = null): UnsellableReason | null {
  if (p.isActive === false || p.deletedAt) return 'inactive';
  if (!(p.price > 0)) return 'call-for-price';
  if (p.stockStatus === 'OUT_OF_STOCK' || available === 0) return 'out-of-stock';
  // Backorder items are arranged by phone; they are not sold through the cart.
  if (p.stockStatus === 'ON_BACKORDER') return 'backorder';
  return null;
}

export function isSellable(p: SellableProduct, available: number | null = null): boolean {
  return unsellableReason(p, available) === null;
}

export const UNSELLABLE_MESSAGE_FA: Record<UnsellableReason, string> = {
  inactive: 'این کالا دیگر فروخته نمی‌شود.',
  'call-for-price': 'قیمت این کالا استعلامی است؛ برای خرید تماس بگیرید.',
  'out-of-stock': 'ناموجود',
  backorder: 'این کالا فقط با سفارش تلفنی عرضه می‌شود.',
};
