import type { Prisma } from '@prisma/client';
import { normalizeFa } from '@/lib/text/persian';
import { expandSearchQuery } from '@/lib/shop/brands';
import { toLatinDigits } from '@/lib/date/jalali';

export type PetFilter = 'cat' | 'dog';
export type SortKey = 'popular' | 'newest' | 'price-asc' | 'price-desc' | 'discount';

export interface ShopFilters {
  q: string;
  pet: PetFilter | null;
  inStock: boolean;
  min: number | null;
  max: number | null;
  sort: SortKey;
  page: number;
}

export const SORT_LABELS: Record<SortKey, string> = {
  popular: 'پیشنهاد پت‌باس',
  newest: 'جدیدترین',
  'price-asc': 'ارزان‌ترین',
  'price-desc': 'گران‌ترین',
  discount: 'بیشترین تخفیف',
};

type Raw = Record<string, string | string[] | undefined>;
const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? '';

/** Positive whole number from user input; accepts Persian/Arabic digits and separators. */
function toInt(v: string): number | null {
  const digits = toLatinDigits(v).replace(/[^0-9]/g, '').slice(0, 12);
  const n = Number(digits);
  return digits && Number.isFinite(n) && n > 0 ? n : null;
}

export function parseShopFilters(raw: Raw): ShopFilters {
  const pet = first(raw.pet);
  const sort = first(raw.sort) as SortKey;
  const page = Number(first(raw.page));
  let min = toInt(first(raw.min));
  let max = toInt(first(raw.max));
  // "از ۵۰۰ تا ۱۰۰" is a slip, not a request for an empty listing.
  if (min && max && min > max) [min, max] = [max, min];
  return {
    q: normalizeFa(first(raw.q)).slice(0, 80),
    pet: pet === 'cat' || pet === 'dog' ? pet : null,
    inStock: first(raw.stock) === '1',
    min,
    max,
    sort: sort in SORT_LABELS ? sort : 'popular',
    page: Number.isInteger(page) && page > 1 ? page : 1,
  };
}

/** True when the listing is a filtered/search variant (not worth indexing separately). */
export function isFilteredView(f: ShopFilters): boolean {
  return !!(f.q || f.pet || f.inStock || f.min || f.max || f.sort !== 'popular');
}

/** Query string for a filter set (omits defaults). `page` overrides the page number. */
export function filtersToQuery(f: Partial<ShopFilters>, page?: number): string {
  const p = new URLSearchParams();
  if (f.q) p.set('q', f.q);
  if (f.pet) p.set('pet', f.pet);
  if (f.inStock) p.set('stock', '1');
  if (f.min) p.set('min', String(f.min));
  if (f.max) p.set('max', String(f.max));
  if (f.sort && f.sort !== 'popular') p.set('sort', f.sort);
  const pg = page ?? f.page ?? 1;
  if (pg > 1) p.set('page', String(pg));
  const s = p.toString();
  return s ? `?${s}` : '';
}

const PET_WORDS: Record<PetFilter, { slugPrefix: string; words: string[] }> = {
  cat: { slugPrefix: 'cat-', words: ['cat', 'kitten', 'گربه'] },
  dog: { slugPrefix: 'dog-', words: ['dog', 'puppy', 'سگ'] },
};

export function buildProductWhere(
  f: ShopFilters,
  scope: Prisma.ProductWhereInput = {}
): Prisma.ProductWhereInput {
  const and: Prisma.ProductWhereInput[] = [{ isActive: true, deletedAt: null }, scope];

  if (f.q) {
    for (const group of expandSearchQuery(f.q)) {
      and.push({
        OR: group.flatMap((term) => [
          { nameFa: { contains: term, mode: 'insensitive' as const } },
          { nameEn: { contains: term, mode: 'insensitive' as const } },
          { sku: { contains: term, mode: 'insensitive' as const } },
          { category: { nameFa: { contains: term, mode: 'insensitive' as const } } },
          { brand: { nameFa: { contains: term, mode: 'insensitive' as const } } },
        ]),
      });
    }
  }

  if (f.pet) {
    const { slugPrefix, words } = PET_WORDS[f.pet];
    and.push({
      OR: [
        { category: { slugFa: { startsWith: slugPrefix } } },
        { speciesCompatibility: { some: { nameFa: { contains: f.pet === 'cat' ? 'گربه' : 'سگ' } } } },
        ...words.map((w) => ({ nameFa: { contains: w, mode: 'insensitive' as const } })),
      ],
    });
  }

  if (f.inStock) and.push({ stockStatus: { in: ['IN_STOCK', 'LOW_STOCK'] } });
  if (f.min || f.max) {
    and.push({ price: { gt: 0, ...(f.min && { gte: f.min }), ...(f.max && { lte: f.max }) } });
  }
  // Call-for-price products (price 0) have no comparable price, so they must not
  // lead "cheapest first" / "biggest discount" listings or their pagination.
  if (f.sort === 'price-asc' || f.sort === 'price-desc' || f.sort === 'discount') {
    and.push({ price: { gt: 0 } });
  }
  // "Biggest discount" lists discounted products only. Prisma cannot compare two
  // columns here without a client instance, so `comparePrice > price` is finished
  // by rankByDiscount() on the (small) candidate set.
  if (f.sort === 'discount') and.push({ comparePrice: { gt: 0 } });
  return { AND: and };
}

export function buildProductOrder(sort: SortKey): Prisma.ProductOrderByWithRelationInput[] {
  // Out-of-stock items always sink to the bottom (enum order: IN_STOCK, LOW_STOCK, ...).
  const stock: Prisma.ProductOrderByWithRelationInput = { stockStatus: 'asc' };
  switch (sort) {
    case 'newest':
      return [stock, { createdAt: 'desc' }];
    case 'price-asc':
      return [stock, { price: 'asc' }];
    case 'price-desc':
      return [stock, { price: 'desc' }];
    case 'discount':
      return [stock, { comparePrice: { sort: 'desc', nulls: 'last' } }, { price: 'asc' }];
    default:
      return [stock, { isFeatured: 'desc' }, { sortOrder: 'asc' }, { createdAt: 'desc' }];
  }
}

/** Discount as a fraction of the original price (0 when there is no real discount). */
export function discountRatio(p: { price: number; comparePrice: number | null }): number {
  if (!p.comparePrice || p.price <= 0 || p.comparePrice <= p.price) return 0;
  return (p.comparePrice - p.price) / p.comparePrice;
}

const SELLABLE_FIRST: Record<string, number> = { IN_STOCK: 0, LOW_STOCK: 0, ON_BACKORDER: 1, OUT_OF_STOCK: 2 };

/**
 * Orders candidates for the "biggest discount" sort: really discounted products
 * only, available ones first, then by discount percentage (ties: cheaper first).
 */
export function rankByDiscount<T extends { id: string; price: number; comparePrice: number | null; stockStatus: string }>(
  rows: T[]
): T[] {
  return rows
    .filter((r) => discountRatio(r) > 0)
    .sort(
      (a, b) =>
        (SELLABLE_FIRST[a.stockStatus] ?? 3) - (SELLABLE_FIRST[b.stockStatus] ?? 3) ||
        discountRatio(b) - discountRatio(a) ||
        a.price - b.price ||
        a.id.localeCompare(b.id)
    );
}
