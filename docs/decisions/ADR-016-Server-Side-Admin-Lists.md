# ADR 016: Server-side admin lists

- **Status:** Accepted
- **Date:** 2026-11

## Context
Admin lists loaded 50-200 rows and filtered in the browser, silently truncating data.

## Decision
Every admin list filters, sorts and pages on the server (`skip`/`take` plus count) with state in the URL (`useUrlState`), using `DataTable`, `FilterBar` and `Pager` from `components/admin/kit`. No list may cap rows without a pager.
