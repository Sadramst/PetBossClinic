# ADR 001: Adoption of Next.js 15 App Router

- **Status:** Accepted
- **Deciders:** Product Strategy Manager, Senior Software Architect
- **Date:** 2026-09-04

---

## Context
Pet Boss Clinic requires a bilingual (Farsi-first, English-second) high-performance web platform combining medical clinic service discovery, pet shop e-commerce showcase, lead generation, and an internal administrative back office. 

Key constraints:
- Must achieve fast First Contentful Paint (FCP) and Largest Contentful Paint (LCP) for mobile visitors in Iran and abroad.
- Must render full semantic HTML for Google and Persian search engines without relying on client-side hydration.
- Must seamlessly support localized dynamic routing with RTL (Right-to-Left) and LTR (Left-to-Right) layout trees.

## Decision
We adopted **Next.js 15** utilizing the **App Router (`app/[locale]/...`)** and React 19 Server Components.

## Consequences
### Positive
- **Search Engine Visibility:** Server-side rendering (SSR) and Static Site Generation (SSG) emit pristine HTML with pre-rendered JSON-LD schema markup.
- **RTL/LTR Separation:** Root layout dynamically sets `dir="rtl"` and `dir="ltr"` along with localized metadata and font classes at the server root.
- **Edge Deployment:** Native edge middleware enables fast sub-millisecond locale routing and cookie-based theme injection without layout shift.
- **Developer Productivity:** Server actions reduce boilerplate by allowing type-safe mutations directly from React components.

### Negative / Trade-offs
- Strict caching policies in Next.js 15 require explicit opt-outs (`export const dynamic = 'force-dynamic'`) for authenticated administrative modules.
- Upgrading to React 19 RC requires ensuring test dependencies (Vitest, JSDOM) maintain compatible peer-dependency resolutions.

## Alternatives Considered
- **Vite + React SPA:** Rejected due to poor SEO crawler execution in regional Persian search engines and lack of edge SSR.
- **Remix / React Router 7:** Viable, but Next.js offered superior native edge deployment integration on Vercel and better ecosystem documentation.
