import type { Metadata } from 'next';
import Image from 'next/image';
import { setRequestLocale } from 'next-intl/server';
import { Link } from '@/i18n/routing';
import { ProductListing } from '@/components/shop/product-listing';
import { getClinicNAP } from '@/lib/clinic/nap';
import { JsonLdScript } from '@/lib/seo/json-ld';
import { absoluteUrl } from '@/lib/seo/site';
import { getActiveBrands, getActiveCategories, getListing } from '@/lib/shop/catalog';
import { isFilteredView, parseShopFilters } from '@/lib/shop/filters';
import { listingMetadata } from '@/lib/shop/listing-meta';
import { categoryPath } from '@/lib/shop/urls';

type Params = Promise<{ locale: string }>;
type Search = Promise<Record<string, string | string[] | undefined>>;

const DESCRIPTION =
  'خرید آنلاین غذای خشک و تر سگ و گربه، تشویقی، دارو و مکمل، خاک گربه، قلاده و اسباب‌بازی از پت‌شاپ کلینیک دامپزشکی پت‌باس تهران؛ اصالت کالا، تاریخ انقضای معتبر و مشاوره رایگان دامپزشک.';

export async function generateMetadata({ params, searchParams }: { params: Params; searchParams: Search }): Promise<Metadata> {
  const { locale } = await params;
  setRequestLocale(locale);
  return listingMetadata({
    basePath: '/shop',
    filters: parseShopFilters(await searchParams),
    title: 'پت‌شاپ آنلاین | خرید غذا و لوازم سگ و گربه در تهران',
    description: DESCRIPTION,
    image: '/images/categories/cat-dry-food.jpg',
  });
}

export default async function ShopPage({ params, searchParams }: { params: Params; searchParams: Search }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const filters = parseShopFilters(await searchParams);

  const [listing, categories, brands, nap] = await Promise.all([
    getListing(filters),
    getActiveCategories(),
    getActiveBrands(),
    getClinicNAP(),
  ]);
  const visibleCategories = categories.filter((c) => c._count.products > 0);

  const storeJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'PetStore',
    '@id': absoluteUrl('/shop#store'),
    name: 'پت‌شاپ کلینیک دامپزشکی پت‌باس',
    url: absoluteUrl('/shop'),
    telephone: nap.phone,
    image: absoluteUrl('/images/petboss-sign.jpg'),
    priceRange: '$$',
    address: {
      '@type': 'PostalAddress',
      streetAddress: nap.addressFa,
      addressLocality: 'تهران',
      addressCountry: 'IR',
    },
    geo: { '@type': 'GeoCoordinates', latitude: nap.geo.lat, longitude: nap.geo.lng },
    parentOrganization: { '@id': absoluteUrl('/#organization') },
  };

  const showCategoryStrip = !isFilteredView(filters) && filters.page === 1;

  return (
    <>
      <JsonLdScript data={storeJsonLd} />

      {showCategoryStrip && (
        <section aria-label="دسته‌بندی‌های پت‌شاپ" className="border-b border-border bg-surface">
          <div className="container mx-auto px-4 py-6 max-w-7xl">
            <ul className="flex gap-3 overflow-x-auto pb-2 snap-x">
              {visibleCategories.map((c) => (
                <li key={c.id} className="snap-start shrink-0">
                  <Link href={categoryPath(c.slugFa)} className="group flex flex-col items-center gap-2 w-24 text-center">
                    <span className="relative w-20 h-20 rounded-2xl overflow-hidden border border-border group-hover:border-primary transition-colors">
                      <Image
                        src={c.imageId && !c.imageId.startsWith('data:') ? c.imageId : '/images/categories/other.jpg'}
                        alt={c.nameFa}
                        fill
                        sizes="80px"
                        className="object-cover"
                      />
                    </span>
                    <span className="text-xs leading-5 group-hover:text-primary">{c.nameFa}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

      <ProductListing
        title={filters.q ? `نتایج جستجو برای «${filters.q}»` : 'پت‌شاپ آنلاین پت‌باس'}
        intro="غذا، تشویقی، دارو و لوازم سگ و گربه با ضمانت اصالت و تاریخ انقضای معتبر؛ انتخاب‌شده و نگهداری‌شده زیر نظر دامپزشکان کلینیک."
        breadcrumbs={[
          { name: 'خانه', href: '/' },
          { name: 'پت‌شاپ', href: '/shop' },
        ]}
        basePath="/shop"
        filters={filters}
        {...listing}
        categories={visibleCategories.map((c) => ({ ...c, count: c._count.products }))}
        brands={brands.map((b) => ({ ...b, count: b._count.products }))}
      />
    </>
  );
}
