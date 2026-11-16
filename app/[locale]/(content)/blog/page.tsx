import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { setRequestLocale } from 'next-intl/server';
import { Link } from '@/i18n/routing';
import { Breadcrumbs } from '@/components/shop/breadcrumbs';
import { PostCard } from '@/components/blog/post-card';
import { getBlogCategories, listPosts } from '@/lib/blog/posts';
import { absoluteUrl } from '@/lib/seo/site';

type Search = Promise<{ page?: string; category?: string }>;

const TITLE = 'مجله پت‌باس | راهنمای تغذیه، سلامت و نگهداری سگ و گربه';
const DESCRIPTION =
  'مقالات کاربردی دامپزشکان کلینیک پت‌باس درباره تغذیه، واکسیناسیون، بهداشت، رفتار و نگهداری سگ و گربه؛ به زبان ساده و قابل اعتماد.';

function parse(sp: { page?: string; category?: string }) {
  const n = Number(sp.page);
  return { page: Number.isInteger(n) && n > 1 ? n : 1, category: sp.category?.slice(0, 80) || undefined };
}

export async function generateMetadata({ searchParams }: { searchParams: Search }): Promise<Metadata> {
  const { page, category } = parse(await searchParams);
  const url = absoluteUrl(page > 1 ? `/blog?page=${page}` : '/blog');
  return {
    title: { absolute: page > 1 ? `${TITLE} - صفحه ${page.toLocaleString('fa-IR')}` : TITLE },
    description: DESCRIPTION,
    alternates: { canonical: url },
    robots: category ? { index: false, follow: true } : undefined,
    openGraph: { type: 'website', locale: 'fa_IR', url, title: TITLE, description: DESCRIPTION },
  };
}

export default async function BlogPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Search }) {
  setRequestLocale((await params).locale);
  const { page, category } = parse(await searchParams);
  const [{ posts, pageCount }, categories] = await Promise.all([listPosts(page, category), getBlogCategories()]);
  if (page > pageCount) notFound();

  return (
    <div className="container mx-auto max-w-6xl px-4 py-6 sm:py-10 space-y-6">
      <Breadcrumbs items={[{ name: 'خانه', href: '/' }, { name: 'مجله پت‌باس', href: '/blog' }]} />
      <header>
        <h1 className="text-2xl sm:text-3xl font-black">مجله پت‌باس</h1>
        <p className="mt-2 text-sm text-muted-foreground leading-7 max-w-2xl">{DESCRIPTION}</p>
      </header>

      {categories.length > 0 && (
        <nav aria-label="موضوعات مجله" className="flex flex-wrap gap-2 text-sm">
          <Link href="/blog" className={`rounded-full border px-4 py-1.5 ${!category ? 'border-primary text-primary' : 'border-border'}`}>
            همه
          </Link>
          {categories.map((c) => (
            <Link
              key={c.id}
              href={`/blog?category=${encodeURIComponent(c.slugFa)}`}
              className={`rounded-full border px-4 py-1.5 ${category === c.slugFa ? 'border-primary text-primary' : 'border-border hover:border-primary'}`}
            >
              {c.nameFa}
            </Link>
          ))}
        </nav>
      )}

      {posts.length === 0 ? (
        <p className="rounded-2xl border border-border bg-surface-card p-10 text-center text-sm text-muted-foreground">
          به‌زودی اولین مقالات مجله پت‌باس منتشر می‌شود.
        </p>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {posts.map((p) => (
            <PostCard key={p.id} post={p} />
          ))}
        </div>
      )}

      {pageCount > 1 && (
        <nav aria-label="صفحه‌بندی" className="flex justify-center gap-2">
          {Array.from({ length: pageCount }, (_, i) => i + 1).map((n) => (
            <Link
              key={n}
              href={n > 1 ? `/blog?page=${n}` : '/blog'}
              aria-current={n === page ? 'page' : undefined}
              className={`min-w-10 h-10 inline-flex items-center justify-center rounded-xl border text-sm font-bold ${n === page ? 'bg-primary text-charcoal-950 border-primary' : 'border-border'}`}
            >
              {n.toLocaleString('fa-IR')}
            </Link>
          ))}
        </nav>
      )}
    </div>
  );
}
