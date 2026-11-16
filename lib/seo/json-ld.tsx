/**
 * @file json-ld.tsx
 * @description Centralized JSON-LD structured data components for SEO rich snippets.
 * Outputs <script type="application/ld+json"> tags for Google Search Console.
 */

import type { ClinicNAP } from '@/lib/clinic/nap';
import { SITE_LOGO, SITE_NAME_LONG_FA, SITE_URL, absoluteUrl } from '@/lib/seo/site';

const BASE_URL = SITE_URL;

// ─── Helper ──────────────────────────────────────────────────────────────────

/**
 * JSON for embedding inside <script>. JSON.stringify does not escape "<", so a
 * product name like "</script><script>…" would otherwise break out of the tag.
 */
export function safeJsonLd(data: unknown): string {
  return JSON.stringify(data)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
}

export function JsonLdScript({ data }: { data: Record<string, unknown> | Record<string, unknown>[] }) {
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLd(data) }} />;
}

const postalAddress = (nap: ClinicNAP) => ({
  '@type': 'PostalAddress',
  streetAddress: nap.addressFa,
  addressLocality: 'تهران',
  addressRegion: 'تهران',
  addressCountry: 'IR',
});

const sameAs = (nap: ClinicNAP) =>
  [nap.instagramUrl, nap.telegramUrl, `https://maps.google.com/?q=${nap.geo.lat},${nap.geo.lng}`].filter(
    (v): v is string => !!v
  );

// ─── VeterinaryCare (LocalBusiness) ──────────────────────────────────────────

interface VeterinaryCareSchemaProps {
  nap: ClinicNAP;
  locale: string;
}

export function VeterinaryCareJsonLd({ nap, locale }: VeterinaryCareSchemaProps) {
  const isEn = locale === 'en';

  const data = {
    '@context': 'https://schema.org',
    '@type': 'VeterinaryCare',
    '@id': `${BASE_URL}/#veterinary`,
    name: isEn ? nap.nameEn : nap.nameFa,
    alternateName: isEn ? nap.nameFa : nap.nameEn,
    url: `${BASE_URL}/`,
    telephone: nap.phone,
    email: nap.email,
    priceRange: '$$',
    currenciesAccepted: 'IRR',
    paymentAccepted: isEn ? 'Cash, credit card, online payment' : 'نقدی، کارت بانکی، پرداخت آنلاین',
    image: `${BASE_URL}/images/petboss-sign.jpg`,
    logo: `${BASE_URL}${SITE_LOGO}`,
    description: isEn
      ? 'Premier veterinary surgery, dental clinic, grooming salon & luxury pet boutique in Gheitariyeh, Tehran. Open every day 10AM–10PM.'
      : 'کلینیک تخصصی جراحی، دندانپزشکی، گرومینگ حرفه‌ای و پت شاپ لوکس پت باس در قیطریه تهران. همه روزه ۱۰ صبح الی ۲۲ شب.',
    address: postalAddress(nap),
    geo: {
      '@type': 'GeoCoordinates',
      latitude: nap.geo.lat,
      longitude: nap.geo.lng,
    },
    hasMap: `https://maps.google.com/?q=${nap.geo.lat},${nap.geo.lng}`,
    openingHoursSpecification: [
      {
        '@type': 'OpeningHoursSpecification',
        dayOfWeek: ['Saturday', 'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
        opens: '10:00',
        closes: '22:00',
      },
    ],
    sameAs: sameAs(nap),
    areaServed: {
      '@type': 'GeoCircle',
      geoMidpoint: {
        '@type': 'GeoCoordinates',
        latitude: nap.geo.lat,
        longitude: nap.geo.lng,
      },
      geoRadius: '15000',
    },
    hasOfferCatalog: {
      '@type': 'OfferCatalog',
      name: isEn ? 'Veterinary Services' : 'خدمات دامپزشکی',
      itemListElement: [
        {
          '@type': 'OfferCatalog',
          name: isEn ? 'Clinical & Surgery' : 'درمانی و جراحی',
        },
        {
          '@type': 'OfferCatalog',
          name: isEn ? 'Grooming & Hygiene' : 'گرومینگ و بهداشت',
        },
        {
          '@type': 'OfferCatalog',
          name: isEn ? 'Pet Shop & Boutique' : 'پت شاپ و لوازم',
        },
      ],
    },
  };

  return <JsonLdScript data={data} />;
}

// ─── Organization ────────────────────────────────────────────────────────────

interface OrganizationSchemaProps {
  nap: ClinicNAP;
}

export function OrganizationJsonLd({ nap }: OrganizationSchemaProps) {
  const data = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    '@id': `${BASE_URL}/#organization`,
    name: 'Pet Boss Clinic',
    alternateName: SITE_NAME_LONG_FA,
    url: `${BASE_URL}/`,
    logo: {
      '@type': 'ImageObject',
      url: `${BASE_URL}${SITE_LOGO}`,
      width: 512,
      height: 512,
    },
    image: `${BASE_URL}/images/petboss-sign.jpg`,
    telephone: nap.phone,
    email: nap.email,
    address: postalAddress(nap),
    areaServed: { '@type': 'Country', name: 'IR' },
    contactPoint: {
      '@type': 'ContactPoint',
      telephone: nap.phone,
      email: nap.email,
      contactType: 'customer service',
      availableLanguage: ['fa-IR', 'en'],
      areaServed: 'IR',
    },
    sameAs: sameAs(nap),
  };

  return <JsonLdScript data={data} />;
}

// ─── WebSite (with SearchAction) ─────────────────────────────────────────────

export function WebSiteJsonLd() {
  const data = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    '@id': `${BASE_URL}/#website`,
    name: 'Pet Boss Clinic',
    alternateName: 'کلینیک دامپزشکی و پت شاپ پت باس',
    url: `${BASE_URL}/`,
    inLanguage: 'fa-IR',
    publisher: { '@id': `${BASE_URL}/#organization` },
    potentialAction: {
      '@type': 'SearchAction',
      target: {
        '@type': 'EntryPoint',
        urlTemplate: `${BASE_URL}/shop?q={search_term_string}`,
      },
      'query-input': 'required name=search_term_string',
    },
  };

  return <JsonLdScript data={data} />;
}

// ─── BreadcrumbList ──────────────────────────────────────────────────────────

interface BreadcrumbItem {
  name: string;
  href: string;
}

interface BreadcrumbSchemaProps {
  items: BreadcrumbItem[];
  locale: string;
}

export function BreadcrumbJsonLd({ items, locale }: BreadcrumbSchemaProps) {
  void locale;

  const data = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: absoluteUrl(item.href),
    })),
  };

  return <JsonLdScript data={data} />;
}

// ─── FAQPage ─────────────────────────────────────────────────────────────────

interface FAQItem {
  question: string;
  answer: string;
}

interface FAQPageSchemaProps {
  faqs: FAQItem[];
}

export function FAQPageJsonLd({ faqs }: FAQPageSchemaProps) {
  if (faqs.length === 0) return null;

  const data = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map((faq) => ({
      '@type': 'Question',
      name: faq.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: faq.answer,
      },
    })),
  };

  return <JsonLdScript data={data} />;
}

// ─── Service ─────────────────────────────────────────────────────────────────

interface ServiceItem {
  name: string;
  description: string;
  priceFrom?: number | null;
  priceTo?: number | null;
}

interface ServiceSchemaProps {
  services: ServiceItem[];
  providerName: string;
  locale: string;
}

export function ServiceJsonLd({ services, providerName, locale }: ServiceSchemaProps) {
  const isEn = locale === 'en';

  const data = services.map((svc) => ({
    '@context': 'https://schema.org',
    '@type': 'Service',
    name: svc.name,
    description: svc.description,
    provider: {
      '@type': 'VeterinaryCare',
      name: providerName,
      '@id': `${BASE_URL}/#veterinary`,
    },
    areaServed: {
      '@type': 'City',
      name: isEn ? 'Tehran' : 'تهران',
    },
    ...(svc.priceFrom && {
      offers: {
        '@type': 'AggregateOffer',
        priceCurrency: 'IRR',
        lowPrice: svc.priceFrom * 10, // Toman to Rial
        ...(svc.priceTo && svc.priceTo > svc.priceFrom && { highPrice: svc.priceTo * 10 }),
        offerCount: 1,
        availability: 'https://schema.org/InStock',
      },
    }),
  }));

  return (
    <>
      {data.map((d, i) => (
        <JsonLdScript key={i} data={d} />
      ))}
    </>
  );
}

// ─── Product ─────────────────────────────────────────────────────────────────

const AVAILABILITY: Record<string, string> = {
  IN_STOCK: 'https://schema.org/InStock',
  LOW_STOCK: 'https://schema.org/LimitedAvailability',
  ON_BACKORDER: 'https://schema.org/BackOrder',
  OUT_OF_STOCK: 'https://schema.org/OutOfStock',
};

export interface ProductSchemaInput {
  name: string;
  description: string;
  url: string;
  images: string[];
  sku?: string | null;
  barcode?: string | null;
  brand?: string | null;
  category?: string | null;
  /** Price in Toman. 0 / null means "call for price" (no Offer price is emitted). */
  price?: number | null;
  stockStatus: string;
  /** ISO date until which the price is valid (Google recommends it). */
  priceValidUntil?: string;
  /** Weight in kilograms. */
  weight?: number | null;
  attributes?: Array<{ name: string; value: string }>;
}

export function ProductJsonLd({ product }: { product: ProductSchemaInput }) {
  const hasPrice = !!product.price && product.price > 0;
  const gtin = product.barcode && /^\d{8,14}$/.test(product.barcode) ? product.barcode : undefined;

  const data: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    '@id': `${product.url}#product`,
    name: product.name,
    description: product.description,
    url: product.url,
    image: product.images,
    ...(product.sku && { sku: product.sku, mpn: product.sku }),
    ...(gtin && { gtin }),
    ...(product.brand && { brand: { '@type': 'Brand', name: product.brand } }),
    ...(product.category && { category: product.category }),
    ...(product.weight && product.weight > 0 && {
      weight: { '@type': 'QuantitativeValue', value: product.weight, unitCode: 'KGM' },
    }),
    ...(product.attributes?.length && {
      additionalProperty: product.attributes.map((a) => ({
        '@type': 'PropertyValue',
        name: a.name,
        value: a.value,
      })),
    }),
    offers: {
      '@type': 'Offer',
      url: product.url,
      priceCurrency: 'IRR',
      ...(hasPrice && { price: product.price! * 10 }), // Toman -> Rial
      ...(hasPrice && product.priceValidUntil && { priceValidUntil: product.priceValidUntil }),
      availability: AVAILABILITY[product.stockStatus] ?? AVAILABILITY.OUT_OF_STOCK,
      itemCondition: 'https://schema.org/NewCondition',
      seller: { '@id': `${BASE_URL}/#organization` },
      areaServed: { '@type': 'Country', name: 'IR' },
    },
  };

  return <JsonLdScript data={data} />;
}

// ─── Article (blog posts) ────────────────────────────────────────────────────

export interface ArticleSchemaInput {
  title: string;
  description?: string | null;
  url: string;
  images?: string[];
  publishedAt?: string | null;
  modifiedAt?: string;
  authorName?: string | null;
  section?: string | null;
  keywords?: string | null;
}

export function ArticleJsonLd({ article }: { article: ArticleSchemaInput }) {
  const data = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: article.title,
    description: article.description ?? undefined,
    url: article.url,
    mainEntityOfPage: { '@type': 'WebPage', '@id': article.url },
    inLanguage: 'fa-IR',
    datePublished: article.publishedAt ?? undefined,
    dateModified: article.modifiedAt ?? article.publishedAt ?? undefined,
    ...(article.images?.length && { image: article.images }),
    ...(article.section && { articleSection: article.section }),
    ...(article.keywords && { keywords: article.keywords }),
    author: article.authorName
      ? { '@type': 'Person', name: article.authorName }
      : { '@type': 'Organization', name: 'کلینیک دامپزشکی پت‌باس', url: `${BASE_URL}/` },
    publisher: {
      '@type': 'Organization',
      '@id': `${BASE_URL}/#organization`,
      name: 'کلینیک دامپزشکی پت‌باس',
      logo: {
        '@type': 'ImageObject',
        url: `${BASE_URL}${SITE_LOGO}`,
        width: 512,
        height: 512,
      },
    },
  };

  return <JsonLdScript data={data} />;
}

// ─── ItemList (category / listing pages) ─────────────────────────────────────

export function ItemListJsonLd({ name, urls }: { name: string; urls: string[] }) {
  if (urls.length === 0) return null;
  const data = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name,
    numberOfItems: urls.length,
    itemListElement: urls.map((url, i) => ({ '@type': 'ListItem', position: i + 1, url })),
  };
  return <JsonLdScript data={data} />;
}
