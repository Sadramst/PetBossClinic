# Pet Boss Clinic — Documentation Hub

Welcome to the internal engineering, architecture, and operational documentation for **Pet Boss Clinic (پت‌باس)**.

---

## 📑 Core Architecture & Design
- **[Architecture & Systems Design](./architecture.md)** — High-level architecture, Next.js App Router layout hierarchy, Mermaid system diagrams, data flow, and server action contracts.
- **[Data Model & Database](./data-model.md)** — Prisma Entity-Relationship mapping, table taxonomy, soft deletes, bilingual indexing, and Phase 2 schema stubs.
- **[Theming & Design Tokens](./theming.md)** — Visual identity derived from `RelatedPhotos/petbossclinic.jpeg`, luxury charcoal/gold tokens, 4 presets, dynamic theme switching, and live preview engine.
- **[Internationalization (i18n)](./i18n.md)** — Farsi-first default (`/`) routing, English (`/en`) fallback, RTL/LTR CSS logical properties, font subsetting, and translation keys.

---

## 🏢 Management & Administration
- **[Admin Panel Specification](./admin-panel.md)** — Complete guide to the custom back office at `/admin`, module breakdown (Services, Divisions, Staff, Products, Leads, Messages, Theme, Settings), and security roadmap.
- **[Seed Data Specification](../scaffold/seed-data.md)** — Single source of truth Markdown tables for initial database seeding with realistic Tehran prices and content.

---

## 📈 Growth, SEO & Marketing
- **[SEO & Google Ads Playbook](./seo-and-ads-playbook.md)** — Target Persian keywords for Tehran/Gheitariyeh, JSON-LD structured data specs, high-conversion landing page architecture (`/lp/[slug]`), and event tracking.
- **[Product Roadmap & Phase Transition](./roadmap.md)** — Phase 1 prototype completion checklist, hardening items, and Phase 2 activation plan (E-commerce cart, checkout, Zarinpal gateway, online booking).

---

## ⚙️ DevOps, Quality & Operations
- **[Testing Strategy](./testing.md)** — Vitest unit & component test suite, test coverage metrics, Playwright E2E guidelines, and CI assertions.
- **[Infrastructure & Deployment](./infra.md)** — Vercel web hosting, Vultr PostgreSQL 16 & pgBouncer container, S3-compatible media storage, and daily automated backup scripts.
- **[DNS & Domain Configuration](./dns.md)** — Ventraip domain setup, Vercel CNAME/A records, GSC verification, and mail routing.
- **[Operations Runbook](./runbook.md)** — Step-by-step procedures for deployment, rollback, disaster recovery, secret rotation, and database maintenance.
- **[Contributing Guide](./contributing.md)** — Code style, Git workflow, commit conventions, and pull request checklist.

---

## 🏛️ Architecture Decision Records (ADRs)
- **[ADR 001: Next.js 15 App Router](./decisions/ADR-001-Nextjs.md)** — SSR/SSG framework selection for SEO and bilingual routing.
- **[ADR 002: PostgreSQL 16 & Prisma ORM](./decisions/ADR-002-Postgres-Prisma.md)** — Relational data model and type-safe query layer.
- **[ADR 003: Custom Admin Back Office](./decisions/ADR-003-Custom-Admin.md)** — Tailored in-house CMS adhering to luxury design tokens.
- **[ADR 004: Hybrid Deployment Architecture](./decisions/ADR-004-Vercel-Vultr.md)** — Vercel edge delivery paired with Vultr dedicated database compute.
- **[ADR 005: SEO-First Rendering](./decisions/ADR-005-SEO-Rendering.md)** — SSR/SSG requirements for crawler indexing and JSON-LD injection.
- **[ADR 006: Vazirmatn Variable Font](./decisions/ADR-006-Vazirmatn.md)** — Primary Persian typography and performance subsetting.
