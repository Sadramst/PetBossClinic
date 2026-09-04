# Pet Boss Clinic (پت‌باس) — Web Platform & Admin Panel

[![Build & Test](https://img.shields.io/badge/build-passing-brightgreen)]()
[![Framework](https://img.shields.io/badge/Next.js-15-black?logo=next.js)]()
[![React](https://img.shields.io/badge/React-19-blue?logo=react)]()
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-blue?logo=typescript)]()
[![TailwindCSS](https://img.shields.io/badge/Tailwind-v4-38bdf8?logo=tailwind-css)]()
[![Prisma](https://img.shields.io/badge/Prisma-6-2d3748?logo=prisma)]()
[![Database](https://img.shields.io/badge/PostgreSQL-16-336791?logo=postgresql)]()
[![Tests](https://img.shields.io/badge/Vitest-15%20passed-success)]()

> **Production-grade bilingual (Farsi-first / English-second) veterinary clinic and luxury pet shop website for Pet Boss Clinic (کلینیک و پت‌شاپ پت‌باس), located in Gheitariyeh, Tehran, Iran.**

---

## 📌 Prototype Status Note

> [!NOTE]
> **Current Milestone**: This project is currently in the **Phase 1 Working Prototype & Architectural Scaffold** stage. The frontend, theme engine, and admin panel at `/admin` represent a fully functional, interactive prototype connected to PostgreSQL and Prisma with realistic Tehran-market seed data. Real doctor licenses, finalized photographs, and payment gateway activation will be connected during the Phase 1 hardening and Phase 2 e-commerce transition.

---

## 🌟 Key Highlights & Features

1. **Luxury Brand Identity (Matching Physical Mockup)**:
   - Deep matte charcoal slate (`#181A20`, `#222630`) and polished metallic gold (`#C5A059`, `#D4AF37`, `#E5C06E`) aesthetic directly mirroring the branding in `RelatedPhotos/petbossclinic.jpeg`.
   - Crowned Lion brand emblem vector component (`<PetBossLogo />`) with cat and dog silhouettes.
   - Signature golden pill badges (`<LuxuryPillBadge />`): `مراقبت با عشق`, `جراحی تخصصی`, `دندانپزشکی`, `بیماری‌های داخلی`, `بستری و پانسیون`, `لوازم لوکس`.

2. **Dynamic Theming with Live Admin Control**:
   - Client Theme Engine with zero FOUC/hydration flash via server cookie synchronization (`petboss_theme`).
   - 4 Predefined Luxury Themes:
     - **Pet Boss Luxury Dark (Signature)** (Default)
     - **Pet Boss Luxury Light**
     - **Emerald Prestige**
     - **Royal Obsidian**
   - Admin Theme Manager at `/admin/theme` with real-time interactive preview.

3. **Bilingual & Farsi-First Localization**:
   - **Farsi (`fa-IR`) default at root (`/`)**: RTL layout with **Vazirmatn** variable font.
   - **English (`en`) at `/en`**: LTR layout with **Outfit** variable font.
   - Middleware-driven routing with `localePrefix: 'as-needed'`.

4. **Three Top-Level Divisions**:
   - **Clinical / Internal Medicine & Surgery** (بخش درمانی، داخلی و جراحی)
   - **Grooming & Hygiene** (بخش آرایش، شستوشو و بهداشت)
   - **Pet Shop** (پت‌شاپ)

5. **Complete Admin Back Office Prototype (`/admin`)**:
   - Dashboard with live metrics, lead inquiries, and inbox messages.
   - Services Manager (Toman pricing, duration, division categories).
   - Divisions Manager (Clinical, Grooming, Shop).
   - Staff & Doctors Manager (medical council license tracking).
   - Pet Shop Product Catalog (Phase 1 browse mode).
   - Inquiries & Appointments tracker (`/admin/leads`).
   - Contact Messages inbox (`/admin/messages`).
   - FAQ & Knowledge Manager (`/admin/faqs`).
   - Clinic General Settings (`/admin/settings`).

6. **Automated Testing Suite**:
   - 15 Vitest component and unit tests covering badges, theme switches, cards, buttons, and admin configuration.
   - 100% clean TypeScript typechecking (`npm run typecheck`).
   - ESLint compliance with 0 errors (`npm run lint`).
   - Static prerendering of all 36 application routes (`npx next build`).

---

## 🛠️ Technology Stack

| Layer | Technology | Details |
|---|---|---|
| **Framework** | Next.js 15 (App Router) | Server Components, Server Actions, Route Handlers |
| **Runtime / UI** | React 19 + TypeScript | Strict mode, full type-safety |
| **Styling** | Tailwind CSS v4 | CSS Custom Properties tokens in `styles/tokens.css` |
| **Components** | Radix UI primitives | Accessible, keyboard-navigable, RTL-ready |
| **Database** | PostgreSQL 16 | Hosted on Vultr with pgBouncer pooling |
| **ORM** | Prisma 6 | 1223-line schema, full relations, soft deletes |
| **i18n** | next-intl | Namespaced JSON dictionaries in `messages/` |
| **Typography** | Vazirmatn + Outfit | Self-hosted variable Google fonts |
| **Testing** | Vitest + Playwright | JSDOM component testing, E2E mobile testing |
| **Hosting** | Vercel | Auto-deploy from `main` branch |

---

## 🚀 Quick Start

### Prerequisites
- Node.js `^20.17.0 || >=22.0.0`
- npm `10+` (or pnpm `9+`)

### 1. Clone & Install
```bash
git clone https://github.com/Sadramst/PetBossClinic.git
cd PetBossClinic
npm install
```

### 2. Configure Environment
Create `.env` based on `.env.example`:
```bash
DATABASE_URL="postgresql://user:password@localhost:5432/petboss?schema=public"
DIRECT_URL="postgresql://user:password@localhost:5432/petboss?schema=public"
AUTH_SECRET="your-generated-secret"
```

### 3. Setup Database
```bash
# Generate Prisma Client
npx prisma generate

# Push schema to database
npm run db:push

# Seed realistic Tehran clinic data
npm run db:seed
```

### 4. Run Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) for Farsi or [http://localhost:3000/en](http://localhost:3000/en) for English.
Access the prototype admin panel at [http://localhost:3000/admin](http://localhost:3000/admin).

---

## 🧪 Verification & Testing Commands

```bash
# Run Vitest test suite
npm test

# Run TypeScript type check
npm run typecheck

# Run ESLint check
npm run lint

# Build production bundle
npm run build
```

---

## 📂 Project Structure

```
PetBossClinic/
├── app/
│   ├── [locale]/
│   │   ├── (clinic)/services/     # Services catalog & details
│   │   ├── (marketing)/about/     # Clinic story, mission & team
│   │   ├── (marketing)/contact/   # Contact form, coordinates & hours
│   │   ├── (marketing)/faq/       # Categorized FAQ accordion
│   │   ├── admin/                 # Custom Admin Back Office suite
│   │   │   ├── theme/             # Dynamic theme switcher with live preview
│   │   │   ├── services/          # Services management
│   │   │   ├── divisions/         # Clinic divisions
│   │   │   ├── staff/             # Doctors and veterinary licenses
│   │   │   ├── products/          # Pet shop catalog
│   │   │   ├── leads/             # Appointment requests
│   │   │   ├── messages/          # Contact messages inbox
│   │   │   ├── faqs/              # FAQ management
│   │   │   └── settings/          # Clinic phone, GPS coordinates, hours
│   │   ├── layout.tsx             # Root layout with ThemeProvider & fonts
│   │   └── page.tsx               # Luxury branded homepage
│   ├── feed.xml/                  # RSS feed route
│   ├── robots.ts                  # Search engine robots config
│   └── sitemap.ts                 # Dynamic XML sitemap
├── components/
│   ├── layout/                    # Header, Footer, Mobile bar
│   ├── shared/                    # PetBossLogo vector component
│   └── ui/                        # LuxuryPillBadge, Button, Card, Input
├── lib/
│   ├── db/                        # Prisma client singleton
│   └── theme/                     # ThemeProvider, presets, types, hooks
├── messages/
│   ├── fa.json                    # Persian translations dictionary
│   └── en.json                    # English translations dictionary
├── prisma/
│   ├── schema.prisma              # Database schema (1223 lines)
│   └── seed.ts                    # Tehran seed data script
├── styles/
│   ├── tokens.css                 # Master luxury charcoal/gold tokens
│   ├── globals.css                # Tailwind v4 theme & utility classes
│   └── rtl.css                    # RTL layout overrides
├── docs/                          # Comprehensive architectural documentation
├── infra/                         # Docker compose & database backup script
└── __tests__/                     # Vitest component and UI unit tests
```

---

## 📖 Documentation Directory (`/docs`)

- [Architecture & Tech Stack](./docs/architecture.md)
- [Data Model & Prisma Schema](./docs/data-model.md)
- [Admin Panel Specification](./docs/admin-panel.md)
- [Theming & Luxury Brand Identity](./docs/theming.md)
- [Internationalization (i18n)](./docs/i18n.md)
- [Phase 1 to Phase 2 Roadmap](./docs/roadmap.md)
- [SEO & Google Ads Playbook](./docs/seo-and-ads-playbook.md)
- [Testing Strategy & Test Suite](./docs/testing.md)
- [Infrastructure & Hosting](./docs/infra.md)
- [DNS & Domain Setup](./docs/dns.md)
- [Operations Runbook](./docs/runbook.md)
- [Contributing Guidelines](./docs/contributing.md)

---

## 📍 Clinic Physical Details

- **Name**: کلینیک دامپزشکی و پت شاپ پت باس (Pet Boss Veterinary Clinic & Pet Shop)
- **Tagline**: مراقبت با عشق ("Care with love")
- **Address**: تهران، خیابان شریعتی، بالاتر از پل صدر، نرسیده به ایستگاه مترو قیطریه، پلاک ۱۷۳۳
- **GPS Coordinates**: `35.790937, 51.4350853`
- **Working Hours**: همه روزه ۱۰:۰۰ صبح الی ۲۲:۰۰ شب (بدون تعطیلی)
- **Contact Phone**: `+982122000000` / `+989120000000`
- **Designed & Developed by**: [Appilico](https://www.appilico.com.au/)
