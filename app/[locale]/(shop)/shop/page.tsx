import type { Metadata } from 'next';
import Image from 'next/image';
import { notFound } from 'next/navigation';
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
  'خرید آنلاین غذای خشک و تر، تشویقی، دارو و مکمل، خاک گربه و لوازم سگ و گربه با ضمانت اصالت و تاریخ انقضای معتبر از پت‌شاپ پت‌باس تهران.';

export async function generateMetadata({ params, searchParams }: { params: Params; searchParams: Search }): Promise<Metadata> {
  const { locale } = await params;
  setRequestLocale(locale);
  return listingMetadata({
    basePath: '/shop',
    filters: parseShopFilters(await searchParams),
    title: 'پت‌شاپ آنلاین پت‌باس | خرید غذای سگ و گربه در تهران',
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
  // Out-of-range pages (e.g. ?page=999) are a 404, same as category and brand listings.
  if (filters.page > 1 && filters.page > listing.pageCount) notFound();
  const visibleCategories = categories.filter((c) => c._count.products > 0);

  const storeJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'PetStore',
    '@id': absoluteUrl('/shop#store'),
    name: 'پت‌شاپ کلینیک دامپزشکی پت‌باس',
    url: absoluteUrl('/shop'),
    telephone: nap.phone,
    email: nap.email,
    image: absoluteUrl('/images/petboss-sign.jpg'),
    priceRange: '$$',
    currenciesAccepted: 'IRR',
    paymentAccepted: 'نقدی، کارت بانکی، پرداخت آنلاین',
    openingHours: 'Mo-Su 10:00-22:00',
    address: {
      '@type': 'PostalAddress',
      streetAddress: nap.addressFa,
      addressLocality: 'تهران',
      addressRegion: 'تهران',
      addressCountry: 'IR',
    },
    geo: { '@type': 'GeoCoordinates', latitude: nap.geo.lat, longitude: nap.geo.lng },
    hasMap: `https://maps.google.com/?q=${nap.geo.lat},${nap.geo.lng}`,
    sameAs: [nap.instagramUrl, nap.telegramUrl].filter(Boolean),
    parentOrganization: { '@id': absoluteUrl('/#organization') },
  };

  const showCategoryStrip = !isFilteredView(filters) && filters.page === 1;

  return (
    <>
      <JsonLdScript data={storeJsonLd} />

      {showCategoryStrip && (
        <section aria-label="دسته‌بندی‌های پت‌شاپ" className="border-b border-border bg-surface">
          <div className="container mx-auto max-w-7xl px-4 py-4 sm:py-6">
            <ul className="rail rail-bleed gap-2 pb-1 sm:gap-3">
              {visibleCategories.map((c) => (
                <li key={c.id}>
                  <Link
                    href={categoryPath(c.slugFa)}
                    className="group flex w-[5.5rem] flex-col items-center gap-2 rounded-2xl p-1 text-center sm:w-28"
                  >
                    <span className="relative h-[4.5rem] w-[4.5rem] overflow-hidden rounded-2xl border border-border transition-colors group-hover:border-primary sm:h-24 sm:w-24">
                      <Image
                        src={c.imageId && !c.imageId.startsWith('data:') ? c.imageId : '/images/categories/other.jpg'}
                        alt=""
                        fill
                        sizes="96px"
                        className="object-cover transition-transform duration-500 group-hover:scale-105"
                      />
                    </span>
                    <span className="line-clamp-2 text-xs font-semibold leading-5 transition-colors group-hover:text-primary">
                      {c.nameFa}
                    </span>
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
        showCategoryChips={!showCategoryStrip}
        filters={filters}
        {...listing}
        categories={visibleCategories.map((c) => ({ ...c, count: c._count.products }))}
        brands={brands.map((b) => ({ ...b, count: b._count.products }))}
      />
    </>
  );
}
