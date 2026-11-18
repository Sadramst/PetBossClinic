import { absoluteUrl } from '@/lib/seo/site';
import { feedProducts, toGoogleItem } from '@/lib/shop/feeds';

// Rendered on request and cached at the CDN for an hour. Not prerendered at build
// time, so builds never depend on the database shape (e.g. preview deployments).
export const dynamic = 'force-dynamic';

/** Full product catalogue as a Google Merchant style RSS feed (Emalls and others accept it). */
export async function GET() {
  const first = await feedProducts({ page: 1 });
  const rest = await Promise.all(
    Array.from({ length: first.maxPages - 1 }, (_, i) => feedProducts({ page: i + 2 }))
  );
  const rows = [first, ...rest].flatMap((r) => r.rows).filter((p) => p.price > 0);

  const body = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0">
<channel>
<title>پت‌شاپ پت‌باس</title>
<link>${absoluteUrl('/shop')}</link>
<description>محصولات پت‌شاپ کلینیک دامپزشکی پت‌باس</description>
${rows.map(toGoogleItem).join('\n')}
</channel>
</rss>`;
  return new Response(body, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
      'X-Robots-Tag': 'noindex',
    },
  });
}
