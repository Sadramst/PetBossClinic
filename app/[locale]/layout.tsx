import type { Metadata } from 'next';
import '@/styles/globals.css';
import { NextIntlClientProvider } from 'next-intl';
import { getMessages } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { cookies } from 'next/headers';
import { Outfit, Vazirmatn } from 'next/font/google';
import { ThemeProvider, ThemePreset } from '@/lib/theme';
import { Header } from '@/components/layout/header';
import { Footer } from '@/components/layout/footer';
import { getClinicNAP } from '@/lib/clinic/nap';

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
  return [{ locale: 'fa' }, { locale: 'en' }];
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const isEn = locale === 'en';

  return {
    title: isEn
      ? 'Pet Boss Clinic & Pet Shop | Premier Veterinary & Pet Boutique'
      : 'کلینیک و پت شاپ پت باس | کلینیک تخصصی دامپزشکی و پت شاپ لوکس',
    description: isEn
      ? 'Premier Veterinary Surgery, Dental Clinic & Luxury Pet Boutique in Tehran.'
      : 'کلینیک تخصصی جراحی، دندانپزشکی، ارتوپدی و پت شاپ لوکس پت باس در تهران.',
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
  let messages;
  try {
    messages = await getMessages();
  } catch {
    notFound();
  }

  const cookieStore = await cookies();
  const rawTheme = cookieStore.get('petboss_theme')?.value as ThemePreset | undefined;
  const initialTheme: ThemePreset =
    rawTheme && ['petboss-luxury-dark', 'petboss-luxury-light', 'emerald-prestige', 'royal-obsidian'].includes(rawTheme)
      ? rawTheme
      : 'petboss-luxury-dark';

  const fontClass = locale === 'fa' ? vazirmatn.className : outfit.className;
  const nap = await getClinicNAP();

  return (
    <html lang={locale} dir={locale === 'fa' ? 'rtl' : 'ltr'} data-theme={initialTheme} suppressHydrationWarning>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.ico" sizes="any" />
        <link rel="icon" href="/icon.png" type="image/png" sizes="512x512" />
        <link rel="apple-touch-icon" href="/apple-icon.png" sizes="180x180" />
      </head>
      <body
        className={`${fontClass} antialiased bg-background text-foreground min-h-screen flex flex-col selection:bg-primary selection:text-primary-foreground`}
      >
        <ThemeProvider initialTheme={initialTheme}>
          <NextIntlClientProvider messages={messages}>
            <Header />
            <main className="flex-grow">{children}</main>
            <Footer nap={nap} />
          </NextIntlClientProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
