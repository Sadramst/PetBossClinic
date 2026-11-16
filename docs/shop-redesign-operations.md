# Shop redesign: operations guide

## Production environment variables (Vercel → Settings → Environment Variables)

| Variable | Required | Purpose |
| --- | --- | --- |
| `AUTH_SECRET` | **yes** | Signs admin and customer sessions. The production build refuses to release without it. Generate with `openssl rand -hex 32`. |
| `DATABASE_URL`, `DIRECT_URL` | yes | PostgreSQL on the Vultr VPS. |
| `CRON_SECRET` | recommended | Protects `/api/cron/expiry` (daily, takes expired stock off sale). |
| `SMS_PROVIDER` | for customer login | `kavenegar` or `smsir`. Until set, the cart offers ordering by WhatsApp/phone and the login page shows a "coming soon" notice. |
| `KAVENEGAR_API_KEY`, `KAVENEGAR_OTP_TEMPLATE` | with Kavenegar | Template must be an approved *verify lookup* template using `%token%`. |
| `SMSIR_API_KEY`, `SMSIR_OTP_TEMPLATE_ID` | with SMS.ir | Template parameter must be named `CODE`. |
| `ZARINPAL_MERCHANT_ID` | for online payment | Without it checkout offers cash on delivery (Tehran) only. `ZARINPAL_SANDBOX=1` for testing. |
| `SHIPPING_TEHRAN_FEE`, `SHIPPING_POST_FEE`, `SHIPPING_FREE_OVER` | optional | Toman. Defaults 80,000 / 150,000 / 3,000,000. |

## What happens on a production deploy

`npm run build` runs `scripts/release-db.mjs` before `next build`, **only when `VERCEL_ENV=production`**:

1. Stops the release if `AUTH_SECRET` is missing.
2. Checks the expected tables exist (schema drift guard).
3. Applies any SQL migration in `prisma/migrations/2026111*` that is not applied yet, each in a transaction. All are additive (new tables/columns), so the previous deployment keeps working.
4. On the first release only: normalises Arabic ي/ك in product names/slugs, links products to brands, creates three blog drafts.

Any failure fails the build and the current site stays live. Rehearse locally against a copy of the schema with
`DATABASE_URL=... node scripts/release-db.mjs --force`.

## After launch

- **Google Search Console**: Admin → تنظیمات سایت → گوگل و سئو → paste the HTML-tag verification code, verify, then submit `https://www.petbossclinic.com/sitemap.xml`.
- **eNamad**: paste the HTML snippet eNamad gives into the same settings box; the seal appears in the footer.
- **Torob**: register the shop in the Torob seller panel with the API URL `https://www.petbossclinic.com/feeds/torob` (Torob API v3 format, GET `?page=N` or POST).
- **Emalls / others accepting Google-format feeds**: `https://www.petbossclinic.com/feeds/products.xml`.
- **Blog**: Admin → مجله و مقالات. Three starter articles are created as drafts for a vet to review and publish.
- **Expiry**: Admin → موجودی و تاریخ انقضا. Record each delivery as a batch with its expiry date.
- **Orders**: Admin → سفارشات. Cancelling returns stock; orders with a "کسری موجودی" or "نیاز به بازگشت وجه" note need attention.
