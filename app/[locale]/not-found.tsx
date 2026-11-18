import type { Metadata } from 'next';
import { Link } from '@/i18n/routing';
import { DocumentRobots, DocumentTitle } from '@/components/seo/document-title';
import { SiteSearch } from '@/components/layout/header';
import { getNavCatalog } from '@/lib/shop/catalog';
import { categoryPath } from '@/lib/shop/urls';

export const metadata: Metadata = {
  title: { absolute: 'صفحه پیدا نشد | پت‌باس' },
  robots: { index: false, follow: false },
};

const QUICK_LINKS = [
  { href: '/shop', label: 'پت‌شاپ' },
  { href: '/services', label: 'خدمات کلینیک' },
  { href: '/blog', label: 'مجله پت‌باس' },
  { href: '/contact', label: 'تماس با ما' },
];

/**
 * Farsi 404 boundary. Next.js returns HTTP 404 and adds `noindex` automatically;
 * because the locale layout no longer sets a canonical, a missing page can never
 * claim to be the homepage. Recovery paths: product search, top categories and
 * the main sections of the site.
 */
export default async function NotFound() {
  // Cached for the header already; resolves to empty lists if the database is down.
  const { categories } = await getNavCatalog();
  const topCategories = categories.slice(0, 6);

  return (
    <div className="container-narrow py-14 text-center sm:py-20">
      <DocumentTitle title="صفحه پیدا نشد | پت‌باس" />
      <DocumentRobots />
      <p className="text-7xl font-black text-gradient-gold sm:text-8xl" aria-hidden>
        ۴۰۴
      </p>
      <h1 className="mt-4 text-2xl font-extrabold sm:text-3xl">صفحه پیدا نشد</h1>
      <p className="mx-auto mt-3 max-w-md text-sm leading-7 text-muted-foreground sm:text-base sm:leading-8">
        آدرسی که وارد کرده‌اید وجود ندارد یا جابه‌جا شده است. محصول موردنظرتان را جستجو کنید یا از میان این صفحه‌ها ادامه دهید.
      </p>

      <SiteSearch id="notfound-search" className="mx-auto mt-8 max-w-md text-start" />

      {topCategories.length > 0 && (
        <nav aria-label="دسته‌بندی‌های پرطرفدار" className="mt-6">
          <ul className="flex flex-wrap justify-center gap-2">
            {topCategories.map((category) => (
              <li key={category.id}>
                <Link href={categoryPath(category.slugFa)} className="chip">
                  {category.nameFa}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      )}

      <nav aria-label="صفحه‌های پیشنهادی" className="mt-8 flex flex-wrap justify-center gap-3">
        <Link href="/" className="btn btn-gold">
          صفحه اصلی
        </Link>
        {QUICK_LINKS.map((link) => (
          <Link key={link.href} href={link.href} className="btn btn-outline">
            {link.label}
          </Link>
        ))}
      </nav>
    </div>
  );
}
