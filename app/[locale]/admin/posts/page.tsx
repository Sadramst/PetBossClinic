import { db } from '@/lib/db';
import { requireAdmin } from '@/lib/auth/guard';
import { PostsManager } from '@/components/admin/posts-manager';
import { formatJalaliDate } from '@/lib/shop/expiry';

export const dynamic = 'force-dynamic';

export default async function AdminPostsPage({ params }: { params: Promise<{ locale: string }> }) {
  await requireAdmin('VIEWER', (await params).locale);
  const [posts, categories] = await Promise.all([
    db.post.findMany({
      where: { deletedAt: null },
      orderBy: { updatedAt: 'desc' },
      include: { category: { select: { nameFa: true } } },
    }),
    db.postCategory.findMany({ where: { deletedAt: null }, orderBy: { sortOrder: 'asc' }, select: { nameFa: true } }),
  ]);

  return (
    <PostsManager
      categories={categories.map((c) => c.nameFa)}
      posts={posts.map((p) => ({
        id: p.id,
        titleFa: p.titleFa,
        slugFa: p.slugFa,
        excerptFa: p.excerptFa,
        contentFa: p.contentFa,
        imageId: p.imageId,
        metaTitleFa: p.metaTitleFa,
        metaDescriptionFa: p.metaDescriptionFa,
        focusKeyword: p.focusKeyword,
        category: p.category.nameFa,
        published: !!p.publishedAt && p.isActive,
        publishedAt: p.publishedAt ? formatJalaliDate(p.publishedAt) : null,
        updatedAt: formatJalaliDate(p.updatedAt),
      }))}
    />
  );
}
