# Expiry UX: final design

Goal: staff see risk before it costs money; customers see one calm, honest date; near-expiry stock gets sold, not hidden.

## 1. Model and states
Batches are `Inventory` rows. `Product.tracksExpiry` marks perishables. New `Product.shelfLifeDays Int?` (auto-fills expiry from manufacture date).

States (single source: `lib/shop/expiry.ts`, thresholds from settings with defaults):
| State | Rule | Persian label | Tone |
|---|---|---|---|
| expired | expiry < today | منقضی شده | danger |
| critical | 0-30 days | کمتر از ۳۰ روز | warn (amber) |
| soon | 31-90 days | کمتر از ۹۰ روز | gold |
| ok | over 90 days | سالم | ok (green, quiet) |
| none | no date, tracksExpiry | بدون تاریخ | neutral outline |
| n/a | tracksExpiry false | (no badge) | |

Thresholds: `expirySoonDays` 90, `expiryCriticalDays` 30, `minShelfLifeDays` 7 (sale cutoff). Stored in a singleton `ExpiryConfig` row (id `default`): `soonDays`, `criticalDays`, `minShelfLifeDays`, `discountStartDays` (default 60), `discountPercent` (default 20), `digestPhones`. (`SiteSetting` is a fixed-column row, so it is not extended.) `getExpiryConfig()` in `lib/shop/expiry-config.ts` reads them (60 s cache) and falls back to env/constants. Validation: critical < soon, min shelf life <= critical.

`ExpiryBadge` text is always shown with colour; format "کمتر از ۳۰ روز · ۱۲ اسفند ۱۴۰۶" in tables, state label only in dense cells (date in tooltip/title).

## 2. Admin: product editor and list
- Product editor gets a `FormSection` "انقضا و بچ‌ها": switch tracksExpiry (confirm when turning off with dated stock), shelfLifeDays, read-only nearest sellable expiry with `ExpiryBadge`, batch mini-table (qty, expiry, batch no, state), button "ثبت محموله" opening the batch Drawer, link "مشاهده در موجودی".
- Product list: new column "انقضا" showing nearest sellable batch `ExpiryBadge` (computed by one grouped query for the page's product ids, never per row), and a filter: all, منقضی، کمتر از ۳۰، کمتر از ۹۰، بدون تاریخ، فاقد موجودی. Server-side.

## 3. Admin: inventory board (`/admin/inventory`)
- Top: four `StatCard`s (منقضی شده، کمتر از ۳۰ روز، کمتر از ۹۰ روز، بدون تاریخ) plus "ارزش در معرض خطر" (needs cost price). Cards are filters (`?state=`), with `aria-pressed`.
- Groups (accordion, most urgent open): منقضی شده (needs action banner), ۳۰ روز، ۹۰ روز، سالم، بدون تاریخ. Row: product (link), batch no, location, expiry badge + days left, qty, value at risk, actions.
- Row actions: تعدیل با دلیل (COUNT, DAMAGE, RETURN, OTHER), امحا/ضایعات (WRITE_OFF with `confirmDialog`; sets qty to 0, logs loss), تخفیف نزدیک انقضا, ثبت بچ جدید برای همین کالا.
- Filters: product search, state, location; server pagination (25 per page); mobile cards.
- Batch entry Drawer "ثبت محموله": `ProductCombobox` (name/SKU/barcode, recents), multi-line table (product, qty, manufacture date, expiry date, batch no, location, optional cost), "افزودن ردیف", "کپی ردیف قبلی", `JalaliDateField` with presets (+۶ ماه، +۱۲ ماه، +۲۴ ماه از تولید or per shelfLifeDays), paste CSV (product sku, qty, expiry). Validation: expiry after manufacture, qty >= 1, tracksExpiry products require expiry (inline error, not asterisk by string concat). Saves in one transaction; result summary.
- Adjustments are `InventoryAdjustment` rows (batchId, productId, delta, reason, note, adminId, costAtLoss) written with the quantity change and `logAdminChange`.
- Report `/admin/reports?tab=expiry` and CSV: by state, category, value at risk, write-offs by reason and month.

## 4. Alerts
Cron `/api/cron/expiry` keeps `syncProductStock`; additionally builds a digest (counts per state, top 10 items) and, once per day when counts changed or any critical exist, creates a `StaffNotification` EXPIRY_DIGEST and an outbox SMS to users with `notifyExpiry` role flag (ADMIN by default; setting `expiry.digestPhones`). Dedupe key `expiry-digest:<yyyy-mm-dd>`. Dashboard widget mirrors the digest.

## 5. Near-expiry discount (coupon engine)
Rule: a sellable batch with daysLeft <= `discountStartDays` and > `minShelfLifeDays` is "clearance". Implementation in R2 with R1 groundwork:
- R1: admin one-click "ایجاد تخفیف نزدیک انقضا" creates a `Coupon` (percent, product-scoped through existing coupon rules, `endsAt` = expiry minus minShelfLifeDays, auto-apply flag where the coupon engine supports it, else a visible code) prefilled via `createExpiryCouponAction`.
- R2: automatic product promotion: `lib/marketing/pricing.ts` applies `clearancePrice(product, batch)` for allocations drawn from clearance batches; allocation stores unit price per batch take; product page shows struck price.
- Club campaign template "حراج نزدیک انقضا" targets segment of customers with matching pet species.
Never discount below cost price when cost is known.

## 6. Storefront
Product page: remove the boxed duplicate; show expiry once, in the specs strip next to stock status:
- Label «تاریخ انقضا», Jalali date (e.g. ۱۲ اسفند ۱۴۰۶) and quiet secondary "حدود ۱۴ ماه دیگر".
- ok: neutral. soon/critical (sellable): small gold badge «تاریخ نزدیک» with a one-line explanation «مناسب مصرف سریع». If a discount applies: «مناسب مصرف سریع؛ با تخفیف عرضه می‌شود». Red only for unavailability.
- No dated batch: «تاریخ انقضا پیش از ارسال توسط کادر دامپزشکی بررسی می‌شود», placed in the same strip.
- Customers never see batch tables; date shown is the FEFO batch that will ship.
- Listing cards: badge only for near-expiry discounted items; sort option «طولانی‌ترین تاریخ انقضا»; collection page «حراج نزدیک انقضا» (R2).
- Cart/checkout: line note «تاریخ انقضا بعد از تأیید سفارش در فاکتور درج می‌شود».
- Order detail: expiry date per line, read from `OrderItem.allocations[].expiryDate` (new field in `BatchTake`, written at allocation time; old orders show nothing).

## 7. Acceptance
- Expiry appears exactly once on a product page; e2e asserts `data-testid="product-expiry"` count is 1.
- Product list filter by state returns correct rows server-side; badge matches `expiryState` unit tests with configurable thresholds.
- Write-off sets qty 0, creates adjustment row, audit entry, and product stock status re-syncs.
- Batch Drawer saves 3 lines in one transaction; any invalid line saves none.
- 360px: inventory has no horizontal page scroll.
