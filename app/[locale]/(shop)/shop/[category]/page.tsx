import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { setRequestLocale } from 'next-intl/server';
import { ProductListing } from '@/components/shop/product-listing';
import { getActiveBrands, getActiveCategories, getCategoryBySlug, getListing } from '@/lib/shop/catalog';
import { parseShopFilters } from '@/lib/shop/filters';
import { listingMetadata } from '@/lib/shop/listing-meta';
import { categoryPath, decodeSlug } from '@/lib/shop/urls';

type Params = Promise<{ locale: string; category: string }>;
type Search = Promise<Record<string, string | string[] | undefined>>;

export async function generateMetadata({ params, searchParams }: { params: Params; searchParams: Search }): Promise<Metadata> {
  const { locale, category: rawSlug } = await params;
  setRequestLocale(locale);
  const category = await getCategoryBySlug(decodeSlug(rawSlug));
  if (!category) return { title: 'دسته‌بندی یافت نشد', robots: { index: false } };

  return listingMetadata({
    basePath: categoryPath(category.slugFa),
    filters: parseShopFilters(await searchParams),
    title: category.metaTitleFa || `خرید ${category.nameFa} | قیمت و بهترین برندها`,
    description:
      category.metaDescriptionFa ||
      `خرید ${category.nameFa} اصل با تاریخ انقضای معتبر از پت‌شاپ کلینیک دامپزشکی پت‌باس تهران. ${category.descriptionFa ?? ''} مقایسه قیمت، موجودی و مشاوره رایگان دامپزشک.`.trim(),
    image: category.imageId,
    canonicalOverride: category.canonicalUrl,
    noindex: category.noindex,
  });
}

export default async function CategoryPage({ params, searchParams }: { params: Params; searchParams: Search }) {
  const { locale, category: rawSlug } = await params;
  setRequestLocale(locale);
  const filters = parseShopFilters(await searchParams);

  const category = await getCategoryBySlug(decodeSlug(rawSlug));
  if (!category) notFound();

  const [listing, categories, brands] = await Promise.all([
    getListing(filters, { categoryId: category.id }),
    getActiveCategories(),
    getActiveBrands(),
  ]);
  if (filters.page > listing.pageCount) notFound();

  const speciesSpecific = /^(cat|dog)-/.test(category.slugFa);

  return (
    <ProductListing
      title={`خرید ${category.nameFa}`}
      intro={category.descriptionFa}
      breadcrumbs={[
        { name: 'خانه', href: '/' },
        { name: 'پت‌شاپ', href: '/shop' },
        { name: category.nameFa, href: categoryPath(category.slugFa) },
      ]}
      basePath={categoryPath(category.slugFa)}
      filters={filters}
      {...listing}
      categories={categories.filter((c) => c._count.products > 0).map((c) => ({ ...c, count: c._count.products }))}
      brands={brands.map((b) => ({ ...b, count: b._count.products }))}
      activeCategoryId={category.id}
      showPetFilter={!speciesSpecific}
    />
  );
}
