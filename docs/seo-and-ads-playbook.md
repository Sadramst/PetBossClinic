# SEO, Growth and Attribution

Companion checklist for owners: [search-visibility-playbook.md](./search-visibility-playbook.md).

## What is built
- Farsi only: no hreflang; metadata emits canonical only (`lib/seo/metadata.ts`).
- Sitemap (`app/sitemap.ts`): static pages, categories, brands, products, blog posts, services.
- JSON-LD (`lib/seo/json-ld.tsx`): Organization, LocalBusiness, BreadcrumbList, FAQPage, Service, Product (Toman converted to IRR). No AggregateRating yet.
- Feeds: `/feeds/torob`, `/feeds/products.xml` (priced products only, `X-Robots-Tag: noindex`), `/feed.xml` RSS.
- IndexNow: key file in `public/`, `npm run seo:indexnow`, `/api/indexnow`. Not automatic on publish.
- robots: disallows `/admin`, `/api/`, `/account`, `/cart`, `/checkout`. Feeds are not blocked.
- Search Console and GA4 ids come from Admin, Settings or env; scripts load `afterInteractive`.
- UTM capture: `Lead` stores `utmSource`, `utmMedium`, `utmCamp`, `utmTerm` (no `utm_content`).

## Not built
`/lp/[slug]` landing pages (the `LandingPage` model exists, no route); GA4 conversion events (call, WhatsApp, directions, lead_submit, purchase); UTM on Customer and Order; AggregateRating; blog category archives; automatic IndexNow ping; Core Web Vitals monitoring (no measurements in the repo).

## Keyword map (Persian, north Tehran focus)
| Intent | Target page |
|---|---|
| دامپزشکی قیطریه، کلینیک دامپزشکی شمال تهران | Home, Contact |
| جراحی، دندانپزشکی، بستری و پانسیون حیوانات | Service pages |
| خرید غذای گربه و سگ، لوازم پت‌شاپ | Shop categories and brands |
| راهنمای خرید و نگهداری | Blog (buying guides per top category) |

## Attribution plan
UTM on every external link, then Lead, then Customer, then Order, then source and revenue in Admin reports (R2). Reviews: request through an SMS automation after an order or visit, never fabricate reviews.
