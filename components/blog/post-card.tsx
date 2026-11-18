import Image from 'next/image';
import { Link } from '@/i18n/routing';
import { postPath, type PostCard as PostCardData } from '@/lib/blog/posts';
import { formatJalaliDate } from '@/lib/shop/expiry';

/** Branded tile shown when a post has no cover photo. */
function CoverFallback({ label }: { label: string }) {
  return (
    <span
      aria-hidden
      className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-[radial-gradient(circle_at_30%_20%,rgba(197,160,89,0.28)_0%,transparent_60%)] bg-surface-elevated p-4 text-center"
    >
      <svg viewBox="0 0 24 24" className="h-8 w-8 text-primary/70" fill="currentColor">
        <circle cx="5.5" cy="10" r="2" />
        <circle cx="9.5" cy="5.5" r="2" />
        <circle cx="14.5" cy="5.5" r="2" />
        <circle cx="18.5" cy="10" r="2" />
        <path d="M12 10.5c-2.6 0-5.5 3.2-5.5 5.9 0 1.6 1.2 2.6 2.8 2.6 1.1 0 1.8-.5 2.7-.5s1.6.5 2.7.5c1.6 0 2.8-1 2.8-2.6 0-2.7-2.9-5.9-5.5-5.9z" />
      </svg>
      <span className="text-sm font-bold text-gradient-gold">{label}</span>
    </span>
  );
}

export function PostCard({ post, featured = false }: { post: PostCardData; featured?: boolean }) {
  const img = post.imageId && !post.imageId.startsWith('data:') ? post.imageId : null;
  const href = postPath(post.slugFa);

  return (
    <article
      className={`group relative flex flex-col overflow-hidden rounded-2xl border border-border bg-surface-card transition-colors hover:border-primary/60 ${
        featured ? 'sm:col-span-2 sm:flex-row lg:col-span-3' : ''
      }`}
    >
      <div
        className={`relative aspect-[16/9] shrink-0 overflow-hidden ${
          featured ? 'sm:aspect-auto sm:min-h-64 sm:w-1/2' : ''
        }`}
      >
        {img ? (
          <Image
            src={img}
            alt={post.titleFa}
            fill
            priority={featured}
            sizes={featured ? '(max-width: 640px) 100vw, 50vw' : '(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw'}
            className="object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <CoverFallback label={post.category.nameFa} />
        )}
      </div>
      <div className={`flex flex-1 flex-col gap-2 p-4 sm:p-5 ${featured ? 'sm:justify-center sm:p-8' : ''}`}>
        <span className="text-xs font-semibold text-primary">
          {featured ? `تازه‌ترین مقاله · ${post.category.nameFa}` : post.category.nameFa}
        </span>
        <h3 className={`font-bold leading-8 ${featured ? 'text-lg sm:text-2xl sm:leading-[1.7]' : 'text-base'}`}>
          <Link href={href} className="transition-colors after:absolute after:inset-0 group-hover:text-primary">
            {post.titleFa}
          </Link>
        </h3>
        {post.excerptFa && (
          <p className={`text-sm leading-7 text-muted-foreground ${featured ? 'line-clamp-4' : 'line-clamp-3'}`}>
            {post.excerptFa}
          </p>
        )}
        <p className="mt-auto pt-2 text-xs text-muted-foreground">
          {post.publishedAt && formatJalaliDate(post.publishedAt)}
          {post.readingTime ? ` · ${post.readingTime.toLocaleString('fa-IR')} دقیقه مطالعه` : ''}
        </p>
      </div>
    </article>
  );
}
