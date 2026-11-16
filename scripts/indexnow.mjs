/**
 * Submit the live sitemap to IndexNow (Bing, Yandex, Seznam, Naver).
 * Google does not use IndexNow; use Search Console for Google.
 *
 * Usage: npm run seo:indexnow
 * Requires the key file to be deployed at https://www.petbossclinic.com/<key>.txt
 */
const KEY = 'c58334f836c64678963a14c4ea58c8c0';
const HOST = 'www.petbossclinic.com';
const SITE = `https://${HOST}`;
const KEY_LOCATION = `${SITE}/${KEY}.txt`;
const ENDPOINT = 'https://api.indexnow.org/indexnow';
const MAX_URLS = 10000;

async function main() {
  const sitemapRes = await fetch(`${SITE}/sitemap.xml`, { headers: { 'Cache-Control': 'no-cache' } });
  if (!sitemapRes.ok) throw new Error(`sitemap fetch failed: ${sitemapRes.status}`);
  const xml = await sitemapRes.text();
  const urls = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]).slice(0, MAX_URLS);
  if (urls.length === 0) throw new Error('no URLs found in sitemap');

  console.log(`Submitting ${urls.length} URLs to IndexNow…`);
  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify({ host: HOST, key: KEY, keyLocation: KEY_LOCATION, urlList: urls }),
  });

  const body = await res.text();
  console.log(`IndexNow status: ${res.status}${body ? ` — ${body}` : ''}`);
  if (![200, 202].includes(res.status)) process.exitCode = 1;
}

main().catch((err) => {
  console.error(err.message);
  process.exitCode = 1;
});
