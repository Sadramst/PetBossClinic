/**
 * @file json-ld.tsx
 * @description Centralized JSON-LD structured data components for SEO rich snippets.
 * Outputs <script type="application/ld+json"> tags for Google Search Console.
 */

import type { ClinicNAP } from '@/lib/clinic/nap';

const BASE_URL = 'https://www.petbossclinic.com';

// ─── Helper ──────────────────────────────────────────────────────────────────

function JsonLdScript({ data }: { data: Record<string, unknown> }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}

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
    url: BASE_URL,
    telephone: nap.phone,
    email: nap.email,
    priceRange: '$$',
    image: `${BASE_URL}/images/petboss-sign.jpg`,
    logo: `${BASE_URL}/images/logo.png`,
    description: isEn
      ? 'Premier veterinary surgery, dental clinic, grooming salon & luxury pet boutique in Gheitariyeh, Tehran. Open every day 10AM–10PM.'
      : 'کلینیک تخصصی جراحی، دندانپزشکی، گرومینگ حرفه‌ای و پت شاپ لوکس پت باس در قیطریه تهران. همه روزه ۱۰ صبح الی ۲۲ شب.',
    address: {
      '@type': 'PostalAddress',
      streetAddress: isEn ? nap.addressEn : nap.addressFa,
      addressLocality: isEn ? 'Tehran' : 'تهران',
      addressRegion: isEn ? 'Tehran' : 'تهران',
      addressCountry: 'IR',
      postalCode: '',
    },
    geo: {
      '@type': 'GeoCoordinates',
      latitude: nap.geo.lat,
      longitude: nap.geo.lng,
    },
    openingHoursSpecification: [
      {
        '@type': 'OpeningHoursSpecification',
        dayOfWeek: ['Saturday', 'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
        opens: '10:00',
        closes: '22:00',
      },
    ],
    sameAs: [
      nap.instagramUrl,
      nap.telegramUrl,
    ].filter(Boolean),
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
    alternateName: 'کلینیک دامپزشکی پت باس',
    url: BASE_URL,
    logo: {
      '@type': 'ImageObject',
      url: `${BASE_URL}/images/logo.png`,
      width: 512,
      height: 512,
    },
    contactPoint: {
      '@type': 'ContactPoint',
      telephone: nap.phone,
      contactType: 'customer service',
      availableLanguage: ['Persian', 'English'],
      areaServed: 'IR',
    },
    sameAs: [
      nap.instagramUrl,
      nap.telegramUrl,
    ].filter(Boolean),
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
    url: BASE_URL,
    inLanguage: ['fa-IR', 'en'],
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
  const prefix = locale === 'en' ? '/en' : '';

  const data = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: `${BASE_URL}${prefix}${item.href === '/' ? (prefix ? '' : '/') : item.href}`,
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
        '@type': 'Offer',
        priceCurrency: 'IRR',
        price: svc.priceFrom * 10, // Toman to Rial
        ...(svc.priceTo && { highPrice: svc.priceTo * 10 }),
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
