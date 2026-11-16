import { db } from '@/lib/db';
import { absoluteUrl } from '@/lib/seo/site';
import { postPath, publishedWhere } from '@/lib/blog/posts';

export const revalidate = 3600;

const xml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** RSS feed of published blog articles (مجله پت‌باس). */
export async function GET() {
  const posts = await db.post.findMany({
    where: publishedWhere(),
    orderBy: { publishedAt: 'desc' },
    take: 30,
    select: { slugFa: true, titleFa: true, excerptFa: true, publishedAt: true },
  });
  const items = posts
    .map((p) => {
      const url = absoluteUrl(postPath(p.slugFa));
      return `<item><title>${xml(p.titleFa)}</title><link>${url}</link><guid>${url}</guid><pubDate>${p.publishedAt!.toUTCString()}</pubDate><description>${xml(p.excerptFa ?? '')}</description></item>`;
    })
    .join('\n');

  return new Response(
    `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
<channel>
<title>مجله پت‌باس</title>
<link>${absoluteUrl('/blog')}</link>
<description>مقالات تغذیه، سلامت و نگهداری سگ و گربه از دامپزشکان پت‌باس</description>
<language>fa-IR</language>
${items}
</channel>
</rss>`,
    { headers: { 'Content-Type': 'application/rss+xml; charset=utf-8' } }
  );
}
