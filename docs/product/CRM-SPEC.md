# CRM Specification (target)

Principle: `Customer` stays the account and source of truth. A lightweight `Contact` spine sits above it. Everything is additive; legacy `Lead.status` string stays until the UI reads `stage`.

## 1. Unified contact identity
- `Contact` = one real person. Keys: normalised mobile (`normalizeMobile`, 09xxxxxxxxx) unique; email unique optional.
- Resolution on every write (lead, message, marketing capture, registration, order, import):
  1. Normalise phone. If present, find or create Contact by phone.
  2. If no phone but email: find Contact by email, else create email-only Contact.
  3. Email never merges two phone-different contacts; it only links a new record to an existing Contact.
  4. Link `contactId` on the source record. If a Customer exists with that phone, set `Contact.customerId`.
- Module: `lib/crm/contacts.ts` (`resolveContact`).

## 2. Lifecycle stages
Computed nightly by `lib/crm/lifecycle.ts`; `stageOverride` wins until cleared.

| Stage | Rule (first match top to bottom) |
|---|---|
| BLOCKED | Customer.isBlocked |
| VIP | Customer, tier at top tier OR totalSpent in top 5% OR healthScore >= 85 with 3+ orders in 12 months |
| NEW_CUSTOMER | Customer, joined within 30 days or ordersCount <= 1 with last order within 45 days |
| AT_RISK | Customer, healthScore < 40 OR (last order/visit 90-180 days ago and ordersCount >= 2) |
| LAPSED | Customer, no order or visit for over 180 days |
| ACTIVE | Customer otherwise |
| PROSPECT | No customer, has a lead at QUALIFIED or APPOINTMENT_BOOKED |
| LEAD | No customer, has a lead not LOST |
| SUBSCRIBER | Only a MarketingContact or newsletter record |

LOST leads with no other signal stay SUBSCRIBER if consented, else LEAD (kept for dedupe).

## 3. Lead pipeline
Stages: NEW, CONTACTED, QUALIFIED, APPOINTMENT_BOOKED, WON, LOST.

| From | Allowed to |
|---|---|
| NEW | CONTACTED, QUALIFIED, LOST |
| CONTACTED | QUALIFIED, APPOINTMENT_BOOKED, LOST, NEW (reopen) |
| QUALIFIED | APPOINTMENT_BOOKED, WON, LOST, CONTACTED |
| APPOINTMENT_BOOKED | WON, LOST, QUALIFIED |
| WON | (terminal; reopen by ADMIN only to QUALIFIED) |
| LOST | NEW (reopen), requires reason when entering |

Rules: owner auto-assigned round robin among active RECEPTION/ADMIN users (R1: unassigned, "assign to me" action). Every transition writes `CrmActivity` and sets `stageChangedAt`. WON auto-set when the phone registers or orders. Lost reasons: NO_RESPONSE, PRICE, NOT_INTERESTED, WENT_ELSEWHERE, DUPLICATE, OTHER.
Mapping of legacy `status`: NEW to NEW, CONTACTED to CONTACTED, QUALIFIED to QUALIFIED, BOOKED to APPOINTMENT_BOOKED, CONVERTED/WON to WON, LOST/CLOSED to LOST, unknown to NEW.

## 4. Tasks and follow-ups
`CrmTask`: title, type (CALL, SMS, FOLLOW_UP, VACCINE_REMINDER, WIN_BACK, CART, OTHER), status (OPEN, IN_PROGRESS, DONE, CANCELLED), priority 1 high to 3 low, dueAt, ownerId, links (contact, customer, lead, ticket), `dedupeKey` unique for system tasks.

Auto-task generators (cron `generateCrmTasks`, daily plus on demand):
| Trigger | Task | Owner | Due |
|---|---|---|---|
| Lead NEW older than 4h | تماس با درخواست جدید | unassigned | now |
| `Lead.followUpDate` reached | پیگیری | lead owner | follow-up date |
| `PetRecord.nextDueAt` within 7 days, no reminder sent | یادآوری واکسن | unassigned | nextDueAt minus 3 days |
| Cart snapshot value over threshold (config, default 1,500,000 Toman) idle 24h | پیگیری سبد | unassigned | now |
| Customer enters AT_RISK and was VIP or 3+ orders | تماس بازگشت | owner or unassigned | +2 days |
| Ticket OPEN over 4 working hours | پاسخ به پیام | assignee | now |

"My day" = tasks owned by me or unassigned (for RECEPTION), overdue first, then due today.

## 5. Activity timeline
Append-only `CrmActivity`; unique `(type, refType, refId)`; writer `recordActivity()` is safe (never throws into callers).

Event types: LEAD_CREATED, LEAD_STAGE_CHANGED, LEAD_PROMOTED, CONTACT_MESSAGE_RECEIVED, TICKET_REPLIED, TICKET_STATUS_CHANGED, NOTE_ADDED, TASK_CREATED, TASK_COMPLETED, ORDER_PLACED, ORDER_PAID, ORDER_DELIVERED, ORDER_CANCELLED, VISIT_LOGGED, PET_RECORD_ADDED, POINTS_AWARDED, POINTS_ADJUSTED, REWARD_REDEEMED, COUPON_ISSUED, COUPON_REDEEMED, SMS_SENT, SMS_FAILED, SMS_INBOUND, CONSENT_CHANGED, CART_ABANDONED, APPOINTMENT_REQUESTED, APPOINTMENT_STATUS_CHANGED, CUSTOMER_MERGED, OWNER_CHANGED, IMPORTED.

## 6. Support inbox
- `ContactMessage` gains status OPEN, PENDING, RESOLVED, CLOSED; assignee; priority (LOW, NORMAL, HIGH); contact and customer links; `firstResponseAt`, `resolvedAt`.
- `TicketReply`: internal note or outbound SMS (via outbox, kind `TICKET_REPLY`, consent not required for transactional replies to the sender but STOP list is still respected).
- Transitions: OPEN to PENDING (waiting on customer) to RESOLVED to CLOSED; any customer inbound reopens RESOLVED to OPEN. `isRead` kept in sync (read when opened).
- SLA: first response target 4 working hours, resolution 2 days; breaches flagged in the list and report.

## 7. Dedupe and merge
Detection (`lib/crm/dedupe.ts`): exact normalised phone on Contact or Customer; exact email; fuzzy name (normalised Persian, trigram similarity >= 0.8) plus matching pet name or same city.
Merge rules (`mergeCustomers(survivorId, loserId, adminId)`), one transaction:
1. Refuse if survivor and loser are the same, or either is already merged.
2. Re-point: Address, Order, Payment-through-order, Pet, ServiceVisit, PointsTransaction, RewardRedemption, AdminCustomerNote, MessageOutbox, Coupon, CouponRedemption, CustomerGroupMember (skip duplicates), MarketingContact, Lead, ContactMessage, CrmTask, CrmActivity.
3. Survivor keeps its phone/password; fills empty fields (email, birthDate, city) from loser; tags union; pointsBalance and lifetimePoints recomputed from ledger; `recomputeOrderStats` run.
4. Loser: `mergedIntoId` set and `isBlocked` true; its phone is kept (unique constraint stays valid). `resolveContact` and login follow `mergedIntoId` to the survivor, so no new customer is created for that phone.
5. Write AuditLog and `CUSTOMER_MERGED` activity. ADMIN role minimum.

## 8. Import and export
Import (customers): CSV UTF-8, columns `phone,name,email,city,birthDate(jalali or iso),tags,notes`. Steps: upload, parse, preview (valid, duplicates by phone, invalid), confirm. Errors per row downloadable. Created with `source=IMPORT`, `marketingSmsConsent=false`, no welcome SMS, no automations for first 24h. Max 5,000 rows per file.
Export: customers, leads, tickets, tasks; same filters as list; cap 10,000 rows; columns whitelist; ADMIN only; AuditLog entry with filter JSON and count.

## 9. Health score and churn risk
Nightly `lib/crm/health.ts`, customers only. Score = round(0.35*R + 0.25*F + 0.15*M + 0.15*E + 0.10*C), each 0-100.
- R recency: days since last order or visit d. R = 100 if d <= 30; linear to 0 at d >= 240.
- F frequency: orders + visits in last 12 months n. F = min(100, n * 20).
- M monetary: totalSpent percentile among customers (0-100), 0 if never ordered.
- E engagement: 50 if SMS consent, +25 if any SMS delivered in 90 days, +25 if coupon redeemed in 180 days.
- C care: 100 if no overdue pet record; 50 if one overdue under 60 days; 0 otherwise; 60 if no pets.
Churn risk: HIGH if score < 35 or (d > 120 and n >= 2 over lifetime); MEDIUM if score < 60; else LOW. Snapshot stored at most once per day per customer, only when score or risk changes.

## 10. Ownership and permissions
Existing hierarchy SUPER_ADMIN > ADMIN > EDITOR > AUTHOR > VIEWER stays. R1 enforces by `minRole`; R2 adds roles RECEPTION and VET and per-module permission keys via `Permission`/`RolePermission` (default grants below).

| Capability | VIEWER | EDITOR | ADMIN | SUPER_ADMIN | RECEPTION (R2) | VET (R2) |
|---|---|---|---|---|---|---|
| View customers, leads, tickets, tasks | read | read | read | read | read | read |
| Edit leads, tasks, notes, reply tickets | no | yes | yes | yes | yes | notes only |
| Move lead stages, assign owner | no | yes | yes | yes | yes | no |
| Log visits and pet records | no | no | yes | yes | yes | yes |
| Points adjust, issue coupon | no | no | yes | yes | no | no |
| Export CSV | no | no | yes | yes | no | no |
| Import CSV | no | no | yes | yes | no | no |
| Merge customers | no | no | yes | yes | no | no |
| Block customer, delete | no | no | yes | yes | no | no |
| Inventory adjust, write-off | no | no | yes | yes | no | no |
| Saved views | own | own | own and shared | all | own | own |
| Manage users, settings | no | no | settings | all | no | no |

Mapping in R1: read = VIEWER, write = EDITOR, sensitive = ADMIN. Every sensitive action calls `logAdminChange`.

## 11. Saved views
`SavedView(entity, name, filters JSON, sort, ownerId, shared)`; entities: CUSTOMER, LEAD, TICKET, TASK, ORDER, PRODUCT. Filters use the segment rules format for customers (`SegmentRules` extended) and a flat key/value format elsewhere.

## 12. Reports
All server-side aggregated, date range, CSV export.
1. Funnel: leads by source/UTM, contacted, qualified, booked, won, conversion %, median time to first contact.
2. Customers: new vs returning, lifecycle distribution, churn list (HIGH risk, sorted by lifetime spend).
3. Operations: tasks created/completed/overdue by owner; ticket first-response and resolution times, SLA breaches.
4. Messaging: per campaign sent, failed, converted (coupon redemption attribution), unsubscribe rate.
5. Inventory: expiry value at risk by state, write-offs by reason.
