import { Metadata } from 'next'
import { db } from '@/lib/db'
import { ShopCatalogClient } from '@/components/shop'
import { BreadcrumbJsonLd } from '@/lib/seo/json-ld'
import { getClinicNAP } from '@/lib/clinic/nap'
import { setRequestLocale } from 'next-intl/server'

export const revalidate = 60;

export function generateStaticParams() {
  return [{ locale: 'fa' }, { locale: 'en' }];
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await params
  setRequestLocale(locale)
  const isEn = locale === 'en'

  const title = isEn
    ? 'Pet Shop & Luxury Boutique | Pet Boss Veterinary Clinic'
    : 'پت‌شاپ و بوتیک لوکس حیوانات خانگی | کلینیک دامپزشکی پت باس قیطریه'

  const description = isEn
    ? 'Exclusive collection of super-premium dry food, veterinary prescription diets, grooming essentials, and luxury accessories with clinic veterinarian guidance in Tehran.'
    : 'مجموعه انحصاری غذای خشک سوپرپرمیوم، غذاهای رژیمی و درمانی دامپزشکی، خمیرهای مالت، خاک گربه و اکسسوری‌های لوکس با تایید و نظارت دامپزشک در قیطریه تهران.'

  return {
    title,
    description,
    keywords: isEn
      ? ['pet shop Tehran', 'veterinary boutique Gheytariyeh', 'Royal Canin Tehran', 'Josera cat food', 'cat litter Tehran']
      : ['پت شاپ تهران', 'پت شاپ قیطریه', 'پت شاپ شریعتی', 'خرید غذای خشک سگ تهران', 'غذای گربه رویال کنین', 'خاک گربه قیطریه', 'لوازم حیوانات خانگی'],
    alternates: {
      canonical: isEn ? 'https://www.petbossclinic.com/en/shop' : 'https://www.petbossclinic.com/shop',
      languages: {
        'fa-IR': 'https://www.petbossclinic.com/shop',
        en: 'https://www.petbossclinic.com/en/shop',
      },
    },
    openGraph: {
      title,
      description,
      url: isEn ? 'https://www.petbossclinic.com/en/shop' : 'https://www.petbossclinic.com/shop',
      images: [
        {
          url: '/images/categories/cat-dry-food.jpg',
          width: 1200,
          height: 630,
          alt: title,
        },
      ],
      locale: isEn ? 'en_US' : 'fa_IR',
      type: 'website',
    },
  }
}

export default async function ShopPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  setRequestLocale(locale)
  const isEn = locale === 'en'

  const [categories, products, nap] = await Promise.all([
    db.productCategory.findMany({
      where: { isActive: true },
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
        _count: {
          select: {
            products: true,
          },
        },
      },
    }),
    db.product.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
      select: {
        id: true,
        categoryId: true,
        sku: true,
        nameFa: true,
        nameEn: true,
        shortDescFa: true,
        shortDescEn: true,
        price: true,
        comparePrice: true,
        stockStatus: true,
        isActive: true,
        createdAt: true,
        category: {
          select: {
            id: true,
            nameFa: true,
            nameEn: true,
            slugFa: true,
            imageId: true,
          },
        },
        images: {
          orderBy: { sortOrder: 'asc' },
          select: {
            imageId: true,
          },
        },
      },
    }),
    getClinicNAP(),
  ])

  // JSON-LD structured data for E-commerce & Search Engines
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Store',
    name: isEn ? (nap.nameEn || 'Pet Boss Luxury Boutique & Shop') : (nap.nameFa || 'بوتیک و پت‌شاپ لوکس پت باس'),
    description: isEn
      ? 'Premier super-premium pet food, prescription veterinary diets, and luxury pet accessories.'
      : 'عرضه تخصصی غذاهای سوپرپرمیوم، مکمل‌های درمانی و ملزومات لوکس سگ و گربه.',
    url: `https://www.petbossclinic.com/${locale}/shop`,
    telephone: nap.phone,
    address: {
      '@type': 'PostalAddress',
      streetAddress: isEn ? nap.addressEn : nap.addressFa,
      addressLocality: 'Tehran',
      addressCountry: 'IR',
    },
    geo: {
      '@type': 'GeoCoordinates',
      latitude: nap.geo.lat,
      longitude: nap.geo.lng,
    },
    hasOfferCatalog: {
      '@type': 'OfferCatalog',
      name: isEn ? 'Pet Boss Product Catalog' : 'کاتالوگ محصولات پت باس',
      itemListElement: categories.map((cat, idx) => ({
        '@type': 'OfferCatalog',
        name: isEn ? (cat.nameEn || cat.nameFa) : cat.nameFa,
        position: idx + 1,
      })),
    },
  }

  return (
    <>
      <BreadcrumbJsonLd
        items={[
          { name: isEn ? 'Home' : 'خانه', href: '/' },
          { name: isEn ? 'Pet Shop' : 'پت‌شاپ', href: '/shop' },
        ]}
        locale={locale}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <ShopCatalogClient
        categories={categories}
        products={products}
        whatsappNumber={nap.whatsappNumber}
        phone={nap.phone}
      />
    </>
  )
}
