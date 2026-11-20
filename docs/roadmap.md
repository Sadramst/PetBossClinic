# Roadmap

Shipped: shop, checkout, ZarinPal, customer portal, club, coupons and marketing, outbox and automations, blog and SEO feeds, and the R1 CRM (identity, leads, tasks, inbox, customer 360, merge, import, reports, dashboard, command palette, expiry rework). Status per story: [product/BACKLOG.md](./product/BACKLOG.md).

## R1 leftovers (finish first)
- Orders list and detail on the kit (server pagination, timeline, refund notes, packing slip).
- Product editor: expiry block, SEO fields, split `products-manager.tsx`; Brands and Categories screens.
- Move remaining content managers to the kit and strip English strings; `?new=1` for customers and orders.
- Expiry: listing-card near-expiry badge, sale cutoff driven by `ExpiryConfig.minShelfLifeDays`, expiry tab in reports.
- Campaign results view; Playwright specs for new CRM testids; per-route loading and error boundaries.

## R2
Appointments (public booking, calendar, SMS reminders, visit and points on completion); roles RECEPTION and VET with permission keys; TOTP 2FA for admin; clearance pricing per batch; product reviews and NPS automation; first-touch UTM on customer and order.

## R3
Customer ticket thread in /account; returns, refunds, invoices, shipment tracking; suppliers, cost price, margins.

## Ops and quality debt
- `/api/health` endpoint; confirm production DB host, backups with offsite copy and a restore test (`infra/backup.sh` has no upload).
- Distributed rate limiting (ADR-008); secret rotation policy.
- Replace `db-migrate.yml` `prisma db push` with the additive path; remove dormant `next-auth` dependency, `messages/en.json`, `nameEn`, `slugEn`, legacy stub models.
- Test coverage script and targets; Lighthouse budgets.

## Business and content
Real vet licences and photography; price review; prices for unpriced products; blog publishing; Google Business Profile and directory listings; DMARC tightening; GA4 conversion events; `/lp/[slug]` landing pages; AggregateRating from real reviews; eNamad.
