# ADR 013: Activity timeline

- **Status:** Accepted
- **Date:** 2026-11

## Context
Staff need one history per customer across orders, visits, messages, points and tasks.

## Decision
An append-only `CrmActivity` table written by `recordActivity` (idempotent per type, refType, refId; never throws, so a hook failure cannot break an order). The customer 360 reads it with cursor paging. Lifecycle stage and health score are computed from it by the daily job (`lib/crm/daily.ts`, called from the club cron).
