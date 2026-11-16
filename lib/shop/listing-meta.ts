import type { Metadata } from 'next';
import { pageMetadata } from '@/lib/seo/metadata';
import { isFilteredView, type ShopFilters } from '@/lib/shop/filters';

/**
 * Metadata for paginated/filterable listings. The plain listing and its numbered
 * pages are indexable with self-canonicals; search and filter variants are
 * noindex,follow so Google does not crawl thousands of near-duplicate URLs.
 */
export function listingMetadata(opts: {
  basePath: string;
  filters: ShopFilters;
  title: string;
  description: string;
  image?: string | null;
  canonicalOverride?: string | null;
  noindex?: boolean;
}): Metadata {
  const { filters } = opts;
  const pageSuffix = filters.page > 1 ? ` - صفحه ${filters.page.toLocaleString('fa-IR')}` : '';
  const path = filters.page > 1 ? `${opts.basePath}?page=${filters.page}` : opts.basePath;
  const filtered = isFilteredView(filters);
  const title = filters.q ? `نتایج جستجوی «${filters.q}»` : `${opts.title}${pageSuffix}`;

  return pageMetadata({
    title,
    description: opts.description,
    path,
    image: opts.image,
    // A custom canonical only applies to the clean, unfiltered first page.
    canonical: !filtered && filters.page === 1 ? opts.canonicalOverride : undefined,
    noindex: filtered || opts.noindex,
    follow: true,
  });
}
