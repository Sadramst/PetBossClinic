import { absoluteUrl } from '@/lib/seo/site';
import { feedProducts, toGoogleItem } from '@/lib/shop/feeds';

export const revalidate = 3600;

/** Full product catalogue as a Google Merchant style RSS feed (Emalls and others accept it). */
export async function GET() {
  const first = await feedProducts({ page: 1 });
  const rest = await Promise.all(
    Array.from({ length: first.maxPages - 1 }, (_, i) => feedProducts({ page: i + 2 }))
  );
  const rows = [first, ...rest].flatMap((r) => r.rows);

  const body = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0">
<channel>
<title>پت‌شاپ پت‌باس</title>
<link>${absoluteUrl('/shop')}</link>
<description>محصولات پت‌شاپ کلینیک دامپزشکی پت‌باس</description>
${rows.map(toGoogleItem).join('\n')}
</channel>
</rss>`;
  return new Response(body, { headers: { 'Content-Type': 'application/xml; charset=utf-8' } });
}
