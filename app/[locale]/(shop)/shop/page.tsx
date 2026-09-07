import { Metadata } from 'next'
import { db } from '@/lib/db'
import { ShopCatalogClient } from '@/components/shop'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await params
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
    openGraph: {
      title,
      description,
      url: `https://www.petbossclinic.com/${locale}/shop`,
      siteName: isEn ? 'Pet Boss Clinic & Pet Shop' : 'کلینیک و پت‌شاپ پت باس',
      images: [
        {
          url: 'https://www.petbossclinic.com/images/petshop.jpg',
          width: 1200,
          height: 630,
          alt: isEn ? 'Pet Boss Luxury Pet Shop' : 'پت‌شاپ لوکس پت باس',
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
  const isEn = locale === 'en'

  const [categories, products] = await Promise.all([
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
        stockStatus: true,
        isActive: true,
        createdAt: true,
        ogImageId: true,
        images: {
          orderBy: { sortOrder: 'asc' },
          select: {
            imageId: true,
            isPrimary: true,
          },
        },
        category: {
          select: {
            id: true,
            nameFa: true,
            nameEn: true,
            slugFa: true,
            imageId: true,
          },
        },
      },
    }),
  ])

  // JSON-LD structured data for E-commerce & Search Engines
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Store',
    name: isEn ? 'Pet Boss Luxury Boutique & Shop' : 'بوتیک و پت‌شاپ لوکس پت باس',
    description: isEn
      ? 'Premier super-premium pet food, prescription veterinary diets, and luxury pet accessories.'
      : 'عرضه تخصصی غذاهای سوپرپرمیوم، مکمل‌های درمانی و ملزومات لوکس سگ و گربه.',
    url: `https://www.petbossclinic.com/${locale}/shop`,
    telephone: '+982126429715',
    address: {
      '@type': 'PostalAddress',
      streetAddress: 'Gheytarieh, Saba Blvd',
      addressLocality: 'Tehran',
      addressCountry: 'IR',
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
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <ShopCatalogClient categories={categories} products={products} />
    </>
  )
}
