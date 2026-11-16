import type { Metadata, Viewport } from 'next';
import '@/styles/globals.css';
import { AbstractIntlMessages, NextIntlClientProvider } from 'next-intl';
import { getMessages, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { Outfit, Vazirmatn } from 'next/font/google';
import { ThemeProvider } from '@/lib/theme';
import { getActiveClinicTheme } from '@/lib/theme/theme-server';
import { Header } from '@/components/layout/header';
import { Footer } from '@/components/layout/footer';
import { MobileBottomNav } from '@/components/layout/mobile-bottom-nav';
import { CartProvider } from '@/components/shop/cart-provider';
import { HideOnAdmin } from '@/components/layout/hide-on-admin';
import { getNavCatalog } from '@/lib/shop/catalog';
import { getClinicNAP } from '@/lib/clinic/nap';
import { getSitePictures } from '@/lib/media';
import { getNavigationMenu } from '@/lib/navigation/menu';
import { OrganizationJsonLd, WebSiteJsonLd } from '@/lib/seo/json-ld';
import { getSeoConfig, isValidGa4Id } from '@/lib/seo/settings';
import {
  SITE_HOME_DESCRIPTION,
  SITE_HOME_TITLE,
  SITE_NAME_LONG_FA,
  SITE_OG_IMAGE,
  SITE_URL,
} from '@/lib/seo/site';
import Script from 'next/script';

const outfit = Outfit({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-outfit',
});

const vazirmatn = Vazirmatn({
  subsets: ['arabic'],
  display: 'swap',
  variable: '--font-vazirmatn',
});

export function generateStaticParams() {
  return [{ locale: 'fa' }];
}

/**
 * Keep the HTML document language/direction and browser chrome signals in one
 * place. `fa-IR` (not bare `fa`) is the BCP-47 tag Google expects for Persian.
 */
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#c5a059',
  colorScheme: 'dark light',
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  setRequestLocale(locale);
  const isEn = locale === 'en';
  const [nap, seo] = await Promise.all([getClinicNAP(), getSeoConfig()]);

  const title = isEn ? 'Pet Boss Clinic & Pet Shop | Veterinary Clinic in Tehran' : SITE_HOME_TITLE;

  const description = isEn
    ? `Premier veterinary surgery, dental clinic, grooming salon & luxury pet boutique in Gheytariyeh, Tehran. ${nap.addressEn}. ${nap.workingHoursSummaryEn}.`
    : SITE_HOME_DESCRIPTION;

  return {
    metadataBase: new URL(SITE_URL),
    // No layout-level canonical: each page sets its own (or pageMetadata does),
    // so 404s and private pages never inherit the homepage canonical.
    title: {
      default: title,
      // Short brand suffix: page titles are already authored to ~60 characters.
      template: isEn ? '%s | Pet Boss Clinic' : '%s | پت‌باس',
    },
    applicationName: SITE_NAME_LONG_FA,
    description,
    keywords: isEn
      ? ['veterinary clinic Tehran', 'pet shop Gheitariyeh', 'dog cat grooming Tehran', 'pet surgery Tehran', 'vaccination dog cat', 'Pet Boss Clinic']
      : ['کلینیک دامپزشکی تهران', 'دامپزشکی قیطریه', 'دامپزشکی شریعتی', 'پت شاپ قیطریه', 'گرومینگ سگ و گربه تهران', 'واکسیناسیون سگ و گربه', 'جراحی حیوانات خانگی', 'پت باس'],
    authors: [{ name: 'Pet Boss Clinic', url: SITE_URL }],
    creator: 'Pet Boss Clinic',
    publisher: 'Pet Boss Clinic',
    category: 'pets',
    // Iranian phone numbers must not be auto-linked by iOS/Safari.
    formatDetection: { telephone: false, email: false, address: false },
    openGraph: {
      type: 'website',
      locale: 'fa_IR',
      url: `${SITE_URL}/`,
      siteName: SITE_NAME_LONG_FA,
      title,
      description,
      images: [{ url: SITE_OG_IMAGE, width: 1200, height: 630, alt: title }],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [SITE_OG_IMAGE],
    },
    robots: {
      index: true,
      follow: true,
      googleBot: {
        index: true,
        follow: true,
        'max-video-preview': -1,
        'max-image-preview': 'large',
        'max-snippet': -1,
      },
    },
    icons: {
      icon: [
        { url: '/favicon.ico', sizes: 'any' },
        { url: '/icon.png', type: 'image/png', sizes: '512x512' },
      ],
      apple: [{ url: '/apple-icon.png', sizes: '180x180', type: 'image/png' }],
      shortcut: '/favicon.ico',
    },
    verification: {
      ...(seo.gscVerification && { google: seo.gscVerification }),
      ...(seo.bingVerification && { other: { 'msvalidate.01': seo.bingVerification } }),
    },
  };
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  let messages: AbstractIntlMessages = {};
  try {
    messages = await getMessages();
  } catch {
    notFound();
  }

  const initialTheme = await getActiveClinicTheme();

  const fontClass = locale === 'fa' ? vazirmatn.className : outfit.className;
  const [seo, nap, sitePictures, navItems, navCatalog] = await Promise.all([
    getSeoConfig(),
    getClinicNAP(),
    getSitePictures(),
    getNavigationMenu('main-header'),
    getNavCatalog(),
  ]);

  return (
    <html lang={locale === 'fa' ? 'fa-IR' : locale} dir={locale === 'fa' ? 'rtl' : 'ltr'} data-theme={initialTheme} suppressHydrationWarning>
      <head>
        <OrganizationJsonLd nap={nap} />
        <WebSiteJsonLd />
      </head>
      <body
        className={`${fontClass} antialiased bg-background text-foreground min-h-screen flex flex-col selection:bg-primary selection:text-primary-foreground`}
      >
        {seo.ga4Id && isValidGa4Id(seo.ga4Id) && (
          <>
            <Script src={`https://www.googletagmanager.com/gtag/js?id=${seo.ga4Id}`} strategy="afterInteractive" />
            <Script id="ga4-init" strategy="afterInteractive">
              {`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${seo.ga4Id}');`}
            </Script>
          </>
        )}
        <ThemeProvider initialTheme={initialTheme}>
          <NextIntlClientProvider messages={messages}>
            <CartProvider>
            <Header
              logoUrl={sitePictures.site_logo}
              navItems={navItems}
              phone={nap.phone}
              categories={navCatalog.categories}
            />
            <main className="flex-grow">{children}</main>
            <HideOnAdmin>
              <Footer
                nap={nap}
                logoUrl={sitePictures.site_logo}
                navItems={navItems}
                categories={navCatalog.categories}
                brands={navCatalog.brands}
                enamad={seo.enamad}
              />
            </HideOnAdmin>
            <MobileBottomNav phone={nap.phone} />
            </CartProvider>
          </NextIntlClientProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
