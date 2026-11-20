# ADR 010: Farsi-only site

- **Status:** Accepted
- **Date:** 2026-11

## Context
The English locale was unused and doubled content cost.

## Decision
`locales: ['fa']`, `localePrefix: never`; middleware 301-redirects `/en/*` and `/fa/*`. UI copy is Persian, dates Jalali, money Toman. `messages/en.json`, `nameEn` and `slugEn` are legacy and scheduled for removal.
