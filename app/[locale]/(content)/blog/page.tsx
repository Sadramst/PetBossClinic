import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { setRequestLocale } from 'next-intl/server';
import { Link } from '@/i18n/routing';
import { PageHero } from '@/components/content/page-hero';
import { EmptyState } from '@/components/ui/empty-state';
import { Pagination } from '@/components/ui/pagination';
import { PostCard } from '@/components/blog/post-card';
import { getBlogCategories, listPosts, postPath } from '@/lib/blog/posts';
import { ItemListJsonLd } from '@/lib/seo/json-ld';
import { pageMetadata } from '@/lib/seo/metadata';
import { absoluteUrl } from '@/lib/seo/site';

type Search = Promise<{ page?: string; category?: string }>;

const TITLE = 'مجله پت‌باس | راهنمای تغذیه و سلامت سگ و گربه';
const DESCRIPTION =
  'مقالات آموزشی دامپزشکان پت‌باس درباره تغذیه، واکسیناسیون، بهداشت، رفتار و نگهداری سگ و گربه؛ ساده، کاربردی و قابل اعتماد.';

/** 40px pill; the active one is filled so it reads at a glance. */
function chipClass(active: boolean): string {
  return `chip h-10 px-4 ${active ? '!border-primary !bg-primary !text-charcoal-950' : ''}`;
}

function parse(sp: { page?: string; category?: string }) {
  const n = Number(sp.page);
  return { page: Number.isInteger(n) && n > 1 ? n : 1, category: sp.category?.slice(0, 80) || undefined };
}

export async function generateMetadata({ searchParams }: { searchParams: Search }): Promise<Metadata> {
  const { page, category } = parse(await searchParams);
  return pageMetadata({
    title: page > 1 ? `${TITLE} - صفحه ${page.toLocaleString('fa-IR')}` : TITLE,
    description: DESCRIPTION,
    path: page > 1 ? `/blog?page=${page}` : '/blog',
    // Topic filters are thin duplicates of the archive; keep them crawlable but out of the index.
    noindex: !!category,
    follow: true,
  });
}

export default async function BlogPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Search }) {
  setRequestLocale((await params).locale);
  const { page, category } = parse(await searchParams);
  const [{ posts, pageCount }, categories] = await Promise.all([listPosts(page, category), getBlogCategories()]);
  if (page > pageCount) notFound();

  const hrefFor = (n: number) => {
    const qs = new URLSearchParams();
    if (category) qs.set('category', category);
    if (n > 1) qs.set('page', String(n));
    const q = qs.toString();
    return q ? `/blog?${q}` : '/blog';
  };
  const activeCategory = category ? categories.find((c) => c.slugFa === category) : undefined;
  const showFeatured = page === 1 && !category && posts.length > 3;

  return (
    <div className="bg-background">
      <ItemListJsonLd name="مقالات مجله پت‌باس" urls={posts.map((p) => absoluteUrl(postPath(p.slugFa)))} />
      <PageHero
        crumbs={[
          { name: 'خانه', href: '/' },
          { name: 'مجله پت‌باس', href: '/blog' },
        ]}
        badge="دانستنی‌های نگهداری سگ و گربه"
        title="مجله پت‌باس"
        subtitle={DESCRIPTION}
      />

      <div className="container-site section-tight space-y-6">
        {categories.length > 0 && (
          <nav aria-label="موضوعات مجله" className="rail rail-bleed gap-2">
            <Link href="/blog" aria-current={!category ? 'page' : undefined} className={chipClass(!category)}>
              همه
            </Link>
            {categories.map((c) => (
              <Link
                key={c.id}
                href={`/blog?category=${encodeURIComponent(c.slugFa)}`}
                aria-current={category === c.slugFa ? 'page' : undefined}
                className={chipClass(category === c.slugFa)}
              >
                {c.nameFa}
              </Link>
            ))}
          </nav>
        )}

        {activeCategory && (
          <h2 className="text-lg font-bold">
            مقالات {activeCategory.nameFa}
            {page > 1 && <span className="text-sm font-normal text-muted-foreground"> · صفحه {page.toLocaleString('fa-IR')}</span>}
          </h2>
        )}

        {posts.length === 0 ? (
          <EmptyState
            variant="card"
            title={category ? 'در این موضوع هنوز مقاله‌ای منتشر نشده است' : 'به‌زودی اولین مقالات مجله پت‌باس منتشر می‌شود'}
            description="تا آن زمان می‌توانید محصولات پت‌شاپ را ببینید یا سوال خود را از کلینیک بپرسید."
            action={
              category ? (
                <Link href="/blog" className="btn btn-gold">همه مقالات</Link>
              ) : (
                <Link href="/shop" className="btn btn-gold">مشاهده پت‌شاپ</Link>
              )
            }
            secondaryAction={<Link href="/faq" className="btn btn-outline">سوالات متداول</Link>}
          />
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5 lg:grid-cols-3">
            {posts.map((p, i) => (
              <PostCard key={p.id} post={p} featured={showFeatured && i === 0} />
            ))}
          </div>
        )}

        <Pagination page={page} pageCount={pageCount} hrefFor={hrefFor} />

        <section className="surface-card flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
          <div>
            <h2 className="text-base font-bold">محصول مناسب حیوان خود را پیدا کنید</h2>
            <p className="mt-1 text-sm leading-7 text-muted-foreground">
              غذا، مکمل و لوازم سگ و گربه با نمایش تاریخ انقضا و ارسال به سراسر کشور.
            </p>
          </div>
          <div className="flex flex-col gap-2.5 sm:flex-row sm:shrink-0">
            <Link href="/shop" className="btn btn-gold">ورود به پت‌شاپ</Link>
            <Link href="/services" className="btn btn-outline">خدمات کلینیک</Link>
          </div>
        </section>
      </div>
    </div>
  );
}
