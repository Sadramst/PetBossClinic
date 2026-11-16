import { MetadataRoute } from 'next';
import { db } from '@/lib/db';
import { absoluteUrl } from '@/lib/seo/site';
import { brandPath, categoryPath, productPath } from '@/lib/shop/urls';
import { visibleProduct } from '@/lib/shop/catalog';
import { postPath, publishedWhere } from '@/lib/blog/posts';

export const revalidate = 3600;

const STATIC_PAGES: Array<{ path: string; priority: number; changeFrequency: 'daily' | 'weekly' | 'monthly' }> = [
  { path: '/', priority: 1.0, changeFrequency: 'weekly' },
  { path: '/shop', priority: 0.95, changeFrequency: 'daily' },
  { path: '/services', priority: 0.9, changeFrequency: 'weekly' },
  { path: '/contact', priority: 0.8, changeFrequency: 'monthly' },
  { path: '/about', priority: 0.7, changeFrequency: 'monthly' },
  { path: '/faq', priority: 0.7, changeFrequency: 'weekly' },
  { path: '/blog', priority: 0.8, changeFrequency: 'weekly' },
];

function imageUrl(src: string | null | undefined): string[] {
  if (!src || src.startsWith('data:')) return [];
  return [absoluteUrl(src)];
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const entries: MetadataRoute.Sitemap = STATIC_PAGES.map((p) => ({
    url: absoluteUrl(p.path),
    changeFrequency: p.changeFrequency,
    priority: p.priority,
    ...(p.path === '/' && { images: [absoluteUrl('/images/petboss-sign.jpg')] }),
  }));

  try {
    const [categories, brands, products, posts] = await Promise.all([
      db.productCategory.findMany({
        where: { isActive: true, deletedAt: null, noindex: false, products: { some: visibleProduct } },
        select: { slugFa: true, updatedAt: true, imageId: true },
        orderBy: { sortOrder: 'asc' },
      }),
      db.brand.findMany({
        where: { isActive: true, deletedAt: null, products: { some: visibleProduct } },
        select: { slugFa: true, updatedAt: true, logoId: true },
        orderBy: { sortOrder: 'asc' },
      }),
      db.product.findMany({
        where: { ...visibleProduct, noindex: false },
        select: {
          slugFa: true,
          updatedAt: true,
          images: { orderBy: { sortOrder: 'asc' }, take: 1, select: { imageId: true } },
        },
        orderBy: { sortOrder: 'asc' },
      }),
      db.post.findMany({
        where: { ...publishedWhere(), noindex: false },
        select: { slugFa: true, updatedAt: true, imageId: true },
        orderBy: { publishedAt: 'desc' },
      }),
    ]);

    for (const p of posts) {
      entries.push({
        url: absoluteUrl(postPath(p.slugFa)),
        lastModified: p.updatedAt,
        changeFrequency: 'monthly',
        priority: 0.7,
        images: imageUrl(p.imageId),
      });
    }

    for (const c of categories) {
      entries.push({
        url: absoluteUrl(categoryPath(c.slugFa)),
        lastModified: c.updatedAt,
        changeFrequency: 'daily',
        priority: 0.85,
        images: imageUrl(c.imageId),
      });
    }
    for (const b of brands) {
      entries.push({
        url: absoluteUrl(brandPath(b.slugFa)),
        lastModified: b.updatedAt,
        changeFrequency: 'weekly',
        priority: 0.75,
        images: imageUrl(b.logoId),
      });
    }
    for (const p of products) {
      entries.push({
        url: absoluteUrl(productPath(p.slugFa)),
        lastModified: p.updatedAt,
        changeFrequency: 'weekly',
        priority: 0.7,
        images: imageUrl(p.images[0]?.imageId),
      });
    }
  } catch (err) {
    // Never fail the whole sitemap because the DB is briefly unreachable.
    console.error('sitemap: catalog query failed', err);
  }

  return entries;
}
