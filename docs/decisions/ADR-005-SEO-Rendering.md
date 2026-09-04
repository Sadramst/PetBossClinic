# ADR 005: SEO-First Server-Side Rendering (SSR) & Static Generation Strategy

- **Status:** Accepted
- **Deciders:** Product Strategy Manager, Senior Software Architect
- **Date:** 2026-09-04

---

## Context
Pet Boss Clinic's primary acquisition channel in Tehran is organic search and Google Ads for high-intent veterinary and grooming keywords (e.g., *کلینیک دامپزشکی قیطریه*, *آرایشگاه سگ و گربه شمال تهران*).

Key constraints:
- Search engine crawlers (Googlebot, regional search engines) must receive 100% pre-rendered HTML on the initial HTTP response.
- JSON-LD structured data (`VeterinaryCare`, `LocalBusiness`, `FAQPage`, `Product`) must be embedded within the HTML document `<head>`.
- Client-side rendering (CSR) must be strictly confined to interactive UI elements (theme toggler, interactive tabs, form validations).

## Decision
All public customer-facing routes (`/`, `/services`, `/services/[slug]`, `/about`, `/contact`, `/faq`, `/shop`, `/blog`, `/lp/[slug]`) are rendered using **Server-Side Rendering (SSR)** or **Static Site Generation (SSG)** with Incremental Static Regeneration (ISR).

Administrative back-office routes (`/admin/*`) explicitly enforce dynamic rendering (`export const dynamic = 'force-dynamic'`) to guarantee real-time data freshness without static generation errors.

## Consequences
### Positive
- **Instant Search Indexing:** Search spiders parse complete textual content, heading hierarchies (`<h1>`, `<h2>`), canonical links, and hreflang annotations on the first crawl pass.
- **Rich Snippets & Google SERP Features:** Pre-rendered JSON-LD schema unlocks rich question/answer accordion snippets in search results.
- **Superior CWV Performance:** Eliminates render-blocking JavaScript bundles on mobile connections, driving down First Contentful Paint (FCP) and Time to Interactive (TTI).

### Negative / Trade-offs
- Build time in CI increases with large numbers of statically generated pages.
- Server components cannot utilize browser-only React hooks (`useState`, `useEffect`) directly; interactive widgets must be isolated into lightweight `'use client'` sub-components.

## Alternatives Considered
- **Client-Side Rendering (SPA):** Disqualified immediately; Googlebot and Persian search engines exhibit significant indexing delays or complete failures when evaluating dynamic JavaScript-dependent content.
