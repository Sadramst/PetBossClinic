import 'server-only';
import { cache } from 'react';
import type { Prisma } from '@prisma/client';
import { db } from '@/lib/db';

export const POSTS_PAGE_SIZE = 12;

/** A post is public when active, not deleted and its publish date has passed. */
export function publishedWhere(now = new Date()): Prisma.PostWhereInput {
  return { isActive: true, deletedAt: null, publishedAt: { not: null, lte: now } };
}

export const postCardSelect = {
  id: true,
  slugFa: true,
  titleFa: true,
  excerptFa: true,
  imageId: true,
  publishedAt: true,
  readingTime: true,
  category: { select: { nameFa: true, slugFa: true } },
} satisfies Prisma.PostSelect;

export type PostCard = Prisma.PostGetPayload<{ select: typeof postCardSelect }>;

export async function listPosts(page: number, categorySlug?: string) {
  const where: Prisma.PostWhereInput = {
    ...publishedWhere(),
    ...(categorySlug && { category: { slugFa: categorySlug } }),
  };
  const [total, posts] = await Promise.all([
    db.post.count({ where }),
    db.post.findMany({
      where,
      orderBy: { publishedAt: 'desc' },
      skip: (page - 1) * POSTS_PAGE_SIZE,
      take: POSTS_PAGE_SIZE,
      select: postCardSelect,
    }),
  ]);
  return { total, posts, pageCount: Math.max(1, Math.ceil(total / POSTS_PAGE_SIZE)) };
}

export const getPublishedPost = cache(async (slug: string) =>
  db.post.findFirst({
    where: { ...publishedWhere(), slugFa: slug },
    include: { category: true, author: true },
  })
);

export async function getBlogCategories() {
  return db.postCategory.findMany({
    where: { isActive: true, deletedAt: null, posts: { some: publishedWhere() } },
    orderBy: { sortOrder: 'asc' },
    select: { id: true, slugFa: true, nameFa: true },
  });
}

export function postPath(slug: string): string {
  return `/blog/${encodeURIComponent(slug)}`;
}
