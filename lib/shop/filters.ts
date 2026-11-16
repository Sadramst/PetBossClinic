import type { Prisma } from '@prisma/client';
import { normalizeFa } from '@/lib/text/persian';
import { expandSearchQuery } from '@/lib/shop/brands';

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

function toInt(v: string): number | null {
  const n = Number(v.replace(/[^\d]/g, ''));
  return v.trim() && Number.isFinite(n) && n > 0 ? n : null;
}

export function parseShopFilters(raw: Raw): ShopFilters {
  const pet = first(raw.pet);
  const sort = first(raw.sort) as SortKey;
  const page = Number(first(raw.page));
  return {
    q: normalizeFa(first(raw.q)).slice(0, 80),
    pet: pet === 'cat' || pet === 'dog' ? pet : null,
    inStock: first(raw.stock) === '1',
    min: toInt(first(raw.min)),
    max: toInt(first(raw.max)),
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
