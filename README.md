# Pet Boss Clinic (پت‌باس)

[![CI](https://github.com/Sadramst/PetBossClinic/actions/workflows/ci.yml/badge.svg)](https://github.com/Sadramst/PetBossClinic/actions/workflows/ci.yml)
[![E2E Tests](https://github.com/Sadramst/PetBossClinic/actions/workflows/e2e.yml/badge.svg)](https://github.com/Sadramst/PetBossClinic/actions/workflows/e2e.yml)
[![Lighthouse CI](https://github.com/Sadramst/PetBossClinic/actions/workflows/lighthouse.yml/badge.svg)](https://github.com/Sadramst/PetBossClinic/actions/workflows/lighthouse.yml)
[![Framework](https://img.shields.io/badge/Next.js-15-black?logo=next.js)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-19-blue?logo=react)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-blue?logo=typescript)](https://www.typescriptlang.org/)
[![TailwindCSS](https://img.shields.io/badge/Tailwind-v4-38bdf8?logo=tailwind-css)](https://tailwindcss.com/)
[![Prisma](https://img.shields.io/badge/Prisma-6-2d3748?logo=prisma)](https://www.prisma.io/)

Farsi-only (RTL) website for an Iranian veterinary clinic in Gheitariyeh, Tehran, combined with an online pet shop and a full CRM. Brand: charcoal and gold luxury theme.

## What it is
| Area | What exists |
|---|---|
| Public site | Services, divisions, staff, FAQ, blog, legal pages, SEO feeds (sitemap, Torob, Google, RSS, IndexNow) |
| Shop | Catalogue, brands, cart, checkout, ZarinPal and cash on delivery, coupons, expiry-aware stock (FEFO batches) |
| Customer portal `/account` | Phone and password login with SMS OTP, orders, addresses, pets, club points and tiers, rewards, referrals, coupons |
| CRM | One identity per person (Contact), leads pipeline, tasks, support inbox with SLA, customer 360 with timeline, health and churn, duplicates and merge, CSV import and export, saved views, reports |
| Marketing | Segments, SMS campaigns, automations, outbox with consent and STOP, abandoned carts, AI suggestions (optional) |
| Admin `/admin` | About 25 modules in 6 groups, command palette (Ctrl+K), notifications, role-based dashboard, audit log, theme studio |

Not built yet: online appointment booking, admin 2FA, roles RECEPTION and VET, clearance pricing, product reviews. See `docs/roadmap.md`.

## Stack
Next.js 15 (App Router), React 19, TypeScript, Tailwind v4, Prisma 6 on PostgreSQL, next-intl (Farsi only, no URL prefix), zod, server actions. Hosting: Vercel (region fra1, daily crons). Tests: Vitest and Playwright.

## Quick start
```bash
npm install
cp .env.example .env          # fill DATABASE_URL, DIRECT_URL, AUTH_SECRET, INITIAL_ADMIN_*
npx prisma generate
npx prisma db push            # local dev database only
npm run db:seed               # DEV ONLY: it deletes and recreates content tables
npm run dev                   # http://localhost:3000, admin at /admin
```
Catalogue import: `node scripts/import-october-inventory.js` then `npx tsx scripts/assign-brands.ts --apply`.

## Scripts
| Command | Purpose |
|---|---|
| `npm run dev` / `build` / `start` | Develop, production build (runs `scripts/release-db.mjs`), serve |
| `npm run typecheck` / `lint` | tsc and eslint |
| `npm test` | Vitest unit and integration (integration needs a local Postgres) |
| `npm run test:e2e` | Playwright (desktop and Pixel 5, locale fa-IR) |
| `npm run test:all` | typecheck, lint, tests, build, e2e in order (`-- --skip-e2e` for fast checks) |
| `npm run seo:indexnow` | Ping IndexNow with all URLs |

## Environment
Copy `.env.example`. Key variables: `DATABASE_URL`, `DIRECT_URL`, `AUTH_SECRET`, `CRON_SECRET`, `INITIAL_ADMIN_EMAIL`, `INITIAL_ADMIN_PASSWORD`, `SMS_PROVIDER` (kavenegar, smsir, console) with provider keys, `SMS_INBOUND_SECRET`, `ZARINPAL_MERCHANT_ID`, `ZARINPAL_SANDBOX`, `SHIPPING_*`, optional `ANTHROPIC_API_KEY`, optional analytics ids. Never commit real values. Details in `docs/infra.md`.

## Project map
```
app/[locale]/(shop|account|content|legal|marketing|clinic)/  public site and portal
app/[locale]/admin/            admin and CRM pages
app/actions/                   'use server' actions (requireAdmin + zod + logAdminChange)
app/api/                       cron/{club,expiry}, indexnow, media/[key], payment/zarinpal, sms/inbound
components/ui, components/admin/kit   design system
lib/crm lib/club lib/marketing lib/shop lib/customer lib/sms lib/payments lib/seo   domain logic
prisma/                        schema, SQL migrations, seed
scripts/                       release-db, test-all, imports
tests/{unit,integration,e2e}   plus __tests__/components
```

## Documentation
Start at `docs/README.md`. Product docs: `docs/product/`. Owner guide: `docs/owner-checklist.md`.

## Clinic details
- Address: تهران، خیابان شریعتی، بالاتر از پل صدر، نرسیده به ایستگاه مترو قیطریه، پلاک ۱۷۳۳
- GPS: `35.790937, 51.4350853`
- Hours: همه روزه ۱۰:۰۰ تا ۲۲:۰۰
- Phone: `+982126429715`
