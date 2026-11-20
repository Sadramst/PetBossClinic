# Contributing

## Workflow
Branch from `main` (`feature/...`, `fix/...`) and open a PR; `main` is protected by CI. Commits follow Conventional Commits (`feat(crm): ...`). Never push directly to `main`.

## Before a PR
Run `npm run test:all` (typecheck, lint, unit, integration on a local DB, build, e2e at desktop and 360px). Never run tests against a non-local database; `tests/helpers/local-db.ts` guards this.

## Conventions
- Farsi only; all copy in polished Persian; logical CSS properties; no horizontal overflow at 360px.
- Money in Toman; dates Jalali via `lib/date`; normalise text with `lib/text`.
- Admin actions: `requireAdmin(minRole)`, zod, rate limit, `logAdminChange`; return `{ ok, data }` or `{ ok: false, error }`.
- Account pages use `requireCustomer`.
- Files marked use-server export only async functions; helpers and types live in `lib/`.
- Use `confirmDialog`, never `window.confirm`. Use `components/ui/*` and `components/admin/kit`.
- Admin lists are filtered and paged on the server (ADR-016).
- Migrations are additive and idempotent; keep `schema.prisma` and `prisma/migrations` in sync.
- Every bug fix ships a test. Never commit secrets.

## PR checklist
- test:all is green
- Persian copy reviewed
- 360px checked
- migration is safe and in sync with the schema
- docs updated
- new `data-testid`s listed in the PR
