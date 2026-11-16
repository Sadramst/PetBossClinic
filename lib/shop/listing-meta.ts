import type { Metadata } from 'next';
import { absoluteUrl } from '@/lib/seo/site';
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
  const url = absoluteUrl(filters.page > 1 ? `${opts.basePath}?page=${filters.page}` : opts.basePath);
  const filtered = isFilteredView(filters);
  const title = filters.q ? `نتایج جستجوی «${filters.q}»` : `${opts.title}${pageSuffix}`;

  return {
    title: { absolute: `${title} | پت‌شاپ پت‌باس` },
    description: opts.description,
    alternates: { canonical: !filtered && filters.page === 1 && opts.canonicalOverride ? opts.canonicalOverride : url },
    robots: filtered || opts.noindex ? { index: false, follow: true } : undefined,
    openGraph: {
      type: 'website',
      locale: 'fa_IR',
      url,
      title,
      description: opts.description,
      ...(opts.image && !opts.image.startsWith('data:') && { images: [{ url: absoluteUrl(opts.image) }] }),
    },
  };
}
