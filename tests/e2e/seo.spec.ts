import { test, expect } from '@playwright/test';

const CANON = 'https://www.petbossclinic.com';

function schemaNodes(contents: string[]): Array<Record<string, unknown>> {
  return contents
    .map((s) => {
      try {
        return JSON.parse(s);
      } catch {
        return null;
      }
    })
    .filter(Boolean)
    .flatMap((j) => (Array.isArray(j) ? j : [j]));
}

async function robotsContent(page: import('@playwright/test').Page): Promise<string> {
  const el = page.locator('meta[name="robots"]');
  return (await el.count()) ? ((await el.first().getAttribute('content')) ?? '') : '';
}

test.describe('technical SEO across the Farsi site', () => {
  test('homepage declares fa-IR, a canonical URL, and core structured data', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });

    await expect(page.locator('html')).toHaveAttribute('lang', 'fa-IR');
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', /^https:\/\/www\.petbossclinic\.com\/?$/);
    await expect(page.locator('meta[name="viewport"]')).toHaveCount(1);

    const title = await page.title();
    expect(title.length).toBeLessThanOrEqual(75);
    expect(title).toContain('پت‌باس');

    const nodes = schemaNodes(await page.locator('script[type="application/ld+json"]').allTextContents());
    const types = nodes.map((n) => n['@type']);
    expect(types).toContain('Organization');
    expect(types).toContain('WebSite');
    expect(types).toContain('VeterinaryCare');

    const website = nodes.find((n) => n['@type'] === 'WebSite') as {
      inLanguage?: string;
      potentialAction?: { target?: { urlTemplate?: string } };
    };
    expect(website.inLanguage).toBe('fa-IR');
    expect(website.potentialAction?.target?.urlTemplate).toContain('/shop?q={search_term_string}');
  });

  test('every static page has a unique, short title and a self-canonical', async ({ page }) => {
    const routes: Array<[string, string]> = [
      ['/shop', '/shop'],
      ['/services', '/services'],
      ['/about', '/about'],
      ['/contact', '/contact'],
      ['/faq', '/faq'],
      ['/blog', '/blog'],
    ];
    const titles = new Set<string>();

    for (const [path, canonicalPath] of routes) {
      await page.goto(path, { waitUntil: 'domcontentloaded' });

      const title = await page.title();
      expect(title.length, `${path} title is too long: ${title}`).toBeLessThanOrEqual(75);
      expect(title, `${path} title misses the brand`).toContain('پت‌باس');
      expect(titles.has(title), `duplicate title for ${path}: ${title}`).toBe(false);
      titles.add(title);

      await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', `${CANON}${canonicalPath}`);

      const description = (await page.locator('meta[name="description"]').getAttribute('content')) ?? '';
      expect(description.length, `${path} description is too long`).toBeLessThanOrEqual(165);
      expect(description.length, `${path} description is too short`).toBeGreaterThan(40);

      expect(await page.locator('h1').count(), `${path} should have exactly one h1`).toBe(1);
      expect(await robotsContent(page)).not.toContain('noindex');
    }
  });

  test('titles do not repeat the brand twice (the old template bug)', async ({ page }) => {
    await page.goto('/services', { waitUntil: 'domcontentloaded' });
    const title = await page.title();
    expect(title.match(/پت‌باس/g)?.length ?? 0).toBeLessThanOrEqual(1);
    expect(title).not.toMatch(/کلینیک دامپزشکی پت باس تهران\s*\|/);
  });

  test('filtered/sorted listings are noindex and canonicalise to the clean listing', async ({ page }) => {
    await page.goto('/shop?q=' + encodeURIComponent('غذا'), { waitUntil: 'domcontentloaded' });
    expect(await robotsContent(page)).toContain('noindex');
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', `${CANON}/shop`);

    await page.goto('/shop?sort=price-asc', { waitUntil: 'domcontentloaded' });
    expect(await robotsContent(page)).toContain('noindex');
  });

  test('category and product pages expose ItemList, Product, and BreadcrumbList schema', async ({ page }) => {
    await page.goto('/shop', { waitUntil: 'domcontentloaded' });

    const categoryLink = page.locator('main a[href^="/shop/"]').first();
    await expect(categoryLink).toBeVisible();
    const categoryHref = await categoryLink.getAttribute('href');
    await categoryLink.click();
    await expect(page).toHaveURL(/\/shop\/[^/?]+/, { timeout: 20000 });

    // Reload so the head contains only this page's metadata (client navigation
    // keeps the previous page's canonical link until the route settles).
    await page.goto(page.url(), { waitUntil: 'domcontentloaded' });
    const categoryCanonical = await page.locator('link[rel="canonical"]').getAttribute('href');
    expect(categoryCanonical).toBe(`${CANON}${categoryHref}`);
    let nodes = schemaNodes(await page.locator('script[type="application/ld+json"]').allTextContents());
    expect(nodes.map((n) => n['@type'])).toContain('ItemList');
    expect(nodes.map((n) => n['@type'])).toContain('BreadcrumbList');

    const productLink = page.locator('article a[href^="/product/"]').first();
    await expect(productLink).toBeVisible();
    await productLink.click();
    await expect(page).toHaveURL(/\/product\//, { timeout: 20000 });

    // Reload so head tags are the ones a crawler receives.
    await page.goto(page.url(), { waitUntil: 'domcontentloaded' });
    const canonical = await page.locator('link[rel="canonical"]').getAttribute('href');
    expect(canonical).toMatch(new RegExp(`^${CANON}/product/`));

    nodes = schemaNodes(await page.locator('script[type="application/ld+json"]').allTextContents());
    const product = nodes.find((n) => n['@type'] === 'Product') as {
      brand?: { name?: string };
      offers?: { priceCurrency?: string; price?: number; availability?: string };
      image?: string[];
    };
    expect(product).toBeTruthy();
    expect(product.offers?.priceCurrency).toBe('IRR');
    expect(product.offers?.availability).toMatch(/schema\.org\/(InStock|LimitedAvailability|OutOfStock|BackOrder)/);
    if (product.offers?.price !== undefined) expect(product.offers.price).toBeGreaterThan(0);
    expect(Array.isArray(product.image)).toBe(true);
    expect(nodes.map((n) => n['@type'])).toContain('BreadcrumbList');
  });

  test('service detail pages expose Service, FAQ and Breadcrumb schema', async ({ page, request }) => {
    const listing = await (await request.get('/services')).text();
    const href = /href="(\/services\/[^"?]+)"/.exec(listing)?.[1];
    expect(href, 'a service detail link should exist on /services').toBeTruthy();

    await page.goto(href!, { waitUntil: 'domcontentloaded' });
    await expect(page.locator('h1')).toBeVisible();
    expect((await page.title()).length).toBeLessThanOrEqual(75);
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', `${CANON}${href}`);
    expect(await robotsContent(page)).not.toContain('noindex');

    const nodes = schemaNodes(await page.locator('script[type="application/ld+json"]').allTextContents());
    const types = nodes.map((n) => n['@type']);
    expect(types).toContain('Service');
    expect(types).toContain('FAQPage');
    expect(types).toContain('BreadcrumbList');

    const service = nodes.find((n) => n['@type'] === 'Service') as {
      url?: string;
      offers?: { priceCurrency?: string };
    };
    expect(service.url).toBe(`${CANON}${href}`);
    if (service.offers) expect(service.offers.priceCurrency).toBe('IRR');
  });

  test('brand pages are indexable and canonical', async ({ page }) => {
    await page.goto('/shop', { waitUntil: 'domcontentloaded' });
    // Crawlers follow links whether or not a panel is collapsed for people (the brand list
    // sits in a collapsible filter panel on phones), so presence in the page is what matters.
    const brandLink = page.locator('a[href^="/brand/"]').first();
    await expect(brandLink).toBeAttached();
    const href = await brandLink.getAttribute('href');
    await page.goto(href!, { waitUntil: 'domcontentloaded' });
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', `${CANON}${href}`);
    expect(await robotsContent(page)).not.toContain('noindex');
    const nodes = schemaNodes(await page.locator('script[type="application/ld+json"]').allTextContents());
    expect(nodes.map((n) => n['@type'])).toContain('ItemList');
  });

  test('404s are Farsi, noindex, and no longer claim the homepage canonical', async ({ page }) => {
    const response = await page.goto('/this-page-does-not-exist-' + Date.now(), {
      waitUntil: 'domcontentloaded',
    });
    expect(response?.status()).toBe(404);
    await expect(page.locator('h1')).toContainText('صفحه پیدا نشد', { timeout: 20000 });
    await expect(page).toHaveTitle(/صفحه پیدا نشد/, { timeout: 10000 });
    expect(await robotsContent(page)).toContain('noindex');
    expect(await page.locator('link[rel="canonical"]').count()).toBe(0);
  });

  test('robots.txt and sitemap.xml advertise the canonical host and no English URLs', async ({ request }) => {
    const robots = await (await request.get('/robots.txt')).text();
    expect(robots).toContain('Sitemap: https://www.petbossclinic.com/sitemap.xml');
    expect(robots).toContain('Disallow: /admin');
    expect(robots).toContain('Allow: /api/media/');

    const sitemapRes = await request.get('/sitemap.xml');
    expect(sitemapRes.ok()).toBeTruthy();
    const sitemap = await sitemapRes.text();
    expect(sitemap).toContain('https://www.petbossclinic.com/product/');
    expect(sitemap).toContain('https://www.petbossclinic.com/shop/');
    expect(sitemap).toContain('https://www.petbossclinic.com/brand/');
    expect(sitemap).toContain('https://www.petbossclinic.com/services/');
    expect(sitemap).not.toContain('/en/');
    expect(sitemap).not.toContain('/admin');
  });

  test('retired English URLs permanently redirect to Farsi and no hreflang remains', async ({ page }) => {
    await page.goto('/en/shop', { waitUntil: 'domcontentloaded' });
    await expect(page).toHaveURL(/\/shop$/);
    expect(await page.locator('link[rel="alternate"][hreflang="en"]').count()).toBe(0);
    expect(await page.locator('link[rel="alternate"][hreflang="fa-IR"]').count()).toBe(0);
  });
});
