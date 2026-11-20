# Product Requirements (PRD)

IDs are stable. Priority: MUST, SHOULD, COULD. Release tags refer to BACKLOG.md (R1 unless stated). AC = acceptance criteria.

## 1. Scope
In scope: unified contact identity, lead pipeline, tasks, activity timeline, support inbox, customer 360 v2, dedupe/merge, CSV import/export, saved views, health score, reports, admin IA and design kit, expiry redesign, near-expiry discount, appointments (R2), permissions (R2).

Out of scope: native mobile apps, public REST API, multi-clinic tenancy, accounting/invoicing, gateways beyond ZarinPal, live chat, email marketing, English UI, medical imaging.

## 2. Functional requirements

### Identity and lifecycle
| ID | Pri | Requirement | AC |
|---|---|---|---|
| FR-CRM-001 | MUST | Lead, ContactMessage, MarketingContact and Customer resolve to one `Contact` by normalised phone | Two leads with the same phone yield one Contact; email-only records stay unlinked |
| FR-CRM-002 | MUST | Lifecycle stage per contact, computed nightly, manual override | Stage shown in lists, 360, segments; override survives recompute |
| FR-CRM-003 | MUST | Lead promoted to Customer on registration or first order by phone | Lead becomes WON, `customerId` set, activity written |
| FR-CRM-004 | MUST | Phone normalised on Lead and ContactMessage; backfill script | `normalizedPhone` populated and indexed |

### Pipeline, tasks, timeline
| ID | Pri | Requirement | AC |
|---|---|---|---|
| FR-CRM-010 | MUST | Lead stages NEW, CONTACTED, QUALIFIED, APPOINTMENT_BOOKED, WON, LOST with allowed transitions and lost reason | Invalid transition rejected; LOST needs reason |
| FR-CRM-011 | MUST | Kanban and table views; owner and follow-up date editable | Moving a card changes stage and writes activity |
| FR-CRM-012 | MUST | `CrmTask` with owner, due, priority, type, links | Create, complete, snooze; "my day" list |
| FR-CRM-013 | MUST | Auto-tasks: NEW lead older than 4h, follow-up due, overdue vaccine, abandoned cart over threshold | Idempotent via dedupe key |
| FR-CRM-014 | MUST | `CrmActivity` append-only timeline with idempotent writers | 360 timeline sorted desc, filter by type |
| FR-CRM-015 | SHOULD | Backfill timeline from existing tables | Re-runnable, no duplicates |

### Support inbox
| ID | Pri | Requirement | AC |
|---|---|---|---|
| FR-CRM-020 | MUST | ContactMessage becomes a ticket: status, assignee, priority, customer link | OPEN, PENDING, RESOLVED, CLOSED workflow |
| FR-CRM-021 | MUST | Reply thread (internal note or outbound SMS), SLA timestamps | `firstResponseAt` set on first non-internal reply |
| FR-CRM-022 | COULD (R3) | Customer-visible thread in /account | |

### 360, dedupe, import, views
| ID | Pri | Requirement | AC |
|---|---|---|---|
| FR-CRM-030 | MUST | 360 shows timeline, orders and payments, consent, owner, health, tasks, tickets, leads | No N+1 across 100 orders |
| FR-CRM-031 | MUST | Duplicate finder (phone, email, fuzzy name + pet) | Candidates with reasons |
| FR-CRM-032 | MUST | Transactional merge; loser keeps `mergedIntoId`; audited | Orders, pets, visits, points, coupons, notes, outbox re-pointed; balance equals ledger sum |
| FR-CRM-033 | MUST | CSV import with preview, dry run, per-row errors | Imported rows `source=IMPORT`, no SMS consent |
| FR-CRM-034 | MUST | CSV export for customers, leads, tickets, tasks honouring filters; audited | Log has filter and row count |
| FR-CRM-035 | MUST | Saved views per entity, private or shared | Reopen restores filters, sort, page size |
| FR-CRM-036 | SHOULD | Segments with OR groups, lifecycle/owner/health criteria | Preview count equals send count |

### Score and reports
| ID | Pri | Requirement | AC |
|---|---|---|---|
| FR-CRM-040 | MUST | Health score 0-100 and churn risk nightly, with history | Formula in CRM-SPEC section 9 |
| FR-CRM-041 | MUST | Reports: lead funnel by source/UTM, lifecycle distribution, task completion, ticket SLA, campaign performance, expiry value at risk | Date range filter, CSV export |

### Appointments (R2)
| ID | Pri | Requirement |
|---|---|---|
| FR-APT-001 | MUST (R2) | Public booking form (service, vet, slot) linking contact and lead |
| FR-APT-002 | MUST (R2) | Admin calendar: confirm, reschedule, check-in, complete, no-show, cancel |
| FR-APT-003 | MUST (R2) | SMS confirmation and reminder via outbox; completion creates `ServiceVisit` and awards points |

### Admin platform
| ID | Pri | Requirement | AC |
|---|---|---|---|
| FR-ADM-001 | MUST | New sidebar IA (22 items, 6 groups), role filtered | Existing routes still reachable |
| FR-ADM-002 | MUST | Shared design kit | ADMIN-IA section 7 |
| FR-ADM-003 | MUST | Standard list pattern: URL state, server pagination, count, empty/error/skeleton | Applied to leads, messages, orders, customers, audit |
| FR-ADM-004 | MUST | `confirmDialog` replaces `window.confirm` | No `confirm(` left in components/admin |
| FR-ADM-005 | MUST | Global search and command palette (Ctrl+K) | Grouped results under 300 ms |
| FR-ADM-006 | SHOULD | Staff notification centre | Unread count in header |
| FR-ADM-007 | MUST | Role-aware dashboard work queue | ADMIN-IA section 4 |
| FR-ADM-008 | SHOULD (R2) | Per-module permissions, roles RECEPTION and VET | CRM-SPEC section 10 |
| FR-ADM-009 | SHOULD (R2) | Admin TOTP 2FA | |
| FR-ADM-010 | MUST | Remove dead `isEn` branches; split `products-manager` | No behaviour change; e2e green |

### Expiry
| ID | Pri | Requirement |
|---|---|---|
| FR-EXP-001 | MUST | Expiry block in product editor |
| FR-EXP-002 | MUST | Product list expiry column, badge, filter |
| FR-EXP-003 | MUST | Inventory board with urgency groups, stat tiles as filters, batch drawer, multi-line entry |
| FR-EXP-004 | MUST | Adjust with reason and write-off, audited |
| FR-EXP-005 | MUST | Configurable thresholds (defaults 90/30/7) |
| FR-EXP-006 | MUST | Single storefront expiry presentation; date stored per order line |
| FR-EXP-007 | SHOULD | Near-expiry discount via coupon engine |
| FR-EXP-008 | SHOULD | Daily digest to admins via outbox |

## 3. Non-functional requirements
- Performance: admin list p95 under 400 ms at 700+ products and 10k customers; no unbounded queries; default page 25, max 100; storefront LCP under 2.5 s (existing Lighthouse workflow).
- Security: every admin action uses `requireAdmin(minRole)`, zod, `logAdminChange`; exports and merges gated and audited; rate limits on public actions; no secrets in logs.
- Privacy and consent: marketing SMS only with `marketingSmsConsent`; STOP honoured; import defaults to no consent; deletion path in runbook; no PII in URLs.
- RTL: Farsi only, logical properties, Jalali via `lib/date`, phones via `lib/utils/phone`, text via `lib/text`.
- Accessibility: labelled icon buttons, `role=tablist`, colour never the only signal, focus-visible, 44px targets, no horizontal page scroll at 360px.
- Reliability: migrations additive, idempotent and registered in `scripts/release-db.mjs`; hooks wrapped in `safely()`; idempotent writers via unique keys.
- Testability: unit tests per epic; e2e with data-testids from CONTRACT.md; tests only against the local DB.

## 4. Risks
| Risk | Mitigation |
|---|---|
| Migration not registered in release-db, silently skipped | CONTRACT requires registration plus a unit test comparing migration dirs to the registry |
| Schema merge conflicts between parallel developers | One owner each for `schema.prisma` and `admin-shell.tsx` |
| Merge corrupts points or orders | Transaction, dry-run preview, invariant tests |
| Consent violations via import or automation | Default no consent; central consent check in the send path |
| Splitting products-manager breaks the shop | Mechanical split, product e2e specs stay green |
| Leads without phone cannot be matched | Email link plus manual merge tool |
| Production DB host unverified | Owner confirms; additive-only migrations |
