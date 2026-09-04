import '@/styles/globals.css';
import { NextIntlClientProvider } from 'next-intl';
import { getMessages } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { cookies } from 'next/headers';
import { Outfit, Vazirmatn } from 'next/font/google';
import { ThemeProvider, ThemePreset } from '@/lib/theme';
import { Header } from '@/components/layout/header';
import { Footer } from '@/components/layout/footer';

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

  return (
    <html lang={locale} dir={locale === 'fa' ? 'rtl' : 'ltr'} data-theme={initialTheme} suppressHydrationWarning>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.ico" sizes="any" />
      </head>
      <body
        className={`${fontClass} antialiased bg-background text-foreground min-h-screen flex flex-col selection:bg-primary selection:text-primary-foreground`}
      >
        <ThemeProvider initialTheme={initialTheme}>
          <NextIntlClientProvider messages={messages}>
            <Header />
            <main className="flex-grow">{children}</main>
            <Footer />
          </NextIntlClientProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
