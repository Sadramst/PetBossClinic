import 'server-only';
import { cache } from 'react';
import { unstable_cache } from 'next/cache';
import { db } from '@/lib/db';
import { Prisma } from '@prisma/client';
import { buildProductOrder, buildProductWhere, type ShopFilters } from '@/lib/shop/filters';

export const CATEGORY_PAGE_SIZE = 24;

/** Fields every product card needs. */
export const productCardSelect = {
  id: true,
  slugFa: true,
  nameFa: true,
  shortDescFa: true,
  price: true,
  comparePrice: true,
  stockStatus: true,
  images: { orderBy: { sortOrder: 'asc' }, take: 1, select: { imageId: true } },
  category: { select: { nameFa: true, slugFa: true, imageId: true } },
} satisfies Prisma.ProductSelect;

export type ProductCardData = Prisma.ProductGetPayload<{ select: typeof productCardSelect }>;

/** Products visible on the storefront. */
export const visibleProduct: Prisma.ProductWhereInput = { isActive: true, deletedAt: null };

export function productImage(p: { images?: { imageId: string }[]; category?: { imageId?: string | null } | null }): string {
  const img = p.images?.[0]?.imageId || p.category?.imageId || '/images/categories/other.jpg';
  // Legacy rows may still hold inline base64; never put that in HTML/OG tags.
  return img.startsWith('data:') ? p.category?.imageId || '/images/categories/other.jpg' : img;
}

export const getProductBySlug = cache(async (slug: string) => {
  return db.product.findFirst({
    where: { ...visibleProduct, slugFa: slug },
    include: {
      category: { select: { id: true, nameFa: true, slugFa: true, imageId: true, parentId: true } },
      brand: { select: { nameFa: true, nameEn: true, slugFa: true } },
      images: { orderBy: { sortOrder: 'asc' }, select: { imageId: true } },
      attributes: true,
      speciesCompatibility: { where: { isActive: true }, select: { nameFa: true } },
      inventory: { select: { quantity: true, expiryDate: true } },
    },
  });
});

export async function getRelatedProducts(productId: string, categoryId: string, take = 8) {
  return db.product.findMany({
    where: { ...visibleProduct, categoryId, id: { not: productId } },
    orderBy: [{ stockStatus: 'asc' }, { isFeatured: 'desc' }, { sortOrder: 'asc' }],
    take,
    select: productCardSelect,
  });
}

export const getCategoryBySlug = cache(async (slug: string) => {
  return db.productCategory.findFirst({
    where: { slugFa: slug, isActive: true, deletedAt: null },
  });
});

export async function getActiveCategories() {
  return db.productCategory.findMany({
    where: { isActive: true, deletedAt: null },
    orderBy: { sortOrder: 'asc' },
    select: {
      id: true,
      slugFa: true,
      nameFa: true,
      imageId: true,
      updatedAt: true,
      _count: { select: { products: { where: visibleProduct } } },
    },
  });
}

export async function getCategoryProducts(categoryId: string, page: number) {
  const where: Prisma.ProductWhereInput = { ...visibleProduct, categoryId };
  const [total, products] = await Promise.all([
    db.product.count({ where }),
    db.product.findMany({
      where,
      // In-stock first, then curated order.
      orderBy: [{ stockStatus: 'asc' }, { isFeatured: 'desc' }, { sortOrder: 'asc' }, { createdAt: 'desc' }],
      skip: (page - 1) * CATEGORY_PAGE_SIZE,
      take: CATEGORY_PAGE_SIZE,
      select: productCardSelect,
    }),
  ]);
  return { total, products, pageCount: Math.max(1, Math.ceil(total / CATEGORY_PAGE_SIZE)) };
}

// ─── Filtered listings (shop, category, brand pages) ────────────────────────

export async function getListing(filters: ShopFilters, scope: Prisma.ProductWhereInput = {}) {
  const where = buildProductWhere(filters, scope);
  const [total, products] = await Promise.all([
    db.product.count({ where }),
    db.product.findMany({
      where,
      orderBy: buildProductOrder(filters.sort),
      skip: (filters.page - 1) * CATEGORY_PAGE_SIZE,
      take: CATEGORY_PAGE_SIZE,
      select: productCardSelect,
    }),
  ]);
  return { total, products, pageCount: Math.max(1, Math.ceil(total / CATEGORY_PAGE_SIZE)) };
}

export const getActiveBrands = cache(async () => {
  return db.brand.findMany({
    where: { isActive: true, deletedAt: null, products: { some: visibleProduct } },
    orderBy: { sortOrder: 'asc' },
    select: {
      id: true,
      slugFa: true,
      nameFa: true,
      nameEn: true,
      updatedAt: true,
      _count: { select: { products: { where: visibleProduct } } },
    },
  });
});

export const getBrandBySlug = cache(async (slug: string) => {
  return db.brand.findFirst({ where: { slugFa: slug, isActive: true, deletedAt: null } });
});

/** Featured/curated products for homepage rails. */
export async function getProductRail(scope: Prisma.ProductWhereInput, take = 10) {
  return db.product.findMany({
    where: { ...visibleProduct, stockStatus: { in: ['IN_STOCK', 'LOW_STOCK'] }, price: { gt: 0 }, ...scope },
    orderBy: [{ isFeatured: 'desc' }, { sortOrder: 'asc' }],
    take,
    select: productCardSelect,
  });
}

/** Categories and brands for header/footer menus (cached across requests). */
export const getNavCatalog = unstable_cache(
  async () => {
    try {
      const [categories, brands] = await Promise.all([
        db.productCategory.findMany({
          where: { isActive: true, deletedAt: null, products: { some: visibleProduct } },
          orderBy: { sortOrder: 'asc' },
          select: { id: true, slugFa: true, nameFa: true },
        }),
        db.brand.findMany({
          where: { isActive: true, deletedAt: null, products: { some: visibleProduct } },
          orderBy: [{ products: { _count: 'desc' } }],
          select: { id: true, slugFa: true, nameFa: true },
        }),
      ]);
      return { categories, brands };
    } catch (err) {
      console.error('getNavCatalog failed', err);
      return { categories: [], brands: [] };
    }
  },
  ['nav-catalog'],
  { revalidate: 600, tags: ['catalog'] }
);
