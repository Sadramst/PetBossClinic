import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { setRequestLocale } from 'next-intl/server';
import { ProductListing } from '@/components/shop/product-listing';
import { getActiveBrands, getActiveCategories, getBrandBySlug, getListing } from '@/lib/shop/catalog';
import { parseShopFilters } from '@/lib/shop/filters';
import { listingMetadata } from '@/lib/shop/listing-meta';
import { brandPath, decodeSlug } from '@/lib/shop/urls';
import { brandSeoTitle } from '@/lib/seo/metadata';

type Params = Promise<{ locale: string; slug: string }>;
type Search = Promise<Record<string, string | string[] | undefined>>;

function brandTitle(b: { nameFa: string; nameEn: string | null }) {
  return b.nameEn ? `${b.nameFa} (${b.nameEn})` : b.nameFa;
}

export async function generateMetadata({ params, searchParams }: { params: Params; searchParams: Search }): Promise<Metadata> {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  const brand = await getBrandBySlug(decodeSlug(slug));
  if (!brand) return { title: 'برند یافت نشد', robots: { index: false } };

  const description =
    brand.descriptionFa ||
    `خرید محصولات اصل ${brandTitle(brand)} برای سگ و گربه از پت‌شاپ کلینیک دامپزشکی پت‌باس تهران؛ ضمانت اصالت، تاریخ انقضای معتبر و مشاوره رایگان دامپزشک.`;

  return listingMetadata({
    basePath: brandPath(brand.slugFa),
    filters: parseShopFilters(await searchParams),
    title: brandSeoTitle(brandTitle(brand)),
    description,
    image: brand.logoId,
  });
}

export default async function BrandPage({ params, searchParams }: { params: Params; searchParams: Search }) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  const filters = parseShopFilters(await searchParams);

  const brand = await getBrandBySlug(decodeSlug(slug));
  if (!brand) notFound();

  const [listing, categories, brands] = await Promise.all([
    getListing(filters, { brandId: brand.id }),
    getActiveCategories(),
    getActiveBrands(),
  ]);
  if (filters.page > listing.pageCount) notFound();

  return (
    <ProductListing
      title={`محصولات ${brandTitle(brand)}`}
      intro={brand.descriptionFa}
      breadcrumbs={[
        { name: 'خانه', href: '/' },
        { name: 'پت‌شاپ', href: '/shop' },
        { name: brand.nameFa, href: brandPath(brand.slugFa) },
      ]}
      basePath={brandPath(brand.slugFa)}
      filters={filters}
      {...listing}
      categories={categories.filter((c) => c._count.products > 0).map((c) => ({ ...c, count: c._count.products }))}
      brands={brands.map((b) => ({ ...b, count: b._count.products }))}
      activeBrandId={brand.id}
    />
  );
}
