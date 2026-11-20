# ADR 015: Release-time migrations

- **Status:** Accepted
- **Date:** 2026-11

## Context
Prisma migrate is not run on Vercel.

## Decision
`npm run build` runs `scripts/release-db.mjs`, which acts only when `VERCEL_ENV=production`, applies unapplied SQL in `prisma/migrations` in a transaction and fails the build on error (the old site stays live). Migrations must be additive and idempotent, and must stay in sync with `schema.prisma`. `db-migrate.yml` runs a manual `prisma db push` and is risky; replacing it is a cleanup item.
