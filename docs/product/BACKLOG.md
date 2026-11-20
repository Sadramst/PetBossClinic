# Backlog and Release Plan

Estimates: S (under 1 day), M (1-3 days), L (3-6 days) for one engineer. IDs: `E<epic>-S<n>`. Every story's AC includes: unit tests, no regression in existing e2e, Persian copy, 360px no overflow. Epic ownership of files is in CONTRACT.md section 7.

## Build status (after the R1 build)
Legend: DONE built and verified by tests; PARTIAL built, gaps listed; TODO not built. Full `test:all` result is recorded by the orchestrator.

| Epic | Status | Notes |
|---|---|---|
| E0 Foundation | DONE | Migration `20261123_crm_v2` applied; `scripts/backfill-crm.ts` and its run in release-db need confirmation; E0-S4 files deleted |
| E1 Admin kit | DONE | 13 kit tests |
| E2 CRM core libs | DONE | contacts, activity, lifecycle, health, promote |
| E3 Leads and tasks | DONE | pages, actions, board and list; prefill of tasks from other screens TODO |
| E4 Support inbox | DONE | SLA, replies via outbox |
| E5 Customer 360 v2 | PARTIAL | health card and timeline added; old 360 tabs and customers manager patched, not rewritten; `?new=1` TODO |
| E6 Data tools | DONE | duplicates, merge, import, export, saved views; 21 integration tests |
| E7 Health and reports | PARTIAL | health done; reports hub tabs (expiry tab) need confirmation |
| E8 Shell, dashboard, search, notifications | DONE | 25 nav items, palette, bell, role dashboard |
| E9 Expiry and catalogue | PARTIAL | inventory board, products list, storefront strip, digest done; product editor expiry block, products split, listing-card badge, E9-S4 TODO |
| E10 Admin hygiene | PARTIAL | audit, boundaries, role alignment done; orders on kit, other managers, `confirmDialog` sweep, e2e specs partly TODO |
| E11 Docs | DONE | this documentation pass |
| R2, R3, Cleanup | TODO | |

## Release plan
| Release | Theme | Epics |
|---|---|---|
| R1 (this build) | CRM backbone, admin platform, expiry | E0-E10 below |
| R2 | Appointments, permissions, 2FA, clearance pricing, product reviews | E11-E14 |
| R3 | Customer ticket portal, returns/refunds, purchasing/suppliers, bundles | E15-E17 |

R1 is parallel: E0 lands first (schema, migration, kit skeleton types), then E1-E10 run in parallel against the contract; E8 (shell) integrates last.

## R1 epics

### E0 Foundation (schema, migration, config) , owner: foundation dev
| ID | Story | Est | Depends | AC |
|---|---|---|---|---|
| E0-S1 | Prisma additions per CONTRACT section 2 | M | none | `prisma validate` passes; `prisma generate` ok |
| E0-S2 | Migration `20261123_crm_v2` additive and idempotent, registered in `release-db.mjs` with `applied()` check | M | S1 | applied twice without error on local DB; unit test checks registry contains every `2026*` dir |
| E0-S3 | Backfill script `scripts/backfill-crm.ts` (contacts, normalizedPhone, lead stage, activities) | M | S2 | re-runnable; counts printed; no duplicates |
| E0-S4 | Delete `walkthrough.md`, `scaffold/seed-data.md`, drop `nameEn/slugEn` plan noted (not R1) | S | none | files removed |

### E1 Admin design kit , owner: kit dev
| E1-S1 | Components in CONTRACT section 5 with tests | L | none | each has RTL render test; DataTable mobile card; a11y labels |
| E1-S2 | `useUrlState` and `ExpiryBadge`/`StatusBadge` | S | none | unit tests for state to label mapping |

### E2 CRM core libs , owner: crm-core dev
| E2-S1 | `resolveContact`, phone normalisation on write | M | E0 | FR-CRM-001/004 tests including email-only and merged follow |
| E2-S2 | `recordActivity` + hook wiring in `lib/club/hooks.ts` (order, visit, points, outbox, coupon) | M | E0 | idempotent; hook failure never breaks order |
| E2-S3 | Lifecycle compute `lib/crm/lifecycle.ts` + `runCrmDaily` called from existing club cron | M | E0, E7-S1 | rules table tests per stage |
| E2-S4 | Lead promotion on registration/first order | S | S1 | FR-CRM-003 e2e |

### E3 Leads and tasks , owner: leads dev
| E3-S1 | Lead pipeline actions, transitions, lost reason | M | E0,E2-S1 | invalid transition rejected |
| E3-S2 | Leads page: table + kanban, owner, follow-up, convert | L | E1,S1 | `data-testid`s of contract |
| E3-S3 | `CrmTask` actions + `/admin/tasks` (my day) | M | E0,E1 | complete, snooze, create |
| E3-S4 | Auto-task generators `lib/crm/task-gen.ts` | M | S3 | dedupe test |
| E3-S5 | Public lead action resolves contact, normalises phone | S | E2-S1 | honeypot + rate limit preserved |

### E4 Support inbox , owner: inbox dev
| E4-S1 | Ticket status, assign, priority, replies, SLA fields | M | E0 | FR-CRM-020/021 |
| E4-S2 | Messages page as inbox (list + thread drawer), outbound SMS reply via outbox | L | E1 | reply creates TicketReply and outbox row; STOP respected |

### E5 Customer 360 v2 , owner: customer dev
| E5-S1 | `getCustomer360` adds contact, leads, tickets, tasks, health, consent | M | E0,E2 | no N+1 |
| E5-S2 | Timeline tab with filters | M | E2-S2 | FR-CRM-014 |
| E5-S3 | Customers list on kit with server pagination, owner and lifecycle filters, bulk tag/assign | L | E1 | FR-ADM-003 |
| E5-S4 | Owner assignment, quick actions (task, note, SMS) | S | S1 | |

### E6 Data tools (dedupe, merge, import, export, saved views) , owner: data-tools dev
| E6-S1 | Dedupe finder + `/admin/customers/duplicates` | M | E0 | FR-CRM-031 |
| E6-S2 | `mergeCustomers` transactional + invariant tests | L | S1 | FR-CRM-032 |
| E6-S3 | CSV import with preview `/admin/customers/import` | L | E0 | FR-CRM-033 |
| E6-S4 | Export for leads, tickets, tasks (customers exists), audited | S | E0 | FR-CRM-034 |
| E6-S5 | Saved views model, actions, `SavedViews` control | M | E1 | FR-CRM-035 |

### E7 Health and reports , owner: reports dev
| E7-S1 | `computeHealth` + snapshots + segment criteria extension | M | E0 | formula tests |
| E7-S2 | `/admin/reports` tabs: funnel, customers, operations, messaging, expiry | L | E1,E0 | FR-CRM-041 |

### E8 Admin shell, IA, dashboard, search, notifications , owner: shell dev
| E8-S1 | New SECTIONS IA, unique icons, badges from one query | M | E1 | all old routes reachable (e2e) |
| E8-S2 | Dashboard work queue by role | L | E1,E3,E9 libs | ADMIN-IA section 4 |
| E8-S3 | Command palette + `globalSearchAction` | M | E1 | FR-ADM-005 |
| E8-S4 | Notification centre + `notifyStaff` | M | E0 | FR-ADM-006 |
| E8-S5 | Header quick-create, breadcrumbs wiring | S | E1 | |

### E9 Expiry and catalogue , owner: expiry dev
| E9-S1 | Configurable thresholds `ExpiryConfig`, `getExpiryConfig` | M | E0 | FR-EXP-005 |
| E9-S2 | Inventory board + batch Drawer + multi-line entry | L | E1 | FR-EXP-003 |
| E9-S3 | Adjust with reason, write-off, `InventoryAdjustment` | M | E0 | FR-EXP-004 |
| E9-S4 | Product editor expiry block, list column + filter; strip `isEn`, split `products-manager` | L | E1 | FR-EXP-001/002, FR-ADM-010 |
| E9-S5 | Storefront single expiry strip, near-expiry badge, per-line expiry in allocations and order detail | M | S1 | FR-EXP-006 |
| E9-S6 | Expiry digest in cron, coupon prefill action | M | S1,E8-S4 | FR-EXP-007/008 |

### E10 Admin hygiene , owner: hygiene dev
| E10-S1 | Replace `window.confirm` with `confirmDialog` in managers not owned by other epics | M | none | grep clean |
| E10-S2 | Orders and audit lists on kit with server pagination, totals | M | E1 | no `take` cap without pager |
| E10-S3 | `loading.tsx` and `error.tsx` for admin routes not owned elsewhere; aria labels | M | E1 | |
| E10-S4 | e2e: admin IA + CRM smoke specs `tests/e2e/crm-*.spec.ts` | L | all | covers lead to customer, task, ticket, merge, import |

### E11 Docs , owner: docs dev
Rewrite README, runbook, infra, dns, contributing, testing, test-flow, architecture, data-model, admin-panel, theming, i18n, roadmap, ADRs per audit; delete `docs/decisions/ADR-009`; new ADRs (Farsi-only, customer auth, outbox, club ledger, expiry batches, release-db policy, CRM identity spine). Est L. No code conflicts.

## R2
| ID | Story | Est |
|---|---|---|
| E12-S1..S4 | Appointments: models wired, public booking, admin calendar, SMS reminders, visit + points on completion | L x2 |
| E13-S1..S3 | Roles RECEPTION and VET, permission keys enforced in `requireAdmin`, TOTP 2FA | L |
| E14-S1..S3 | Clearance pricing per batch, clearance collection, product reviews + NPS automation | L |

## R3
| E15 | Customer ticket thread in /account | M |
| E16 | Returns, refunds, partial cancel, invoice print, shipment tracking | L |
| E17 | Suppliers, cost price, purchase-in, margin report | L |

## Cleanup (any release, after production row counts verified zero)
Drop `PetOwner`, `LegacyPet`, `MedicalRecord`, `VaccinationRecord`; drop `nameEn/slugEn`; remove `messages/en.json`; reconcile `db-migrate.yml` `db push`; distributed rate limiting (ADR-008).
