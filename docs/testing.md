# Testing Strategy & Quality Assurance — Pet Boss Clinic

> **Prototype Validation & Test Architecture**  
> This document specifies the automated testing strategy, execution commands, coverage standards, and end-to-end verification plans for the Pet Boss Clinic bilingual web application and custom admin panel.

---

## 1. Overview & Testing Pyramid

The testing strategy is structured across three core layers:

```
                  ▲
                 / \
                /E2E\      Playwright (Bilingual RTL/LTR, Viewports, User Flows)
               /-----\
              / Integ \    API Routes, Server Actions, Database Seeding
             /---------\
            / Unit & UI \  Vitest + Testing Library (Components, State, Helpers)
           /-------------\
```

| Layer | Tooling | Scope | Current Status |
|---|---|---|---|
| **Unit & Component** | Vitest 3.x, `@testing-library/react`, `jsdom` | UI components, design tokens, theme switcher, admin utilities | **15/15 Passed (100%)** |
| **Type Integrity** | TypeScript 5.x (`tsc --noEmit`) | Strict type checking across entire App Router and Prisma client | **0 errors** |
| **Linting & A11y** | ESLint (`eslint-config-next`) | Code style, React hooks, Next.js link/image rules | **0 errors** |
| **End-to-End (E2E)** | Playwright (Desktop & Mobile) | RTL/LTR navigation, theme persistence, form submissions | Phase 1 Hardening Spec |

---

## 2. Unit & Component Test Suite (Vitest)

### 2.1 Configuration & Compatibility Notes
Due to environment constraints (Node.js 20 on Windows/Linux CI), Vitest is configured with `@vitejs/plugin-react@^4.3.4` and `jsdom@^24.1.3` using ESM config `vitest.config.mts`:

```typescript
// vitest.config.mts
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./vitest.setup.ts'],
    alias: {
      '@': path.resolve(__dirname, './'),
    },
  },
});
```

### 2.2 Implemented Test Suites

The current test suite covers key UI design tokens and admin state:

1. **`components/ui/luxury-pill-badge.test.tsx` (4 tests)**
   - Renders badge label text properly.
   - Applies primary metallic gold styling and borders (`border-gold-500/40`).
   - Applies emerald styling when variant is `emerald`.
   - Supports custom classes and child elements.

2. **`components/admin/theme-switcher.test.tsx` (3 tests)**
   - Renders all 4 luxury presets: *Luxury Dark (لوکس تیره)*, *Luxury Light (لوکس روشن)*, *Emerald Prestige (زمرد سلطنتی)*, *Royal Obsidian (آبسیدین سلطنتی)*.
   - Triggers cookie persistence (`petboss_theme`) on theme selection.
   - Highlights the currently active theme with gold border and indicator badge.

3. **`components/ui/button.test.tsx` (4 tests)**
   - Renders default button with primary theme styles.
   - Supports `asChild` delegation to child elements (Slot pattern).
   - Renders custom sizes (`sm`, `lg`, `icon`) and variants (`outline`, `ghost`, `secondary`).
   - Handles click interactions and disabled states.

4. **`components/ui/card.test.tsx` (1 test)**
   - Renders `Card`, `CardHeader`, `CardTitle`, and `CardContent` with dark charcoal background tokens.

5. **`lib/admin.test.ts` (3 tests)**
   - Validates admin navigation item structure and role requirements.
   - Formats currency into Iranian Tomans (`IRR` / `IRT`).
   - Converts Gregorian dates to Solar Hijri (Shamsi / Jalali) representation.

### 2.3 Running Tests

```bash
# Run complete test suite once
npm test

# Run tests in watch mode during development
npm run test:watch

# Run tests with code coverage report
npm run test:coverage
```

Target coverage thresholds for core design components and business utilities:
- **Statements:** ≥ 85%
- **Branches:** ≥ 80%
- **Functions:** ≥ 85%
- **Lines:** ≥ 85%

---

## 3. Playwright End-to-End (E2E) Test Plan

Playwright verifies end-user journeys across both English and Persian locales, testing responsive viewports and bidirectional layouts.

### 3.1 Viewport Test Matrix

```typescript
// playwright.config.ts viewports
export const devices = [
  { name: 'Mobile Safari (iPhone 13)', viewport: { width: 390, height: 844 } },
  { name: 'Mobile Chrome (Pixel 7)', viewport: { width: 412, height: 915 } },
  { name: 'Tablet (iPad Mini)', viewport: { width: 768, height: 1024 } },
  { name: 'Desktop HD', viewport: { width: 1440, height: 900 } },
];
```

### 3.2 Critical User Flow Scenarios

#### Scenario 1: Bilingual Root Redirection & RTL Layout
- **Path:** Visit `/`
- **Assertions:**
  - `document.documentElement.lang === 'fa'`
  - `document.documentElement.dir === 'rtl'`
  - Font applied is Vazirmatn.
  - Header logo links to `/`.
  - Language switcher toggles smoothly to `/en`.
  - On `/en`, `lang === 'en'`, `dir === 'ltr'`, and font switches to Outfit.

#### Scenario 2: Luxury Dark Theme & Dynamic Switching
- **Path:** Visit `/admin/theme`
- **Assertions:**
  - Initial theme defaults to `luxury-dark` with `#181A20` background and `#C5A059` accents.
  - Clicking `emerald-prestige` card updates document `data-theme` attribute immediately.
  - Cookie `petboss_theme=emerald-prestige` is set with 1-year expiry.
  - Navigating back to public homepage `/` reflects Emerald Prestige palette without reload flicker.

#### Scenario 3: Lead Capture & Telephony Actions
- **Path:** Visit `/services`
- **Assertions:**
  - Service cards display golden pill badges (`خدمات تخصصی`, `VIP`).
  - Clicking "رزرو نوبت تلفنی" opens `tel:+982122000000` prompt on mobile.
  - Submitting quick lead form creates record in PostgreSQL database.
  - Lead immediately appears in `/admin/leads` table.

#### Scenario 4: Admin Back Office Navigation & Isolation
- **Path:** Visit `/admin`
- **Assertions:**
  - Admin sidebar renders all 10 management links (Overview, Services, Divisions, Staff, Products, Leads, Messages, FAQs, Theme, Settings).
  - All dynamic data loads without static generation cache crashes (`force-dynamic` verified).
  - RTL orientation maintains sidebar on right side with proper chevron flip.

---

## 4. Continuous Integration (CI) Workflow

Every pull request must pass the automated GitHub Actions pipeline (`.github/workflows/ci.yml`):

```yaml
name: CI Pipeline

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  verify:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Generate Prisma Client
        run: npx prisma generate

      - name: TypeScript Check
        run: npm run typecheck

      - name: ESLint
        run: npm run lint

      - name: Vitest Unit & Component Tests
        run: npm test

      - name: Production Build Verification
        run: npm run build
```
