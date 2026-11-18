# Test flow

How the whole system is checked, from one command to the manual checks that need real accounts.

## 1. One command

```bash
npm run test:all                  # typecheck → lint → unit/integration → build → e2e (desktop + phone)
npm run test:all -- --skip-e2e    # fast checks only
npm run test:all -- --only=e2e    # a single step: typecheck | lint | unit | build | e2e
```

It stops at the first failure and prints a summary table. It needs a local PostgreSQL (never production) in
`DATABASE_URL`, plus `AUTH_SECRET` and `INITIAL_ADMIN_PASSWORD`. Set `SMS_PROVIDER=console` so login codes are
printed to the server log instead of sent. Playwright starts its own production server on port `E2E_PORT`
(default 3200, because 3000 is often in use).

First time on a fresh database:

```bash
npx prisma db push && npx prisma db seed
node scripts/import-october-inventory.js && npx tsx scripts/assign-brands.ts --apply
```

## 2. Automated layers

| Layer | Where | What it proves |
| --- | --- | --- |
| Typecheck, lint | `tsc`, `eslint` | Everything compiles; no unused code or unsafe patterns. |
| Unit | `tests/unit`, `__tests__` | Pure logic: expiry, Jalali dates, Persian text, filters, brands, shipping, cart input, passwords, session tokens, ZarinPal client, article renderer, JSON-LD escaping. |
| Integration (real DB) | `tests/integration` | Concurrency: an order's stock is taken once even when called in parallel; parallel OTP and password guesses are capped; password login, lock-out, "squatter" takeover, logout and password change invalidating sessions. |
| Build | `npm run build` | Every page compiles and prerenders against the real schema. |
| E2E (browser) | `tests/e2e` | Real browser, desktop and phone: navigation and redirects, shop search/filters/pagination, product/category/brand pages, SEO tags, feeds and sitemap, blog, **customer register / logout / login / change password**, cart → checkout → cash-on-delivery order → stock, admin login, **no horizontal overflow at 360px** on public, account, cart and checkout pages. |
| CI | `.github/workflows` | The same checks on every pull request, plus Lighthouse. |

Rules of thumb: a bug found by hand gets a test in the cheapest layer that can catch it (the 360px overflow
guard exists because the account pages once stretched past a phone's width).

## 3. Manual QA checklist

Run after a deploy, or when a change touches the shop. "Phone" = a real phone, or browser device emulation at 360px.

### Guest

| # | Steps | Expected |
| --- | --- | --- |
| G1 | Open `/`, scroll top to bottom on desktop and phone. | No sideways scrolling; images load; header search and bottom bar work. |
| G2 | Search «رویال کنین گربه» in the header. | Results are Royal Canin cat products; the page is `noindex`. |
| G3 | `/shop` → a category → filter (cat, price range, in stock only) → sort. | URL reflects the filters; results and counts update; chips remove filters. |
| G4 | Open a product. | Price, stock, expiry date of the batch that ships, brand link, related products. |
| G5 | Add to cart, change quantity, remove, close the browser and reopen. | Cart persists; totals are right; stock limits are respected. |
| G6 | Open `/en/shop`. | 301 redirect to `/shop`. |
| G7 | Open a made-up URL. | Farsi 404 page with search, status 404. |

### Customer

| # | Steps | Expected |
| --- | --- | --- |
| C1 | `/account/login` → ثبت‌نام: name, phone, password (8+ chars, not only digits). | Account created and signed in; sent to the page you came from. |
| C2 | Register again with the same phone. | "این شماره قبلاً ثبت‌نام کرده است". |
| C3 | Log out, log in with a wrong password 5 times, then the right one. | Generic error each time; after 5, a "blocked for 15 minutes" message; SMS login (if enabled) still works. |
| C4 | Log in again; **Account → Information → change password**; use another browser that was signed in. | Other browser is signed out; this one stays in; old password no longer works. |
| C5 | Forgot password: with SMS enabled use "ورود با کد پیامکی", then set a new password in Information. | Works; without SMS the page shows the clinic phone. |
| C6 | Add an address (Tehran, valid postal code); try an invalid postal code and a landline as mobile. | Saved; clear Persian errors for the invalid ones. |
| C7 | Checkout, cash on delivery (Tehran address). | Order number `PB-<year>-NNNNNN`; cart emptied; order visible in Account → Orders. |
| C8 | Checkout with an address outside Tehran. | Cash on delivery is disabled; shipping by post. |
| C9 | Order total ≥ 3,000,000 toman. | Shipping is free. |
| C10 | Double-click "ثبت نهایی سفارش". | Only one order is created. |

### Admin (`/admin`)

| # | Steps | Expected |
| --- | --- | --- |
| A1 | Log in; wrong password five times. | Generic error then lock message. |
| A2 | Orders: open the new order, set "در حال آماده‌سازی", add a tracking code, then ارسال. | The customer's order page shows the status and code. |
| A3 | Cancel an order. | Stock returns to the same batch; customer sees "لغو شد". |
| A4 | Inventory: add a batch with an expiry date (Jalali, e.g. ۱۴۰۶/۰۶/۱۵). | Product page shows the nearest valid expiry; an expired batch never counts as stock. |
| A5 | Blog: write, publish, unpublish an article. | `/blog` and the sitemap follow; drafts return 404. |
| A6 | Settings: Search Console code, GA4 id, eNamad snippet. | Meta tag, analytics script and footer seal appear. |
| A7 | Customers: block a customer. | They are signed out and cannot log in. |

## 4. Needs real accounts (cannot be automated)

| Check | How |
| --- | --- |
| Real SMS code | Set `SMS_PROVIDER` and keys, request a code from a real phone; code arrives in seconds; a 6th request in an hour is refused. |
| Real payment | `ZARINPAL_SANDBOX=1` first. Pay, cancel on the bank page, refresh the return page, pay twice: the order is confirmed once, stock is taken once, a late payment on a cancelled order is flagged "نیاز به بازگشت وجه". |
| Search Console | Verify the site, submit `/sitemap.xml`, inspect a product URL. |
| Torob / Emalls | Register `/feeds/torob` (Torob API v3) and `/feeds/products.xml`. |
| eNamad | Paste the snippet in Settings; the seal loads in the footer. |
| Daily expiry job | Call `/api/cron/expiry` with `Authorization: Bearer $CRON_SECRET`; without the header it returns 401. |
| Release step | A production deploy logs `[release-db] … applied / already applied` and `database ready`. |

## 5. Smoke checklists

**Before deploying:** `npm run test:all` green; migrations in `prisma/migrations` are additive; `AUTH_SECRET` and
`CRON_SECRET` set in Vercel; the preview deployment opens.

**After deploying** (all should be 200 unless noted): `/`, `/shop`, a category, a brand, a product, `/blog`, `/cart`,
`/account/login`, `/sitemap.xml`, `/robots.txt`, `/feeds/torob`, `/feeds/products.xml`, `/feed.xml`;
`/en/shop` → 301; `/admin` → 307 to `/admin/login`. Then register a test account, place a cash-on-delivery
order, cancel it from the admin, and delete the test customer.
