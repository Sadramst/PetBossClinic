import 'server-only';
import { db } from '@/lib/db';
import { absoluteUrl } from '@/lib/seo/site';
import { productPath } from '@/lib/shop/urls';
import { productImage, visibleProduct } from '@/lib/shop/catalog';

/**
 * Product data for price-comparison sites (Torob, Emalls) and Google-style feeds.
 * Prices are in Toman; out-of-stock and "call for price" items are reported as
 * unavailable rather than hidden, so the listing stays stable.
 */
export const FEED_PAGE_SIZE = 100;

const feedSelect = {
  id: true,
  slugFa: true,
  nameFa: true,
  nameEn: true,
  shortDescFa: true,
  price: true,
  comparePrice: true,
  stockStatus: true,
  createdAt: true,
  updatedAt: true,
  barcode: true,
  sku: true,
  images: { orderBy: { sortOrder: 'asc' as const }, select: { imageId: true } },
  category: { select: { nameFa: true, imageId: true } },
  brand: { select: { nameFa: true, nameEn: true } },
};

export type FeedSort = 'date_added_desc' | 'date_updated_desc';

export async function feedProducts(opts: { page?: number; slugs?: string[]; ids?: string[]; sort?: FeedSort }) {
  const where = {
    ...visibleProduct,
    ...(opts.slugs && { slugFa: { in: opts.slugs } }),
    ...(opts.ids && { id: { in: opts.ids } }),
  };
  const specific = !!(opts.slugs || opts.ids);
  const page = Math.max(1, opts.page ?? 1);
  const [total, rows] = await Promise.all([
    db.product.count({ where }),
    db.product.findMany({
      where,
      select: feedSelect,
      orderBy: opts.sort === 'date_updated_desc' ? { updatedAt: 'desc' } : { createdAt: 'desc' },
      ...(specific ? {} : { skip: (page - 1) * FEED_PAGE_SIZE, take: FEED_PAGE_SIZE }),
    }),
  ]);
  return { total, page, maxPages: Math.max(1, Math.ceil(total / FEED_PAGE_SIZE)), rows };
}

type FeedRow = Awaited<ReturnType<typeof feedProducts>>['rows'][number];

export function isAvailable(p: FeedRow): boolean {
  return (p.stockStatus === 'IN_STOCK' || p.stockStatus === 'LOW_STOCK') && p.price > 0;
}

export function feedImages(p: FeedRow): string[] {
  const imgs = p.images.map((i) => i.imageId).filter((s) => !s.startsWith('data:'));
  return (imgs.length ? imgs : [productImage(p)]).map((s) => absoluteUrl(s));
}

/** Torob shop API v3 product object. */
export function toTorob(p: FeedRow) {
  const available = isAvailable(p);
  return {
    page_unique: p.id,
    page_url: absoluteUrl(productPath(p.slugFa)),
    product_group_id: p.id,
    title: p.nameFa,
    subtitle: p.nameEn ?? '',
    current_price: available ? p.price : 0,
    old_price: available && p.comparePrice && p.comparePrice > p.price ? p.comparePrice : 0,
    availability: available ? 'instock' : 'outofstock',
    category_name: p.category.nameFa,
    image_links: feedImages(p),
    image_link: feedImages(p)[0],
    short_desc: p.shortDescFa ?? '',
    spec: {
      ...(p.brand && { برند: p.brand.nameFa }),
      ...(p.sku && { 'کد کالا': p.sku }),
    },
    date_added: p.createdAt.toISOString(),
    date_updated: p.updatedAt.toISOString(),
  };
}

const xml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');

/** Google Merchant style RSS 2.0 item (also accepted by many Iranian comparison sites). */
export function toGoogleItem(p: FeedRow): string {
  // Google requires a positive price. "Call for price" items are skipped rather
  // than published as `0 IRR`, which would invalidate the whole feed item.
  if (!(p.price > 0)) return '';

  const imgs = feedImages(p);
  const available = isAvailable(p);
  const gtin = p.barcode && /^\d{8,14}$/.test(p.barcode) ? p.barcode : null;
  const onSale = !!p.comparePrice && p.comparePrice > p.price;
  const listPrice = onSale ? p.comparePrice! : p.price;
  const lines = [
    `<g:id>${xml(p.id)}</g:id>`,
    `<title>${xml(p.nameFa)}</title>`,
    `<description>${xml(p.shortDescFa || p.nameFa)}</description>`,
    `<link>${xml(absoluteUrl(productPath(p.slugFa)))}</link>`,
    `<g:image_link>${xml(imgs[0])}</g:image_link>`,
    ...imgs.slice(1, 10).map((i) => `<g:additional_image_link>${xml(i)}</g:additional_image_link>`),
    `<g:availability>${available ? 'in_stock' : 'out_of_stock'}</g:availability>`,
    // Google expects ISO 4217 amounts: Toman x 10 = IRR
    `<g:price>${listPrice * 10} IRR</g:price>`,
    ...(onSale ? [`<g:sale_price>${p.price * 10} IRR</g:sale_price>`] : []),
    `<g:condition>new</g:condition>`,
    `<g:product_type>${xml(p.category.nameFa)}</g:product_type>`,
    p.brand ? `<g:brand>${xml(p.brand.nameEn || p.brand.nameFa)}</g:brand>` : '',
    gtin ? `<g:gtin>${gtin}</g:gtin>` : '<g:identifier_exists>no</g:identifier_exists>',
    p.sku ? `<g:mpn>${xml(p.sku)}</g:mpn>` : '',
  ].filter(Boolean);
  return `<item>${lines.join('')}</item>`;
}
