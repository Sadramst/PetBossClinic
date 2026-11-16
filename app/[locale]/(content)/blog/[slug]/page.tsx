import type { Metadata } from 'next';
import Image from 'next/image';
import { notFound } from 'next/navigation';
import { setRequestLocale } from 'next-intl/server';
import { Link } from '@/i18n/routing';
import { Breadcrumbs } from '@/components/shop/breadcrumbs';
import { ProductCard } from '@/components/shop/product-card';
import { ArticleJsonLd } from '@/lib/seo/json-ld';
import { ArticleBody, articleHeadings, readingMinutes } from '@/lib/blog/render';
import { getPublishedPost, postPath } from '@/lib/blog/posts';
import { getListing } from '@/lib/shop/catalog';
import { parseShopFilters } from '@/lib/shop/filters';
import { pageMetadata, postSeoTitle } from '@/lib/seo/metadata';
import { absoluteUrl } from '@/lib/seo/site';
import { formatJalaliDate } from '@/lib/shop/expiry';
import { decodeSlug } from '@/lib/shop/urls';

export const revalidate = 600;

export function generateStaticParams() {
  return [];
}

type Params = Promise<{ locale: string; slug: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  const post = await getPublishedPost(decodeSlug(slug));
  if (!post) return { title: 'مقاله یافت نشد', robots: { index: false, follow: false } };

  const image =
    post.ogImageId && !post.ogImageId.startsWith('data:')
      ? post.ogImageId
      : post.imageId && !post.imageId.startsWith('data:')
        ? post.imageId
        : '/images/petboss-sign.jpg';

  const description =
    post.metaDescriptionFa ||
    post.excerptFa ||
    `${post.titleFa}؛ مقاله‌ای از مجله پت‌باس درباره تغذیه، سلامت و نگهداری سگ و گربه.`;

  return pageMetadata({
    title: post.metaTitleFa || postSeoTitle(post.titleFa),
    description,
    path: postPath(post.slugFa),
    canonical: post.canonicalUrl,
    image,
    imageAlt: post.titleFa,
    type: 'article',
    publishedTime: post.publishedAt?.toISOString(),
    modifiedTime: post.updatedAt.toISOString(),
    noindex: post.noindex,
    keywords: [post.focusKeyword, post.category.nameFa, 'سگ', 'گربه'].filter((v): v is string => !!v),
  });
}

export default async function BlogPostPage({ params }: { params: Params }) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  const post = await getPublishedPost(decodeSlug(slug));
  if (!post) notFound();

  const content = post.contentFa ?? '';
  const toc = articleHeadings(content);
  const url = absoluteUrl(postPath(post.slugFa));
  const image = post.imageId && !post.imageId.startsWith('data:') ? post.imageId : null;
  const socialImage =
    (post.ogImageId && !post.ogImageId.startsWith('data:') ? post.ogImageId : null) ??
    image ??
    '/images/petboss-sign.jpg';
  // Products related to the article's focus keyword, e.g. "غذای خشک گربه".
  const related = post.focusKeyword
    ? (await getListing(parseShopFilters({ q: post.focusKeyword, stock: '1' }))).products.slice(0, 4)
    : [];

  return (
    <div className="container mx-auto max-w-6xl px-4 py-6 sm:py-10">
      <ArticleJsonLd
        article={{
          title: post.titleFa,
          description: post.excerptFa,
          url,
          images: [absoluteUrl(socialImage)],
          publishedAt: post.publishedAt?.toISOString(),
          modifiedAt: post.updatedAt.toISOString(),
          authorName: post.author?.nameFa,
          section: post.category.nameFa,
          keywords: [post.focusKeyword, post.category.nameFa].filter((v): v is string => !!v).join(', '),
        }}
      />
      <Breadcrumbs
        items={[
          { name: 'خانه', href: '/' },
          { name: 'مجله پت‌باس', href: '/blog' },
          { name: post.titleFa, href: postPath(post.slugFa) },
        ]}
      />

      <div className="mt-6 grid gap-10 lg:grid-cols-[1fr_260px]">
        <article className="min-w-0 space-y-6">
          <header className="space-y-3">
            <Link href={`/blog?category=${encodeURIComponent(post.category.slugFa)}`} className="text-xs font-bold text-primary">
              {post.category.nameFa}
            </Link>
            <h1 className="text-2xl sm:text-3xl font-black leading-[1.6]">{post.titleFa}</h1>
            <p className="text-xs text-muted-foreground">
              {post.author ? `${post.author.nameFa} · ` : ''}
              {post.publishedAt && formatJalaliDate(post.publishedAt)} · {(post.readingTime || readingMinutes(content)).toLocaleString('fa-IR')} دقیقه مطالعه
            </p>
            {post.excerptFa && <p className="text-base text-muted-foreground leading-8">{post.excerptFa}</p>}
          </header>
          {image && (
            <div className="relative aspect-[16/9] rounded-3xl overflow-hidden border border-border">
              <Image src={image} alt={post.titleFa} fill priority sizes="(max-width: 1024px) 100vw, 720px" className="object-cover" />
            </div>
          )}
          <ArticleBody source={content} />
          <aside className="rounded-2xl border border-primary/40 bg-primary/5 p-5 text-sm leading-7">
            این مقاله جنبه آموزشی دارد و جایگزین معاینه نیست. برای تصمیم درباره درمان، تغذیه درمانی یا دارو با دامپزشکان کلینیک
            پت‌باس مشورت کنید. <Link href="/contact" className="text-primary font-bold">تماس با کلینیک</Link>
          </aside>
        </article>

        <aside className="space-y-5 lg:sticky lg:top-40 h-fit">
          {toc.length > 1 && (
            <nav aria-label="فهرست مطالب" className="rounded-2xl border border-border bg-surface-card p-4 text-sm">
              <p className="font-bold mb-2">در این مقاله</p>
              <ol className="space-y-1.5 list-decimal ps-5 marker:text-primary">
                {toc.map((h) => (
                  <li key={h.id}>
                    <a href={`#${h.id}`} className="hover:text-primary">{h.text}</a>
                  </li>
                ))}
              </ol>
            </nav>
          )}
        </aside>
      </div>

      {related.length > 0 && (
        <section className="mt-12">
          <h2 className="text-lg font-bold mb-4">محصولات مرتبط در پت‌شاپ</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {related.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
