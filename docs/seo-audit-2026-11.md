# SEO audit and fixes — November 2026

Scope: the whole Farsi storefront — home, shop, 16 category pages, 21 brand pages,
723 product pages, blog index/posts, services, about, contact, FAQ, sitemap,
robots.txt, RSS and the Torob/Google product feeds.

Baseline measured on the live site before this pass:

| Area | Before |
| --- | --- |
| Sitemap | 767 URLs (723 products, 21 brands, 16 categories, 7 static) |
| Home title | 69 chars, OK |
| About / Services / FAQ / Contact titles | 92–100 chars, brand repeated twice |
| Meta descriptions | 222–343 chars on home/shop/services/contact/FAQ/about |
| `lang` | `fa` |
| 404 page | English, inherited the homepage canonical |
| Product rich results | price in IRR, but zero-price products still emitted an Offer |
| Google feed | emitted `<g:price>0 IRR</g:price>` for 177 products |
| Price sorting | zero-price products led “cheapest first” listings |

## What changed

### 1. One metadata builder for every public page
`lib/seo/metadata.ts` now produces the title, description, canonical, Open Graph,
Twitter card and robots directives for every page. It:

- keeps titles ≤ 70 characters and appends the brand only once;
- clamps descriptions to 160 characters at a word boundary;
- always emits an **absolute** canonical;
- never emits a canonical for 404s (the old locale-layout canonical leaked to
  every page without its own metadata);
- builds `og:type=article` with published/modified dates for blog posts.

`lib/seo/site.ts` holds the canonical origin and brand constants.

### 2. Titles and descriptions rewritten
| Page | New title | Length |
| --- | --- | --- |
| Home | پت‌شاپ و کلینیک دامپزشکی پت‌باس در تهران \| خرید لوازم سگ و گربه | 63 |
| Shop | پت‌شاپ آنلاین پت‌باس \| خرید غذای سگ و گربه در تهران | 51 |
| Services | خدمات دامپزشکی پت‌باس \| واکسیناسیون، جراحی و گرومینگ | 52 |
| About | درباره کلینیک دامپزشکی پت‌باس \| تیم و شعبه قیطریه | 49 |
| Contact | تماس با کلینیک پت‌باس \| آدرس و تلفن قیطریه تهران | 48 |
| FAQ | سوالات متداول دامپزشکی \| کلینیک پت‌باس تهران | 44 |
| Blog | مجله پت‌باس \| راهنمای تغذیه و سلامت سگ و گربه | 45 |

Product, category and brand titles are composed from the entity name with the
brand suffix protected from truncation.

### 3. Structured data
- `Organization`: address, phone, email, area served, map, Instagram/Telegram.
- `WebSite`: `inLanguage: fa-IR` and a `SearchAction` pointing at `/shop?q=…`
  (sitelinks searchbox).
- `VeterinaryCare`: currency, payment methods, map `sameAs`.
- `Product`: `sku`+`mpn`, GTIN when valid, brand, weight, attribute
  `additionalProperty`, IRR offer, availability. No `price` is emitted for
  call-for-price products.
- `Article`: fallback image, publisher logo, author, section and keywords.
- `AboutPage` and `ContactPage` nodes; `ItemList` on the homepage and blog index.
- Every entity keeps using `safeJsonLd`, which escapes `<`, `>`, `&` so a product
  name can never break out of the script tag.

### 4. 404 handling
- Added `app/[locale]/not-found.tsx` (Farsi 404 with links to shop/services/blog/contact).
- Added `app/[locale]/[...rest]/page.tsx` so unknown top-level URLs use that boundary.
- The 404 keeps HTTP 404, `noindex`, no canonical, a Farsi title and a Farsi h1.
- `DocumentTitle`/`DocumentRobots` keep the tab title and `noindex` correct after
  hydration (Next replays the layout metadata otherwise).

### 5. Language and browser signals
- `<html lang="fa-IR" dir="rtl">`.
- `viewport` export with `themeColor`, width, colour scheme; removed the duplicate
  hand-written viewport/icon tags.
- `Content-Language: fa-IR` on public HTML responses.
- Farsi web app manifest (name, description, `lang`, `dir`, categories, shortcuts).
- `formatDetection.telephone: false` so iOS does not turn Iranian numbers into links.

### 6. Sitemap and robots
- Sitemap keeps the clean static pages, categories, brands, products and blog
  posts; adds category/brand images, excludes `noindex` products, and keeps the
  homepage image.
- robots.txt allows `/api/media/` for Google Images, blocks `/admin`, `/api/`,
  `/account`, `/cart`, `/checkout` and `/feeds/`, and points at the sitemap.
- `/en/*` and `/fa/*` still 301 to the Farsi URL; the sitemap contains no English URLs.

### 7. Product feeds
- Google-style feed skips call-for-price products instead of publishing `0 IRR`,
  and emits `sale_price` when a compare price exists.
- Torob v3 JSON feed is unchanged (it correctly reports `outofstock`/`0` for those items).

### 8. Zero-price listing bug
177 of 723 products have `price = 0` (118 of 119 in-stock cat products). They used
to lead `?sort=price-asc`, so the first page showed only “تماس بگیرید”. Price and
discount sorts now exclude unpriced items from the query and pagination.

## Files changed

- `lib/seo/metadata.ts` (new), `lib/seo/site.ts`, `lib/seo/json-ld.tsx`
- `app/[locale]/layout.tsx`, `app/[locale]/page.tsx`
- `app/[locale]/(shop)/shop/page.tsx`, `.../shop/[category]/page.tsx`,
  `.../brand/[slug]/page.tsx`, `.../product/[slug]/page.tsx`
- `app/[locale]/(content)/blog/page.tsx`, `.../blog/[slug]/page.tsx`
- `app/[locale]/(marketing)/about|contact|faq/page.tsx`,
  `app/[locale]/(clinic)/services/page.tsx`
- `app/[locale]/not-found.tsx` (new), `app/[locale]/[...rest]/page.tsx` (new),
  `components/seo/document-title.tsx` (new)
- `app/sitemap.ts`, `app/robots.ts`, `app/manifest.ts`, `middleware.ts`
- `lib/shop/listing-meta.ts`, `lib/shop/filters.ts`, `lib/shop/feeds.ts`,
  `app/feeds/products.xml/route.ts`
- `tests/unit/seo-metadata.test.tsx` (new), `tests/e2e/seo.spec.ts` (new),
  `tests/e2e/shop-search-filters.spec.ts` (hydration fix)

## Verification

```bash
npm run typecheck
npm run lint
npx vitest run -c vitest.config.mts tests/unit
npx playwright test tests/e2e/seo.spec.ts --project=chromium-rtl
npm run build
```

Results at the time of writing:

- TypeScript: clean
- ESLint: clean
- Unit tests: 113 passed (18 files), including 15 new SEO tests
- SEO e2e: 36 passed (9 tests × desktop/mobile × LTR/RTL)
- Full read-only e2e: 92 passed across 4 Playwright projects
- Production build: succeeded (44 static pages; sitemap and robots generated)
- Server audit: sitemap 767 URLs (723 products, 21 brands, 16 categories,
  7 static), Google feed 546 priced items, 0 invalid `0 IRR` entries, Torob 723,
  `/en/*` 301, private areas `noindex`, `Content-Language: fa-IR`

## Manual steps that need account access

These cannot be done from the codebase:

1. **Google Search Console** — verify the property with the code in
   Admin → تنظیمات سایت → «گوگل و سئو», then submit
   `https://www.petbossclinic.com/sitemap.xml`. Use URL Inspection on `/`, `/shop`,
   `/services` and the top 10 products after deploying.
2. **Bing Webmaster Tools** — import from Search Console or paste the Bing code in
   the same admin screen; submit the sitemap.
3. **Google Merchant Center** — add `https://www.petbossclinic.com/feeds/products.xml`.
   The feed currently excludes the 177 unpriced products.
4. **Torob** — the seller panel URL is `https://www.petbossclinic.com/feeds/torob`
   (Torob API v3, JSON; GET `?page=N` or POST `page_urls`).
5. **Emalls / other Iranian comparison sites** — point them at the same
   `products.xml` RSS feed.
6. **Publish the 3 draft blog posts** — the sitemap has no `/blog/...` URLs because
   nothing is published yet; publishing activates Article schema, the blog index
   and RSS items.
7. **Enter prices for the 177 products** (especially the cat catalogue). This is the
   single biggest remaining SEO/commercial gap: without a price there is no Google
   product rich result and no shopping-feed listing.
8. **eNamad and SMS/payment** — as described in `docs/shop-redesign-operations.md`.

## Suggested next content work

- One buying-guide article per top category (غذای خشک گربه، غذای خشک سگ، خاک گربه، …)
  linking to the category and 3–6 products.
- Collect verified reviews, then add `AggregateRating` to Product schema.
- Replace the noindex blog `?category=` filter with real `/blog/category/<slug>`
  archive pages when there are enough posts to justify them.
- Track Core Web Vitals in Search Console after the deploy; the home page currently
  has ~1.4k words, one h1, 15 h2 and 183 internal links, and all images have alt text.
- If Iranian search engines matter for this audience, submit the sitemap to
  Parsijoo and Yooz as well (both accept a sitemap URL in their webmaster panels).
