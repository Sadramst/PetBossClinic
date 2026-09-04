# ADR 004: Hybrid Deployment Architecture (Vercel Edge + Vultr Dedicated Compute)

- **Status:** Accepted
- **Deciders:** Senior Software Architect, DevOps Lead
- **Date:** 2026-09-04

---

## Context
Pet Boss Clinic requires high-availability global web hosting, fast edge caching for static assets, and an isolated, high-performance database cluster capable of running PostgreSQL 16 and connection pooling.

Key constraints:
- Global CDN with low latency for visitors in Iran, the Middle East, and internationally.
- Complete data sovereignty and ownership over database backups, with no vendor lock-in on data storage.
- Predictable and cost-effective hosting expenses.

## Decision
We adopted a **Hybrid Cloud Model**:
1. **Frontend & Serverless Compute:** Hosted on **Vercel** connected to the `main` GitHub repository branch.
2. **Database & Persistent Storage:** Hosted on a dedicated **Vultr Compute VPS** (`95.179.243.160`) running Docker Compose with PostgreSQL 16 and pgBouncer.

## Consequences
### Positive
- **Optimal Web Delivery:** Vercel edge nodes cache HTML and static assets (Vazirmatn fonts, images, CSS tokens) globally, maximizing Core Web Vitals.
- **Full Database Control:** Dedicated PostgreSQL instance on Vultr allows custom PostgreSQL extensions, pgBouncer connection pooling, custom memory tuning, and direct encrypted daily backups.
- **Cost Efficiency:** High-throughput database operations run on flat-rate VPS compute rather than metered serverless database billing.

### Negative / Trade-offs
- Network latency between Vercel serverless functions and Vultr PostgreSQL must be minimized by selecting geographically proximal regions (Frankfurt / Amsterdam).
- Server hardening, OS patching, firewall maintenance, and Docker backup scripts on Vultr are managed internally.

## Alternatives Considered
- **All-in-Vercel (Vercel Postgres / Neon):** Rejected due to serverless database cold starts and recurring usage-based pricing models.
- **All-in-Vultr (Self-hosted Node.js + Postgres):** Rejected because maintaining global Anycast CDN, automatic SSL certificates, and zero-downtime atomic deployments manually would significantly increase DevOps overhead.
