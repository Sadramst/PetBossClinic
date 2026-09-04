# ADR 002: PostgreSQL 16 & Prisma ORM

- **Status:** Accepted
- **Deciders:** Senior Software Architect
- **Date:** 2026-09-04

---

## Context
Pet Boss Clinic requires a strongly typed, relational data layer capable of supporting clinic services, staff credentials, bilingual species and breed taxonomies, inventory counts, audit trails, and future e-commerce orders and electronic medical records.

Key constraints:
- Must guarantee relational integrity across medical records, pet profiles, and clinic appointments.
- Must support JSON fields for dynamic theming tokens, working hours, and social channels.
- Must provide end-to-end TypeScript safety from database schema to UI components.

## Decision
We adopted **PostgreSQL 16** as the relational database engine, paired with **Prisma ORM 6.x** as the query builder and migration management layer.

## Consequences
### Positive
- **Complete Type Safety:** Prisma automatically generates TypeScript types matching every table and relation, eliminating runtime mismatches.
- **Relational Integrity:** Foreign key constraints, cascade deletes, and relational indexes prevent orphaned records.
- **Declarative Migrations:** `prisma/schema.prisma` serves as the single source of truth for schema evolution across development and production.
- **Complex Filtering & Indexing:** Excellent indexing support on localized slugs (`slugFa`, `slugEn`) and sort orders (`isActive`, `sortOrder`).

### Negative / Trade-offs
- PgBouncer integration requires careful tuning: default `search_path` parameters must be accommodated, and connection pooling must be separated into pooled port `6432` and direct migration port `5432`.
- Prisma client generation binary must be explicitly generated in build scripts (`npx prisma generate`).

## Alternatives Considered
- **MongoDB / Document Store:** Rejected due to weak multi-table relational guarantees for billing, orders, and veterinary patient records.
- **Drizzle ORM:** Excellent lightweight alternative, but Prisma provided superior tooling for declarative schema modeling and rapid prototyping.
