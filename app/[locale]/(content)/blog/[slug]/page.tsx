import type { Metadata } from 'next';
import Image from 'next/image';
import { notFound } from 'next/navigation';
import { setRequestLocale } from 'next-intl/server';
import { Link } from '@/i18n/routing';
import { Breadcrumbs } from '@/components/shop/breadcrumbs';
import { ProductCard } from '@/components/shop/product-card';
import { CtaBand } from '@/components/content/cta-band';
import { BagIcon, ChevronDownIcon, ChevronIcon } from '@/components/content/icons';
import { ArticleJsonLd } from '@/lib/seo/json-ld';
import { ArticleBody, articleHeadings, readingMinutes } from '@/lib/blog/render';
import { getPublishedPost, postPath } from '@/lib/blog/posts';
import { getClinicNAP } from '@/lib/clinic/nap';
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
  const [related, nap] = await Promise.all([
    // Products related to the article's focus keyword, e.g. "غذای خشک گربه".
    post.focusKeyword
      ? getListing(parseShopFilters({ q: post.focusKeyword, stock: '1' })).then((r) => r.products.slice(0, 4))
      : Promise.resolve([]),
    getClinicNAP(),
  ]);

  const hasToc = toc.length > 1;
  const minutes = post.readingTime || readingMinutes(content);
  const authorName = post.author?.nameFa ?? 'تحریریه پت‌باس';
  const shareText = encodeURIComponent(post.titleFa);
  const shareUrl = encodeURIComponent(url);
  const tocList = (
    <ol className="list-decimal space-y-2 ps-5 text-sm leading-7 marker:text-primary">
      {toc.map((h) => (
        <li key={h.id}>
          <a href={`#${h.id}`} className="text-foreground/85 hover:text-primary">
            {h.text}
          </a>
        </li>
      ))}
    </ol>
  );

  return (
    <div className="container-site py-6 sm:py-10">
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

      <div
        className={`mt-5 grid gap-8 sm:mt-6 lg:gap-10 ${
          hasToc ? 'lg:grid-cols-[minmax(0,1fr)_280px]' : 'mx-auto max-w-3xl'
        }`}
      >
        <article className="min-w-0 space-y-6">
          <header className="space-y-3">
            <Link href={`/blog?category=${encodeURIComponent(post.category.slugFa)}`} className="chip text-primary">
              {post.category.nameFa}
            </Link>
            <h1 className="text-2xl font-black leading-[1.6] sm:text-3xl sm:leading-[1.6]">{post.titleFa}</h1>
            {post.excerptFa && <p className="text-base leading-8 text-muted-foreground">{post.excerptFa}</p>}
            <div className="flex items-center gap-3 pt-1">
              <span
                aria-hidden
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-border-gold bg-surface-elevated text-sm font-bold text-primary"
              >
                {authorName.trim().charAt(0)}
              </span>
              <div className="min-w-0 text-xs leading-6 text-muted-foreground">
                <p className="font-bold text-foreground">{authorName}</p>
                <p>
                  {post.publishedAt && (
                    <>
                      <time dateTime={post.publishedAt.toISOString()}>{formatJalaliDate(post.publishedAt)}</time>
                      {' · '}
                    </>
                  )}
                  {minutes.toLocaleString('fa-IR')} دقیقه مطالعه
                </p>
              </div>
            </div>
          </header>

          {image && (
            <div className="relative aspect-[16/9] overflow-hidden rounded-2xl border border-border sm:rounded-3xl">
              <Image src={image} alt={post.titleFa} fill priority sizes="(max-width: 1024px) 100vw, 760px" className="object-cover" />
            </div>
          )}

          {hasToc && (
            <details className="group rounded-2xl border border-border bg-surface-card lg:hidden">
              <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 px-4 text-sm font-bold [&::-webkit-details-marker]:hidden">
                در این مقاله
                <ChevronDownIcon className="h-4 w-4 shrink-0 text-primary transition-transform group-open:rotate-180" />
              </summary>
              <nav aria-label="فهرست مطالب" className="border-t border-border/60 px-4 py-3">
                {tocList}
              </nav>
            </details>
          )}

          <ArticleBody source={content} />

          <aside className="rounded-2xl border border-primary/40 bg-primary/5 p-4 text-sm leading-8 sm:p-5">
            این مقاله جنبه آموزشی دارد و جایگزین معاینه نیست. برای تصمیم درباره درمان، تغذیه درمانی یا دارو با دامپزشکان کلینیک
            پت‌باس مشورت کنید.{' '}
            <Link href="/contact" className="font-bold text-primary hover:underline">
              تماس با کلینیک
            </Link>
          </aside>

          <footer className="flex flex-col gap-4 border-t border-border pt-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm text-muted-foreground">اشتراک‌گذاری:</span>
              <a
                href={`https://wa.me/?text=${shareText}%20${shareUrl}`}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-secondary btn-sm min-h-11"
              >
                واتس‌اپ
              </a>
              <a
                href={`https://t.me/share/url?url=${shareUrl}&text=${shareText}`}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-secondary btn-sm min-h-11"
              >
                تلگرام
              </a>
            </div>
            <Link href="/blog" className="btn btn-outline btn-sm min-h-11">
              بازگشت به مجله
              <ChevronIcon className="h-4 w-4" />
            </Link>
          </footer>
        </article>

        {hasToc && (
          <aside className="top-header hidden h-fit space-y-4 lg:sticky lg:block">
            <nav aria-label="فهرست مطالب" className="rounded-2xl border border-border bg-surface-card p-4">
              <p className="mb-2 text-sm font-bold">در این مقاله</p>
              {tocList}
            </nav>
            <div className="rounded-2xl border border-border-gold/50 bg-surface-card p-4">
              <p className="text-sm font-bold">پت‌شاپ آنلاین پت‌باس</p>
              <p className="mt-1 text-xs leading-6 text-muted-foreground">
                غذا، مکمل و لوازم سگ و گربه با نمایش تاریخ انقضا روی هر محصول.
              </p>
              <Link href="/shop" className="btn btn-gold btn-sm btn-block mt-3">
                <BagIcon className="h-4 w-4" />
                مشاهده محصولات
              </Link>
            </div>
          </aside>
        )}
      </div>

      {related.length > 0 && (
        <section className="mt-10 sm:mt-12" aria-labelledby="related-products">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 id="related-products" className="text-lg font-bold">
              محصولات مرتبط در پت‌شاپ
            </h2>
            <Link href="/shop" className="text-sm font-bold text-primary hover:underline">
              همه محصولات
            </Link>
          </div>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {related.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        </section>
      )}

      <CtaBand
        className="mt-10 sm:mt-12"
        title="درباره سلامت حیوان خود سوال دارید؟"
        text={`دامپزشکان پت‌باس پاسخ‌گوی شما هستند. ${nap.workingHoursSummaryFa}.`}
        nap={nap}
        callLabel="تماس با کلینیک"
      >
        <Link href="/services" className="btn btn-secondary">
          خدمات کلینیک
        </Link>
      </CtaBand>
    </div>
  );
}
