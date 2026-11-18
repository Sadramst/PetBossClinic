# Shop redesign: operations guide

## Production environment variables (Vercel → Settings → Environment Variables)

| Variable | Required | Purpose |
| --- | --- | --- |
| `AUTH_SECRET` | **yes** | Signs admin and customer sessions. The production build refuses to release without it. Generate with `openssl rand -hex 32`. |
| `DATABASE_URL`, `DIRECT_URL` | yes | PostgreSQL on the Vultr VPS. |
| `CRON_SECRET` | recommended | Protects `/api/cron/expiry` (daily, takes expired stock off sale). |
| `SMS_PROVIDER` | optional | `kavenegar` or `smsir` adds "sign in with an SMS code" next to the password login. Customers can always register and sign in with **phone + password**, so the shop works without it. `console` prints codes to the server log (testing only). |
| `KAVENEGAR_API_KEY`, `KAVENEGAR_OTP_TEMPLATE` | with Kavenegar | Template must be an approved *verify lookup* template using `%token%`. |
| `SMSIR_API_KEY`, `SMSIR_OTP_TEMPLATE_ID` | with SMS.ir | Template parameter must be named `CODE`. |
| `ZARINPAL_MERCHANT_ID` | for online payment | Without it checkout offers cash on delivery (Tehran) only. `ZARINPAL_SANDBOX=1` for testing. |
| `SHIPPING_TEHRAN_FEE`, `SHIPPING_POST_FEE`, `SHIPPING_FREE_OVER` | optional | Toman. Defaults 80,000 / 150,000 / 3,000,000. |

## What happens on a production deploy

`npm run build` runs `scripts/release-db.mjs` before `next build`, **only when `VERCEL_ENV=production`**:

1. Stops the release if `AUTH_SECRET` is missing.
2. Checks the expected tables exist (schema drift guard).
3. Applies any SQL migration in `prisma/migrations/2026111*` that is not applied yet, each in a transaction. All are additive (new tables/columns), so the previous deployment keeps working. A new migration must also be listed in `scripts/release-db.mjs` with an "is it applied?" check.
4. On the first release only: normalises Arabic ي/ك in product names/slugs, links products to brands, creates three blog drafts.

Any failure fails the build and the current site stays live. Rehearse locally against a copy of the schema with
`DATABASE_URL=... node scripts/release-db.mjs --force`.

## Customer accounts

- **Sign-up and login:** phone + password (always on), and an SMS code when a provider is configured. Passwords are
  stored as scrypt hashes; 5 wrong passwords lock password login for that account for 15 minutes (SMS login still works).
- **Unverified numbers:** a number registered with a password but never confirmed by SMS is *unverified*. When the real
  owner later signs in with an SMS code, the password set by whoever registered first is removed and their sessions end.
- **Sessions:** logging out or changing the password ends every older session of that customer.
- **Forgot password:** sign in with an SMS code and set a new password under Account → Information. Without SMS, the
  login page shows the clinic's phone number: after confirming who is calling, a full admin uses
  Admin → Customers → «رمز موقت», reads the one-time password out over the phone, and the customer sets their own
  from Account → Information. (This ends all of that customer's sessions and clears any lock.)
- Customers who register with a password but never use SMS stay "unverified": the courier phones them to confirm the delivery.

## After launch

- **Google Search Console**: Admin → تنظیمات سایت → گوگل و سئو → paste the HTML-tag verification code, verify, then submit `https://www.petbossclinic.com/sitemap.xml`.
- **eNamad**: paste the HTML snippet eNamad gives into the same settings box; the seal appears in the footer.
- **Torob**: register the shop in the Torob seller panel with the API URL `https://www.petbossclinic.com/feeds/torob` (Torob API v3 format, GET `?page=N` or POST).
- **Emalls / others accepting Google-format feeds**: `https://www.petbossclinic.com/feeds/products.xml`.
- **Blog**: Admin → مجله و مقالات. Three starter articles are created as drafts for a vet to review and publish.
- **Expiry**: Admin → موجودی و تاریخ انقضا. Record each delivery as a batch with its expiry date.
- **Orders**: Admin → سفارشات. Cancelling returns stock; orders with a "کسری موجودی" or "نیاز به بازگشت وجه" note need attention.
