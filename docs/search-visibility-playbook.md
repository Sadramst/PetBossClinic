# Search visibility playbook — Google, Bing and Iranian platforms

This is the operational checklist for making **www.petbossclinic.com** show up when
someone searches for a vet, grooming or pet shop in Tehran. The technical work is
done; the items in **“Only the owner can do”** need the clinic’s own accounts.

Site-internal work that is already live:

- 777 URLs in `sitemap.xml` (home, shop, 16 categories, 21 brands, 723 products,
  10 service pages, 7 static pages)
- `robots.txt`, RSS (`/feed.xml`), Torob API (`/feeds/torob`),
  Google product feed (`/feeds/products.xml`)
- JSON-LD: VeterinaryCare/LocalBusiness, Organization, WebSite + SearchAction,
  Product, Service, FAQPage, Article, BreadcrumbList, ItemList
- Farsi-only `fa-IR` site, canonical URLs, short titles/descriptions, Farsi 404
- IndexNow key + `/api/indexnow` + `npm run seo:indexnow`

## 1. Google (the main source of Iranian pet searches)

### 1.1 Google Search Console — required for indexing
1. Open <https://search.google.com/search-console> and add a **Domain** property
   for `petbossclinic.com` (DNS verification) or a **URL-prefix** property for
   `https://www.petbossclinic.com`.
2. Copy the verification code and paste it in
   **Admin → تنظیمات سایت → «گوگل و سئو»**. The site renders the
   `google-site-verification` meta tag automatically.
3. In Search Console → **Sitemaps**, submit
   `https://www.petbossclinic.com/sitemap.xml`.
4. Use **URL Inspection** on `/`, `/shop`, `/services`, the 10 service pages and
   the top 10 products; click **Request indexing** for each.
5. After 2–4 weeks, review **Pages** (coverage) and **Performance** (queries).

### 1.2 Google Business Profile — the local pack (highest impact)
Most “دامپزشکی قیطریه” searches show a map pack above normal results. That pack
comes from **Google Business Profile**, not from the website.

1. Go to <https://business.google.com>, create/claim
   **کلینیک دامپزشکی و پت‌شاپ پت‌باس**.
2. Category: **Veterinarian**; secondary: **Pet groomer**, **Pet store**.
3. Enter exactly the NAP below, the website, hours, and 10–20 real photos
   (storefront, reception, treatment room, grooming, team).
4. Choose **Video verification** or postcard; complete it.
5. Ask every satisfied customer for a Google review (send the review link on
   WhatsApp after the visit). Reply to every review.
6. Post a weekly update (offer, new product, vaccination reminder).

### 1.3 Google Merchant Center
Add `https://www.petbossclinic.com/feeds/products.xml` as a scheduled feed.
It currently contains the 546 priced products; fix the 177 unpriced ones first
(see `docs/seo-audit-2026-11.md`).

## 2. Bing / Yandex / other search engines

1. <https://www.bing.com/webmasters> → add `petbossclinic.com` (you can import
   from Search Console) → submit the sitemap.
2. IndexNow is already wired:
   - key file: `https://www.petbossclinic.com/c58334f836c64678963a14c4ea58c8c0.txt`
   - manual submit: `npm run seo:indexnow`
   - authenticated endpoint: `GET /api/indexnow` with
     `Authorization: Bearer $CRON_SECRET`
3. Yandex Webmaster accepts the same sitemap if you want Russian/regional traffic.

## 3. Iranian platforms and directories

Create the business listing once with the NAP block below, then reuse the same
text and photos everywhere.

| Platform | What to do | URL |
| --- | --- | --- |
| Torob | Register the shop, add `https://www.petbossclinic.com/feeds/torob` | <https://torob.com> (seller panel) |
| Emalls | Register the shop, add `https://www.petbossclinic.com/feeds/products.xml` | <https://emalls.ir> |
| Digikala | Seller panel; list products manually or via feed | <https://seller.digikala.com> |
| Basalam | Create a shop and list the catalogue | <https://basalam.com> |
| Sheypoor | Post the clinic and pet-shop services in Tehran | <https://www.sheypoor.com> |
| Divar | Post the clinic/pet-shop service | <https://divar.ir> |
| Behtarino | Free business listing for vets/clinics | <https://behtarino.com> |
| Petboom | Clinic directory listing | <https://petboom.online> |
| Hamgardi | Business listing | <https://hamgardi.com> |
| Neshan | Claim the map listing | <https://neshan.org> |
| Balad | Claim the map listing | <https://balad.ir> |
| Parsijoo | Submit the site/sitemap | <https://www.parsijoo.ir> |
| Yooz | Submit the site/sitemap | <https://yooz.ir> |
| eNamad | Trust seal (already supported in the footer) | <https://enamad.ir> |
| Samandehi | Media/website registration | <https://samandehi.ir> |

For each listing use the **same** name, address, phone, hours, website and
description. Inconsistent NAP weakens local ranking.

## 4. Copy-paste NAP block

**نام:** کلینیک تخصصی دامپزشکی و پت‌شاپ پت‌باس
**نام انگلیسی:** Pet Boss Clinic & Luxury Pet Shop

**آدرس:** تهران، خیابان شریعتی، نرسیده به مترو قیطریه، پلاک ۱۷۳۳
**Address:** No. 1733, Shariati St., near Gheytariyeh Metro Station, Tehran, Iran

**تلفن:** ۰۲۱-۲۶۴۲۹۷۱۵ (`+98 21 2642 9715`)
**واتس‌اپ:** ۰۹۹۱۵۳۳۴۰۹۱ (`+98 991 533 4091`)
**ایمیل:** petbossclinic@gmail.com
**ساعات کاری:** همه روزه ۱۰:۰۰ تا ۲۲:۰۰
**وب‌سایت:** https://www.petbossclinic.com
**مختصات:** 35.790937, 51.4350853
**دسته‌بندی:** دامپزشک، کلینیک دامپزشکی، گرومینگ حیوانات خانگی، پت‌شاپ

**توضیح کوتاه (فارسی):**
کلینیک تخصصی دامپزشکی و پت‌شاپ پت‌باس در قیطریه تهران؛ واکسیناسیون، جراحی،
دندانپزشکی، ارتوپدی، گرومینگ حرفه‌ای و فروش غذای اصل سگ و گربه با تاریخ انقضای
معتبر و مشاوره دامپزشک. همه روزه ۱۰ تا ۲۲.

**Short description (English):**
Pet Boss Clinic is a veterinary clinic, grooming salon and pet shop in
Gheytariyeh, Tehran: vaccination, surgery, dentistry, orthopedics, grooming and
authentic pet food, open daily 10:00–22:00.

## 5. Content that earns rankings

1. **Service pages are live** — `/services/<slug>` for vaccination, internal
   medicine, parasite treatment, soft/hard tissue surgery, orthopedics, grooming,
   bath, nail/ear care and anti-parasite bath. Each has Service + FAQ schema and
   links to related services.
2. **Publish the 3 draft articles** after veterinary review
   (Admin → مطالب). They unlock `/blog/...` URLs, Article schema and the RSS feed.
3. **Add one buying guide per top category** (dry cat food, dry dog food, cat
   litter, joint supplements). Link to the category and 3–6 products.
4. **Collect reviews** — after 10–20 real Google reviews, add `AggregateRating`
   to Product/Service schema (never invent reviews).
5. **Fix the 177 products without a price** — they are invisible in Google
   Shopping and cannot produce product rich results.

## 6. Weekly 15-minute routine

- Search Console → Performance: which queries/pages grew or dropped.
- Search Console → Pages: fix any new “Excluded” or “Soft 404”.
- Google Business Profile: answer new reviews/questions, post one update.
- Add 3–5 new prices/photos to the catalogue.
- `npm run seo:indexnow` after a batch of content/product changes.

## What only the owner can do

- Verify Search Console/Bing (account ownership).
- Create and verify Google Business Profile.
- Register Torob/Emalls/Digikala/Basalam seller accounts (business documents,
  phone verification).
- Collect real customer reviews.
- Approve veterinary content before publishing.
