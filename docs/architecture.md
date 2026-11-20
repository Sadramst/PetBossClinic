# Architecture

## Layers
```
Browser (Farsi, RTL)
  |
middleware.ts   legacy /en and /fa 301 redirect, admin session check at the edge (Web Crypto, ADR-007)
  |
app/[locale]  storefront (shop), customer portal (account), content (blog), legal, marketing, clinic, admin
  |  server components + 'use server' actions in app/actions/*
lib/*   domain logic: shop, club, marketing, crm, customer, sms, payments, seo, theme, audit
  |
Prisma 6  ->  PostgreSQL
Jobs: Vercel crons /api/cron/expiry (daily 21:30) and /api/cron/club (daily 06:05), both need CRON_SECRET
Integrations: ZarinPal (/api/payment/zarinpal), SMS provider (lib/sms, inbound /api/sms/inbound), IndexNow, Torob and Google feeds (/feeds/*), optional Anthropic API
```
Locale: Farsi only, `localePrefix: never` (ADR-010). Font: Vazirmatn. Dates Jalali (`lib/date`), money Toman.

## Module map
| Folder | Responsibility |
|---|---|
| `lib/shop` | Catalogue rules, FEFO batches and expiry (`expiry.ts`, `expiry-config.ts`), orders and allocation, inventory admin |
| `lib/club` | Pets, points ledger, tiers, rewards, referrals, segments, hooks that fire on order or visit |
| `lib/marketing` | Coupons, groups, campaigns, automations, outbox worker |
| `lib/crm` | Contact identity, leads, tasks, tickets, activity, lifecycle, health, merge, dedupe, import, export, reports, saved views, staff notifications |
| `lib/auth`, `lib/customer` | Admin and customer HMAC sessions, scrypt hashes, role guard |
| `components/admin/kit` | Admin design system |

## Trust boundaries
- Admin: cookie `petboss_session`, roles SUPER_ADMIN > ADMIN > EDITOR > AUTHOR > VIEWER, `requireAdmin(minRole)`; 5 failed logins lock the account; every change is logged with `logAdminChange` to `AuditLog`.
- Customer: `requireCustomer`, OTP and login rate limits (in-memory, ADR-008 debt).
- Public endpoints (lead form, STOP webhook, payment callback) validate with zod and rate limit. Cron routes require `CRON_SECRET`.
- Server action convention: `requireAdmin` + zod + rate limit + `logAdminChange` + `revalidatePath`; result type `{ ok: true, data } | { ok: false, error }`.
- Media is stored in PostgreSQL (`Media`) and served by `/api/media/[key]`.

## Release pipeline
PR to `main` runs CI (typecheck, lint, tests with a Postgres service, e2e, Lighthouse). Merge to `main` deploys on Vercel; the build runs `scripts/release-db.mjs` (ADR-015).
