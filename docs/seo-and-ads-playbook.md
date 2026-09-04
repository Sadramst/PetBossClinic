# SEO & Google Ads Strategy Playbook

This playbook documents the technical SEO infrastructure, Persian keyword taxonomy, structured data (JSON-LD), and Google Ads conversion framework designed to make **Pet Boss Clinic (پت‌باس)** the #1 veterinary destination in Tehran.

---

## 1. Primary Success Metric

The website's primary commercial objective is:
1. **Dominating organic search results** in Northern Tehran (Shariati, Gheitariyeh, Andarzgoo, Niavaran, Tajrish, Pasdaran) for veterinary and grooming queries.
2. **Achieving maximum Quality Score (8–10/10)** on Google Ads campaigns with ultra-fast, mobile-optimized landing pages (`/lp/[slug]`).

---

## 2. Target Persian Keyword Taxonomy

### 2.1 Primary Brand & High-Intent Local Keywords
- `کلینیک دامپزشکی تهران` (Tehran veterinary clinic)
- `دامپزشکی شریعتی` (Shariati veterinary clinic)
- `کلینیک دامپزشکی قیطریه` (Gheitariyeh veterinary clinic)
- `درمانگاه دامپزشکی شمال تهران` (North Tehran vet clinic)
- `پت شاپ قیطریه` / `پت شاپ شریعتی` (Gheitariyeh / Shariati pet shop)
- `دامپزشک خوب در تهران` (Best vet in Tehran)
- `کلینیک دامپزشکی نزدیک من` (Vet clinic near me)

### 2.2 Clinical & Surgery Keywords
- `واکسیناسیون سگ و گربه تهران` (Dog and cat vaccination Tehran)
- `جراحی حیوانات خانگی تهران` (Pet surgery Tehran)
- `ارتوپدی حیوانات خانگی` (Veterinary orthopedics)
- `جراحی بافت نرم سگ و گربه` (Soft tissue pet surgery)
- `انگل درمانی سگ و گربه` (Parasite therapy)
- `بیماری های داخلی حیوانات` (Internal pet medicine)
- `دندانپزشکی سگ و گربه` (Pet dentistry & scaling)

### 2.3 Grooming & Hygiene Keywords
- `گرومینگ سگ و گربه تهران` (Dog and cat grooming Tehran)
- `اصلاح موی سگ در قیطریه` (Dog haircut in Gheitariyeh)
- `شستشو و حمام درمانی گربه` (Cat bath & therapeutic washing)
- `آرایشگاه حیوانات خانگی تهران` (Pet salon Tehran)
- `ناخن گیری سگ و گربه` (Pet nail clipping & ear cleaning)

### 2.4 Pet Shop & Nutrition Keywords
- `خرید غذای خشک سگ تهران` (Buy dry dog food Tehran)
- `خرید غذای گربه رفلکس و رویال کنین` (Buy Reflex & Royal Canin cat food)
- `خاک گربه گرانول بدون بو` (Odorless clumping cat litter)
- `باکس حمل و نقل سگ و گربه استاندارد پرواز` (Flight-approved pet carriers)
- `قلاده و بند قلاده سگ چرمی` (Luxury leather dog collars)

---

## 3. Technical SEO Implementation

### 3.1 Server-Side Rendering (SSR / SSG)
- All public pages are server-rendered for immediate indexing by Googlebot without relying on client JavaScript execution.
- Hreflang alternates are automatically output on every page:
  - `fa-IR`: `https://www.petbossclinic.com/` (or route)
  - `en`: `https://www.petbossclinic.com/en/...`
  - `x-default`: `https://www.petbossclinic.com/`

### 3.2 Dynamic Sitemap & Robots
- **Sitemap** (`app/sitemap.ts`): Queries the database dynamically to generate URLs for all active services, divisions, blog posts, breeds, and static pages with priority scores.
- **Robots** (`app/robots.ts`): Allows all search crawlers to index public pages while disallowing administrative paths (`/admin`, `/api`).

### 3.3 Core Web Vitals (CWV) Standards
- **LCP (Largest Contentful Paint)**: < 2.0s on 4G mobile.
- **INP (Interaction to Next Paint)**: < 150ms.
- **CLS (Cumulative Layout Shift)**: < 0.05.
- Zero external render-blocking scripts; variable fonts loaded locally via `next/font`.

---

## 4. Structured Data (JSON-LD) Specification

Every public route injects standardized schema.org JSON-LD scripts:

### 4.1 LocalBusiness / VeterinaryCare Schema
Injected on the homepage and contact page:
```json
{
  "@context": "https://schema.org",
  "@type": "VeterinaryCare",
  "name": "کلینیک دامپزشکی و پت شاپ پت باس",
  "alternateName": "Pet Boss Clinic",
  "url": "https://www.petbossclinic.com",
  "telephone": "+98-21-22000000",
  "priceRange": "$$",
  "image": "https://www.petbossclinic.com/icons/petboss-logo.png",
  "address": {
    "@type": "PostalAddress",
    "streetAddress": "خیابان شریعتی، بالاتر از پل صدر، نرسیده به مترو قیطریه، پلاک ۱۷۳۳",
    "addressLocality": "تهران",
    "addressRegion": "تهران",
    "addressCountry": "IR"
  },
  "geo": {
    "@type": "GeoCoordinates",
    "latitude": 35.790937,
    "longitude": 51.4350853
  },
  "openingHoursSpecification": [
    {
      "@type": "OpeningHoursSpecification",
      "dayOfWeek": ["Saturday", "Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
      "opens": "10:00",
      "closes": "22:00"
    }
  ]
}
```

### 4.2 FAQPage Schema
Injected on `/[locale]/faq` and the homepage FAQ accordion to capture rich snippets on Google SERP.

---

## 5. Google Ads Conversion Framework

### 5.1 Landing Page Route (`app/[locale]/(landing)/lp/[slug]`)
- Fast, distraction-free landing page architecture stripped of secondary navigation.
- Focuses entirely on single conversion goals: Emergency Call, WhatsApp Consultation, or Appointment Booking.
- Individual `noindex` toggle so ad variations don't cannibalize organic search equity.

### 5.2 Lead Attribution & UTM Tracking
When users submit an inquiry form, the system captures:
- `utm_source`, `utm_medium`, `utm_campaign`, `utm_term`, `utm_content`
- Stored directly on the `Lead` database record for end-to-end ROAS calculation.

### 5.3 Conversion Actions
- `call_click`: Clicking phone numbers (`tel:+982122000000`)
- `whatsapp_click`: Clicking floating WhatsApp buttons
- `direction_click`: Clicking Google Maps / Waze direction links
- `lead_submit`: Submitting appointment inquiry forms
