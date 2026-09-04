# ADR 003: Custom Administrative Back Office vs. Headless CMS

- **Status:** Accepted
- **Deciders:** Product Strategy Manager, Senior Software Architect
- **Date:** 2026-09-04

---

## Context
Pet Boss Clinic requires an administrative panel to manage clinical divisions, services, veterinarian staff biographies, pet shop products, inbound phone/form leads, customer contact messages, FAQs, and site-wide theme customization.

Key constraints:
- Must adhere directly to the luxury brand aesthetic (charcoal slate and metallic gold palette).
- Must seamlessly support Persian RTL editing and typography out of the box.
- Must avoid external CMS vendor lock-in, international recurring SaaS licensing fees, or regional payment barriers.
- Must support real-time dynamic theme switching and live client preview.

## Decision
We engineered a **Custom Admin Panel** embedded directly within the Next.js App Router under `/admin` (`app/[locale]/admin/...`), built with native React components, Tailwind CSS design tokens, and direct Prisma queries.

## Consequences
### Positive
- **Brand Consistency:** The admin panel shares the exact same luxury design system, typography (Vazirmatn), and color tokens as the public customer-facing site.
- **Zero Third-Party Licensing Cost:** Eliminates monthly subscription fees for third-party headless CMS services (Contentful, Sanity, Strapi Cloud).
- **Deep Domain Integration:** Custom views for leads, appointment requests, and live dynamic theme toggling integrate directly with database models without glue APIs.
- **Unified Deployment:** Frontend, API layer, and back office deploy as a single cohesive artifact to Vercel.

### Negative / Trade-offs
- UI components, CRUD forms, and table pagination must be maintained in-house.
- Requires building role-based permission checks and authentication middleware directly into Next.js routes.

## Alternatives Considered
- **Strapi / Directus:** Required maintaining separate Node.js server instances, additional hosting infrastructure on Vultr, and managing multi-origin API sync.
- **WordPress / WooCommerce:** Rejected due to performance bloat, poor Next.js integration, and severe maintenance overhead.
