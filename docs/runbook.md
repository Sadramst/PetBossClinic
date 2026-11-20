# Operations Runbook

## 1. Release
1. Open a PR; CI must pass. Locally run `npm run test:all`.
2. Merge to `main`; Vercel builds. `npm run build` runs `scripts/release-db.mjs`, which on production applies unapplied SQL migrations (additive only, in a transaction). Any failure blocks the release and the old site stays live.
3. Verify with the smoke list in `test-flow.md` section 6. (There is no `/api/health`; it is on the roadmap.)

Warning: `.github/workflows/db-migrate.yml` runs a manual `prisma db push` against `PROD_DATABASE_URL`. `db push` can be destructive; prefer the release step.

## 2. Database
- Migrations: add a folder in `prisma/migrations`, keep `schema.prisma` in sync by hand, make SQL idempotent.
- Seed: `prisma/seed.ts` runs `deleteMany` on content tables. NEVER run it on production.
- Rollback of a bad migration: promote the previous Vercel deployment (code), then write a new additive migration that fixes forward; restore a backup only for data loss.
- Backups: see `infra.md` (unverified). Restore into a scratch database first and check row counts.

## 3. Scheduled jobs
`/api/cron/expiry` (daily 21:30) syncs stock and sends the expiry digest; `/api/cron/club` (daily 06:05) runs club tasks, the CRM daily job (lifecycle, health, auto-tasks), automations and the outbox. Vercel Hobby allows daily only. Both need `CRON_SECRET`; test with `curl -H "Authorization: Bearer $CRON_SECRET" <url>`; no header returns 401.

## 4. SMS outbox
Admin, Outbox shows QUEUED, FAILED and SKIPPED rows. A stuck queue: check `SMS_PROVIDER` and keys, then use the process button. To stop sending, set `SMS_PROVIDER=console` and redeploy, or cancel queued rows. Marketing messages respect consent; a STOP reply (inbound webhook with `SMS_INBOUND_SECRET`) revokes it. Provider outage: rows stay FAILED and retry; do not re-queue by hand.

## 5. Payments
ZarinPal callback is `/api/payment/zarinpal`. During an outage customers can pay cash on delivery in Tehran. A late payment on a cancelled order is flagged "نیاز به بازگشت وجه": refund through the ZarinPal panel and note it on the order.

## 6. Access and secrets
- Rate-limit lockouts: admin and customer logins lock after repeated failures for 15 minutes (in-memory, resets on redeploy).
- Locked-out admin: set `INITIAL_ADMIN_EMAIL` and `INITIAL_ADMIN_PASSWORD` for a super admin and follow the seed or admin bootstrap; or ask another SUPER_ADMIN to reset the password in Admin, Users.
- Rotating `AUTH_SECRET` (the old `NEXTAUTH_SECRET` is only a fallback) logs out all admins and customers. Rotate `CRON_SECRET` in Vercel and redeploy. Rotate SMS and ZarinPal keys at the provider, then update Vercel.
- Never put secrets, IP addresses or hostnames of the database in this repo.

## 7. Customer data requests
Find the customer in Admin, Customers; export their data from the 360 page or CSV; deletion is done by an ADMIN after checking open orders. Merges are audited in Admin, Audit.

## 8. Feeds and indexing
Feeds: `/feeds/torob`, `/feeds/products.xml`, `/feed.xml`; sitemap `/sitemap.xml`. IndexNow: `npm run seo:indexnow` or `/api/indexnow` (Bearer `CRON_SECRET`).

## 9. Incident: database unreachable
Symptom: `PrismaClientInitializationError`. Check the provider status page and connection limits (`SELECT count(*), state FROM pg_stat_activity GROUP BY state`), use the pooled `DATABASE_URL` for the app and `DIRECT_URL` for migrations, and promote the last good deployment if the cause is a release.
