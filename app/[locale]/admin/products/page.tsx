import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { ProductsManager } from "@/components/admin/products-manager";
import { requireAdmin } from "@/lib/auth/guard";
import { hasRoleAccess } from "@/lib/auth";
import { nearestExpiryByProduct, stateWhere } from "@/lib/shop/inventory-admin";
import { getExpiryConfig } from "@/lib/shop/expiry-config";
import { daysUntil } from "@/lib/shop/expiry";

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

const STATUSES = ['ALL', 'ACTIVE', 'INACTIVE', 'IN_STOCK', 'LOW_STOCK', 'OUT_OF_STOCK', 'FEATURED'] as const;
const ALL_PAGE_CAP = 500;

function one(v: string | string[] | undefined): string {
  return (Array.isArray(v) ? v[0] : v) ?? '';
}

export default async function AdminProductsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { locale } = await params;
  const session = await requireAdmin('VIEWER', locale);

  const sp = await searchParams;
  const q = one(sp.q).trim().slice(0, 80);
  const cat = one(sp.cat) || 'ALL';
  const expiryParam = (['expired', 'critical', 'soon', 'none'] as const).find((s) => s === one(sp.expiry));
  const status = (STATUSES as readonly string[]).includes(one(sp.status)) ? one(sp.status) : 'ALL';
  const size = [25, 50, 100, -1].includes(Number(one(sp.size))) ? Number(one(sp.size)) : 50;
  const requestedPage = Math.max(1, Math.floor(Number(one(sp.page))) || 1);

  // The server filters, counts and slices, so the browser receives one page (not every product).
  const where: Prisma.ProductWhereInput = {};
  if (cat !== 'ALL') where.categoryId = cat;
  if (status === 'ACTIVE') where.isActive = true;
  else if (status === 'INACTIVE') where.isActive = false;
  else if (status === 'IN_STOCK' || status === 'LOW_STOCK' || status === 'OUT_OF_STOCK') where.stockStatus = status;
  else if (status === 'FEATURED') where.isFeatured = true;
  if (q) {
    where.OR = [
      { nameFa: { contains: q, mode: 'insensitive' } },
      { nameEn: { contains: q, mode: 'insensitive' } },
      { sku: { contains: q, mode: 'insensitive' } },
      { shortDescFa: { contains: q, mode: 'insensitive' } },
      { category: { nameFa: { contains: q, mode: 'insensitive' } } },
    ];
  }

  const cfg = await getExpiryConfig();
  if (expiryParam === 'none') {
    where.tracksExpiry = true;
    where.inventory = { none: { quantity: { gt: 0 }, expiryDate: { not: null } } };
  } else if (expiryParam) {
    where.tracksExpiry = true;
    where.inventory = { some: { AND: [{ quantity: { gt: 0 } }, stateWhere(expiryParam, cfg)] } };
  }

  const filteredTotal = await db.product.count({ where });
  const take = size === -1 ? ALL_PAGE_CAP : size;
  const lastPage = Math.max(1, Math.ceil(filteredTotal / take));
  const page = Math.min(requestedPage, lastPage);

  const [products, categories, total, active, inStock, outOfStock, featured] = await Promise.all([
    db.product.findMany({
      where,
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }, { id: 'asc' }],
      skip: (page - 1) * take,
      take,
      // Only what the table and the edit form show (the full row used to be shipped for every product).
      select: {
        id: true,
        categoryId: true,
        sku: true,
        nameFa: true,
        nameEn: true,
        slugFa: true,
        slugEn: true,
        price: true,
        stockStatus: true,
        shortDescFa: true,
        shortDescEn: true,
        isActive: true,
        isFeatured: true,
        tracksExpiry: true,
        ogImageId: true,
        category: {
          select: { id: true, nameFa: true, nameEn: true, slugFa: true },
        },
        images: {
          orderBy: { sortOrder: 'asc' },
          take: 1,
          select: { id: true, imageId: true, isPrimary: true, sortOrder: true },
        },
      },
    }),
    db.productCategory.findMany({
      orderBy: { sortOrder: 'asc' },
      select: {
        id: true,
        nameFa: true,
        nameEn: true,
        slugFa: true,
        slugEn: true,
        descriptionFa: true,
        descriptionEn: true,
        sortOrder: true,
        imageId: true,
        isActive: true,
        _count: {
          select: { products: true },
        },
      },
    }),
    db.product.count(),
    db.product.count({ where: { isActive: true } }),
    db.product.count({ where: { stockStatus: 'IN_STOCK' } }),
    db.product.count({ where: { stockStatus: 'OUT_OF_STOCK' } }),
    db.product.count({ where: { isFeatured: true } }),
  ]);

  const near = await nearestExpiryByProduct(products.filter((p) => p.tracksExpiry).map((p) => p.id));
  const now = new Date();
  const expiry = Object.fromEntries(
    Object.entries(near).map(([id, n]) => [id, { state: n.state, date: n.date?.toISOString() ?? null, daysLeft: n.date ? daysUntil(n.date, now) : null }])
  );

  return (
    <ProductsManager
      products={products}
      categories={categories}
      filteredTotal={filteredTotal}
      stats={{ total, active, inactive: total - active, inStock, outOfStock, featured }}
      filters={{ q, cat, status, page, size }}
      expiry={expiry}
      canAdmin={hasRoleAccess(session.role, 'ADMIN')}
    />
  );
}
