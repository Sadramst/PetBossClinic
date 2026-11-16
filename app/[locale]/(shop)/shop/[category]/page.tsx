import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { setRequestLocale } from 'next-intl/server';
import { Link } from '@/i18n/routing';
import { Breadcrumbs } from '@/components/shop/breadcrumbs';
import { ProductCard } from '@/components/shop/product-card';
import { ItemListJsonLd } from '@/lib/seo/json-ld';
import { absoluteUrl } from '@/lib/seo/site';
import { getActiveCategories, getCategoryBySlug, getCategoryProducts } from '@/lib/shop/catalog';
import { categoryPath, decodeSlug, productPath } from '@/lib/shop/urls';

type Params = Promise<{ locale: string; category: string }>;
type Search = Promise<{ page?: string }>;

function parsePage(raw?: string): number {
  const n = Number(raw);
  return Number.isInteger(n) && n > 1 ? n : 1;
}

export async function generateMetadata({ params, searchParams }: { params: Params; searchParams: Search }): Promise<Metadata> {
  const { locale, category: rawSlug } = await params;
  setRequestLocale(locale);
  const page = parsePage((await searchParams).page);
  const category = await getCategoryBySlug(decodeSlug(rawSlug));
  if (!category) return { title: 'دسته‌بندی یافت نشد', robots: { index: false } };

  const baseTitle = category.metaTitleFa || `خرید ${category.nameFa} | قیمت و بهترین برندها`;
  const title = page > 1 ? `${baseTitle} - صفحه ${page.toLocaleString('fa-IR')}` : baseTitle;
  const description =
    category.metaDescriptionFa ||
    `خرید ${category.nameFa} اصل با تاریخ انقضای معتبر از پت‌شاپ کلینیک دامپزشکی پت‌باس تهران. ${category.descriptionFa ?? ''} مقایسه قیمت، موجودی و مشاوره رایگان دامپزشک.`.trim();
  const url = absoluteUrl(categoryPath(category.slugFa, page));

  return {
    title: { absolute: `${title} | پت‌شاپ پت‌باس` },
    description,
    alternates: { canonical: category.canonicalUrl && page === 1 ? category.canonicalUrl : url },
    robots: category.noindex ? { index: false, follow: true } : undefined,
    openGraph: {
      type: 'website',
      locale: 'fa_IR',
      url,
      title,
      description,
      ...(category.imageId && !category.imageId.startsWith('data:') && { images: [{ url: absoluteUrl(category.imageId) }] }),
    },
  };
}

export default async function CategoryPage({ params, searchParams }: { params: Params; searchParams: Search }) {
  const { locale, category: rawSlug } = await params;
  setRequestLocale(locale);
  const page = parsePage((await searchParams).page);

  const category = await getCategoryBySlug(decodeSlug(rawSlug));
  if (!category) notFound();

  const [{ products, total, pageCount }, categories] = await Promise.all([
    getCategoryProducts(category.id, page),
    getActiveCategories(),
  ]);
  if (page > pageCount) notFound();

  return (
    <div className="container mx-auto px-4 py-6 sm:py-10 max-w-7xl">
      <ItemListJsonLd name={category.nameFa} urls={products.map((p) => absoluteUrl(productPath(p.slugFa)))} />
      <Breadcrumbs
        items={[
          { name: 'خانه', href: '/' },
          { name: 'پت‌شاپ', href: '/shop' },
          { name: category.nameFa, href: categoryPath(category.slugFa) },
        ]}
      />

      <header className="mt-5 mb-6">
        <h1 className="text-2xl sm:text-3xl font-extrabold">خرید {category.nameFa}</h1>
        {category.descriptionFa && page === 1 && (
          <p className="mt-2 text-sm text-muted-foreground leading-7 max-w-3xl">{category.descriptionFa}</p>
        )}
        <p className="mt-2 text-xs text-muted-foreground">{total.toLocaleString('fa-IR')} محصول</p>
      </header>

      <div className="grid gap-6 lg:grid-cols-[220px_1fr]">
        <aside className="order-2 lg:order-1">
          <nav aria-label="دسته‌بندی‌های پت‌شاپ" className="rounded-2xl border border-border bg-surface-card p-4">
            <h2 className="text-sm font-bold mb-3">دسته‌بندی‌ها</h2>
            <ul className="space-y-1 text-sm">
              {categories
                .filter((c) => c._count.products > 0)
                .map((c) => (
                  <li key={c.id}>
                    <Link
                      href={categoryPath(c.slugFa)}
                      aria-current={c.id === category.id ? 'page' : undefined}
                      className={`flex justify-between rounded-lg px-2 py-1.5 hover:bg-surface-hover ${
                        c.id === category.id ? 'text-primary font-bold bg-surface-hover' : 'text-foreground/85'
                      }`}
                    >
                      <span>{c.nameFa}</span>
                      <span className="text-xs text-muted-foreground">{c._count.products.toLocaleString('fa-IR')}</span>
                    </Link>
                  </li>
                ))}
            </ul>
          </nav>
        </aside>

        <section className="order-1 lg:order-2">
          {products.length === 0 ? (
            <p className="text-sm text-muted-foreground">در حال حاضر محصولی در این دسته موجود نیست.</p>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4">
              {products.map((p, i) => (
                <ProductCard key={p.id} product={p} priority={i < 4} />
              ))}
            </div>
          )}

          {pageCount > 1 && (
            <nav aria-label="صفحه‌بندی" className="mt-8 flex flex-wrap justify-center gap-2">
              {Array.from({ length: pageCount }, (_, i) => i + 1).map((n) => (
                <Link
                  key={n}
                  href={categoryPath(category.slugFa, n)}
                  aria-current={n === page ? 'page' : undefined}
                  className={`min-w-10 h-10 px-3 inline-flex items-center justify-center rounded-xl border text-sm font-bold ${
                    n === page ? 'bg-primary text-charcoal-950 border-primary' : 'border-border hover:border-primary'
                  }`}
                >
                  {n.toLocaleString('fa-IR')}
                </Link>
              ))}
            </nav>
          )}
        </section>
      </div>
    </div>
  );
}
