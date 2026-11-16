import type { Metadata } from 'next';
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

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  setRequestLocale(locale);
  const isEn = locale === 'en';
  const [nap, seo] = await Promise.all([getClinicNAP(), getSeoConfig()]);

  const title = isEn
    ? 'Pet Boss Clinic & Pet Shop | Premier Veterinary & Pet Boutique in Tehran'
    : 'کلینیک دامپزشکی پت باس | جراحی، واکسیناسیون، گرومینگ و پت شاپ قیطریه تهران';

  const description = isEn
    ? `Premier veterinary surgery, dental clinic, grooming salon & luxury pet boutique in Gheytariyeh, Tehran. ${nap.addressEn}. ${nap.workingHoursSummaryEn}.`
    : `کلینیک تخصصی جراحی دامپزشکی، دندانپزشکی، واکسیناسیون، ارتوپدی، گرومینگ حرفه‌ای و پت شاپ لوکس در قیطریه تهران. ${nap.addressFa}. ${nap.workingHoursSummaryFa}.`;

  return {
    metadataBase: new URL('https://www.petbossclinic.com'),
    title: {
      default: title,
      template: isEn ? '%s | Pet Boss Clinic Tehran' : '%s | کلینیک دامپزشکی پت باس تهران',
    },
    description,
    keywords: isEn
      ? ['veterinary clinic Tehran', 'pet shop Gheitariyeh', 'dog cat grooming Tehran', 'pet surgery Tehran', 'vaccination dog cat', 'Pet Boss Clinic']
      : ['کلینیک دامپزشکی تهران', 'دامپزشکی قیطریه', 'دامپزشکی شریعتی', 'پت شاپ قیطریه', 'گرومینگ سگ و گربه تهران', 'واکسیناسیون سگ و گربه', 'جراحی حیوانات خانگی', 'پت باس'],
    authors: [{ name: 'Pet Boss Clinic', url: 'https://www.petbossclinic.com' }],
    creator: 'Pet Boss Clinic',
    publisher: 'Pet Boss Clinic',
    alternates: {
      canonical: 'https://www.petbossclinic.com',
    },
    openGraph: {
      type: 'website',
      locale: isEn ? 'en_US' : 'fa_IR',
      url: 'https://www.petbossclinic.com',
      siteName: isEn ? 'Pet Boss Clinic & Pet Shop' : 'کلینیک و پت شاپ پت باس',
      title,
      description,
      images: [
        {
          url: '/images/petboss-sign.jpg',
          width: 1200,
          height: 630,
          alt: isEn ? 'Pet Boss Veterinary Clinic & Pet Shop Tehran' : 'کلینیک دامپزشکی و پت شاپ پت باس تهران',
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: ['/images/petboss-sign.jpg'],
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
      apple: [
        { url: '/apple-icon.png', sizes: '180x180', type: 'image/png' },
      ],
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
    <html lang={locale} dir={locale === 'fa' ? 'rtl' : 'ltr'} data-theme={initialTheme} suppressHydrationWarning>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.ico" sizes="any" />
        <link rel="icon" href="/icon.png" type="image/png" sizes="512x512" />
        <link rel="apple-touch-icon" href="/apple-icon.png" sizes="180x180" />
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
