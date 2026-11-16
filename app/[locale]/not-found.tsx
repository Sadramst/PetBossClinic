import type { Metadata } from 'next';
import { Link } from '@/i18n/routing';
import { DocumentRobots, DocumentTitle } from '@/components/seo/document-title';

export const metadata: Metadata = {
  title: { absolute: 'صفحه پیدا نشد | پت‌باس' },
  robots: { index: false, follow: false },
};

/**
 * Farsi 404 boundary. Next.js returns HTTP 404 and adds `noindex` automatically;
 * because the locale layout no longer sets a canonical, a missing page can never
 * claim to be the homepage.
 */
export default function NotFound() {
  return (
    <div className="container mx-auto max-w-3xl px-4 py-16 sm:py-24 text-center">
      <DocumentTitle title="صفحه پیدا نشد | پت‌باس" />
      <DocumentRobots />
      <p className="text-6xl font-black text-gradient-gold" aria-hidden>
        ۴۰۴
      </p>
      <h1 className="mt-4 text-2xl sm:text-3xl font-extrabold">صفحه پیدا نشد</h1>
      <p className="mt-3 text-sm sm:text-base text-muted-foreground leading-7">
        آدرسی که وارد کرده‌اید وجود ندارد یا جابه‌جا شده است. از میان این صفحه‌ها ادامه دهید:
      </p>

      <nav aria-label="صفحه‌های پیشنهادی" className="mt-8 flex flex-wrap justify-center gap-3 text-sm font-bold">
        <Link href="/" className="rounded-xl bg-gradient-gold text-charcoal-950 px-5 py-2.5">
          صفحه اصلی
        </Link>
        <Link href="/shop" className="rounded-xl border border-border px-5 py-2.5 hover:border-primary">
          پت‌شاپ
        </Link>
        <Link href="/services" className="rounded-xl border border-border px-5 py-2.5 hover:border-primary">
          خدمات کلینیک
        </Link>
        <Link href="/blog" className="rounded-xl border border-border px-5 py-2.5 hover:border-primary">
          مجله پت‌باس
        </Link>
        <Link href="/contact" className="rounded-xl border border-border px-5 py-2.5 hover:border-primary">
          تماس با ما
        </Link>
      </nav>
    </div>
  );
}
