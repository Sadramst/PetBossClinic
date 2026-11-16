import Image from 'next/image';
import { Link } from '@/i18n/routing';
import { postPath, type PostCard as PostCardData } from '@/lib/blog/posts';
import { formatJalaliDate } from '@/lib/shop/expiry';

export function PostCard({ post }: { post: PostCardData }) {
  const img = post.imageId && !post.imageId.startsWith('data:') ? post.imageId : '/images/veterinarian.jpg';
  return (
    <article className="rounded-2xl border border-border bg-surface-card overflow-hidden flex flex-col group hover:border-primary/60">
      <Link href={postPath(post.slugFa)} className="relative block aspect-[16/9] overflow-hidden">
        <Image src={img} alt={post.titleFa} fill sizes="(max-width: 768px) 100vw, 33vw" className="object-cover group-hover:scale-105 transition-transform duration-500" />
      </Link>
      <div className="p-5 flex flex-col gap-2 flex-1">
        <span className="text-[11px] font-semibold text-primary">{post.category.nameFa}</span>
        <h3 className="font-bold leading-7">
          <Link href={postPath(post.slugFa)} className="hover:text-primary">{post.titleFa}</Link>
        </h3>
        {post.excerptFa && <p className="text-sm text-muted-foreground leading-7 line-clamp-3">{post.excerptFa}</p>}
        <p className="mt-auto pt-2 text-xs text-muted-foreground">
          {post.publishedAt && formatJalaliDate(post.publishedAt)}
          {post.readingTime ? ` · ${post.readingTime.toLocaleString('fa-IR')} دقیقه مطالعه` : ''}
        </p>
      </div>
    </article>
  );
}
