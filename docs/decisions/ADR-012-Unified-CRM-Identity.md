# ADR 012: Unified CRM identity

- **Status:** Accepted
- **Date:** 2026-11

## Context
Leads, messages, marketing contacts and customers were four silos.

## Decision
A `Contact` identity resolved by normalised mobile number (`+98` and `09` spellings are one person) via `resolveContact` in `lib/crm/contacts.ts`. Leads promote to Customer on registration or first order (`lib/crm/promote.ts`). Duplicate customers are merged transactionally (`lib/crm/merge.ts`): children are re-pointed, the points ledger is rebuilt, the loser becomes a blocked shell with `mergedIntoId`.
