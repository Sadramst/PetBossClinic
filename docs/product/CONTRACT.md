# Engineering Contract: R1 (CRM v2)

Binding for parallel developers who do not talk to each other. If something is not here, follow existing conventions (read neighbouring code first). If you need a change in a file you do not own, do not edit it: write the need in your final report and use only what this contract defines.

Conventions that apply to everything: `'use server'` files export only async functions (types and sync helpers live in `lib/`); admin actions use `requireAdmin(minRole)` + zod + `logAdminChange`; account pages use `requireCustomer`; Persian UI copy; logical CSS properties; money in Toman; Jalali dates through `lib/date`; phones through `lib/utils/phone` (`normalizeMobile`); tests only against the local DB; no `window.confirm`; no unbounded `findMany` (every list is paginated, max 100).

Action result shape: reuse the shape already used in `app/actions/*` (read `app/actions/leads.ts`). Below, `Result<T>` means `{ ok: true, data: T } | { ok: false, error: string }`; adapt to the existing shape if it differs but keep it consistent within your files.

## 1. Build order
1. E0 Foundation (schema, migration, registry, backfill). Everyone else may code against the contract immediately, but cannot run DB tests until E0 lands. E0 must land first (target: first).
2. E1 Kit and E2 CRM core libs (everyone imports these). Stub exports exist from the contract paths as soon as E1/E2 push; until then code against the signatures.
3. E3, E4, E5, E6, E7, E9, E10 in parallel.
4. E8 shell last (consumes everything), then E10-S4 e2e.
Integration rule: an epic never imports a module of another epic that is not listed in section 3 or 5.

## 2. Prisma additions (owner E0 only; additive; migration `prisma/migrations/20261123_crm_v2/migration.sql`)

```prisma
enum LifecycleStage { SUBSCRIBER LEAD PROSPECT NEW_CUSTOMER ACTIVE AT_RISK LAPSED VIP BLOCKED }
enum LeadStage { NEW CONTACTED QUALIFIED APPOINTMENT_BOOKED WON LOST }
enum LostReason { NO_RESPONSE PRICE NOT_INTERESTED WENT_ELSEWHERE DUPLICATE OTHER }
enum TaskStatus { OPEN IN_PROGRESS DONE CANCELLED }
enum TaskType { CALL SMS FOLLOW_UP VACCINE_REMINDER WIN_BACK CART OTHER }
enum TicketStatus { OPEN PENDING RESOLVED CLOSED }
enum TicketPriority { LOW NORMAL HIGH }
enum AdjustmentReason { COUNT DAMAGE RETURN WRITE_OFF OTHER }
enum StaffNotificationKind { NEW_ORDER NEW_LEAD NEW_TICKET TASK_DUE EXPIRY_DIGEST OUTBOX_FAILURES }

model Contact {
  id            String   @id @default(cuid())
  phone         String?  @unique
  email         String?  @unique
  name          String?
  stage         LifecycleStage @default(LEAD)
  stageOverride LifecycleStage?
  customerId    String?  @unique
  mergedIntoId  String?
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
  @@index([stage])
}

model CrmTask {
  id          String     @id @default(cuid())
  title       String
  type        TaskType   @default(OTHER)
  status      TaskStatus @default(OPEN)
  priority    Int        @default(2)
  dueAt       DateTime?
  ownerId     String?
  contactId   String?
  customerId  String?
  leadId      String?
  ticketId    String?
  dedupeKey   String?    @unique
  system      Boolean    @default(false)
  note        String?
  completedAt DateTime?
  createdAt   DateTime   @default(now())
  updatedAt   DateTime   @updatedAt
  @@index([ownerId, status, dueAt])
  @@index([customerId])
  @@index([leadId])
}

model CrmActivity {
  id          String   @id @default(cuid())
  type        String
  contactId   String?
  customerId  String?
  actorUserId String?
  refType     String   @default("")
  refId       String   @default("")
  summary     String
  meta        Json?
  occurredAt  DateTime @default(now())
  @@unique([type, refType, refId])
  @@index([customerId, occurredAt])
  @@index([contactId, occurredAt])
}

model TicketReply {
  id           String   @id @default(cuid())
  messageId    String
  authorUserId String?
  internal     Boolean  @default(false)
  channel      String?
  body         String
  outboxId     String?
  createdAt    DateTime @default(now())
  @@index([messageId, createdAt])
}

model SavedView {
  id      String   @id @default(cuid())
  entity  String
  name    String
  filters Json
  sort    String?
  ownerId String?
  shared  Boolean  @default(false)
  createdAt DateTime @default(now())
  @@index([entity, ownerId])
}

model HealthSnapshot {
  id         String   @id @default(cuid())
  customerId String
  score      Int
  churnRisk  String
  computedAt DateTime @default(now())
  @@index([customerId, computedAt])
}

model StaffNotification {
  id        String   @id @default(cuid())
  kind      StaffNotificationKind
  title     String
  body      String?
  href      String?
  userId    String?          // null = everyone with minRole
  minRole   String?
  readBy    String[] @default([])
  dedupeKey String?  @unique
  createdAt DateTime @default(now())
  @@index([createdAt])
}

model InventoryAdjustment {
  id         String   @id @default(cuid())
  inventoryId String
  productId  String
  delta      Int
  reason     AdjustmentReason
  note       String?
  costAtLoss Int?
  adminId    String?
  createdAt  DateTime @default(now())
  @@index([productId, createdAt])
  @@index([reason, createdAt])
}

model ExpiryConfig {
  id               String @id @default("default")
  soonDays         Int    @default(90)
  criticalDays     Int    @default(30)
  minShelfLifeDays Int    @default(7)
  discountStartDays Int   @default(60)
  discountPercent  Int    @default(20)
  digestPhones     String[] @default([])
  updatedAt        DateTime @updatedAt
}
```

New nullable/defaulted columns on existing models (plain string ids, no FK, like `ServiceVisit`):
- `Customer`: `contactId String?`, `ownerId String?`, `lifecycleStage LifecycleStage?`, `healthScore Int?`, `churnRisk String?`, `lastContactedAt DateTime?`, `mergedIntoId String?`; `@@index([contactId])`, `@@index([lifecycleStage])`, `@@index([ownerId])`.
- `Lead`: `contactId String?`, `customerId String?`, `stage LeadStage @default(NEW)`, `lostReason LostReason?`, `ownerId String?`, `normalizedPhone String?`, `stageChangedAt DateTime?`; `@@index([stage])`, `@@index([normalizedPhone])`, `@@index([ownerId])`. Legacy `status` string stays and is kept in sync by the lead actions (stage to legacy: NEW, CONTACTED, QUALIFIED, BOOKED, CONVERTED, LOST).
- `ContactMessage`: `contactId String?`, `customerId String?`, `normalizedPhone String?`, `status TicketStatus @default(OPEN)`, `assigneeId String?`, `priority TicketPriority @default(NORMAL)`, `firstResponseAt DateTime?`, `resolvedAt DateTime?`; `@@index([status])`, `@@index([assigneeId])`.
- `MarketingContact`: `contactId String?`.
- `Product`: `shelfLifeDays Int?`.
- `Inventory`: `costPrice Int?`, `supplier String?`.

Migration rules: pure `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`, `CREATE TABLE IF NOT EXISTS`, `CREATE INDEX IF NOT EXISTS`, enums created inside `DO $$ ... EXCEPTION WHEN duplicate_object THEN NULL; END $$`. Register in `scripts/release-db.mjs` `MIGRATIONS` with `applied: async () => await columnExists('Lead','stage') && await columnExists('Customer','healthScore')` (follow the pattern of existing entries; verify the `2026111*` glob/registry handles `20261120+` and fix if it does not). Add a unit test `tests/unit/migrations-registry.test.ts` asserting every directory in `prisma/migrations` starting with `2026` is registered. Backfill is a separate script, never in SQL.

## 3. Library modules (owner and signatures)

### E2 `lib/crm/*`
```ts
// lib/crm/contacts.ts
export type ContactInput = { phone?: string|null; email?: string|null; name?: string|null };
export async function resolveContact(input: ContactInput, tx?: Prisma.TransactionClient): Promise<{ id: string; created: boolean } | null>;
export async function linkCustomerToContact(customerId: string, tx?: Prisma.TransactionClient): Promise<string>; // returns contactId
export function normalizeContactPhone(raw?: string|null): string|null;

// lib/crm/activity.ts
export type ActivityInput = { type: ActivityType; summary: string; contactId?: string|null; customerId?: string|null;
  actorUserId?: string|null; refType?: string; refId?: string; meta?: Record<string,unknown>; occurredAt?: Date };
export async function recordActivity(input: ActivityInput, tx?: Prisma.TransactionClient): Promise<void>; // idempotent, never throws
export const ACTIVITY_TYPES: readonly string[]; export type ActivityType = (typeof ACTIVITY_TYPES)[number];
export const ACTIVITY_LABELS_FA: Record<ActivityType,string>;
export async function listActivity(args: { customerId?: string; contactId?: string; types?: ActivityType[]; cursor?: string; take?: number }): Promise<{ items: ActivityRow[]; nextCursor: string|null }>;

// lib/crm/lifecycle.ts
export function computeLifecycleStage(input: LifecycleInput): LifecycleStage; // pure, rules from CRM-SPEC section 2
export async function recomputeLifecycle(contactId: string): Promise<LifecycleStage>;
export async function recomputeAllLifecycles(): Promise<{ updated: number }>;

// lib/crm/promote.ts
export async function promoteLeadsForCustomer(customerId: string): Promise<number>; // marks matching leads WON

// lib/crm/daily.ts   (called from app/api/cron/club/route.ts)
export async function runCrmDaily(): Promise<{ lifecycle: number; health: number; tasks: number; digest: boolean }>;

// lib/crm/notify.ts
export async function notifyStaff(n: { kind: StaffNotificationKind; title: string; body?: string; href?: string; userId?: string; minRole?: Role; dedupeKey?: string }): Promise<void>; // never throws
export async function listStaffNotifications(userId: string, role: Role, take?: number): Promise<{ items: StaffNotificationRow[]; unread: number }>;
export async function markStaffNotificationsRead(userId: string, ids?: string[]): Promise<void>;
```
`lib/club/hooks.ts` (owner E2) calls `recordActivity`, `linkCustomerToContact`, `promoteLeadsForCustomer`, `notifyStaff` (NEW_ORDER) inside `safely()`.
Note: `notifyStaff` and notification reads live in E2 libs; E8 only builds UI. `getAdminBadgeCounts()` in `lib/crm/badges.ts` (E2): `Promise<{ orders: number; leads: number; tickets: number; tasks: number; inventory: number; carts?: number }>` single batched query, 30 s cache.

### E3 `lib/crm/leads.ts`, `lib/crm/tasks.ts`, `lib/crm/task-gen.ts`
```ts
export const LEAD_TRANSITIONS: Record<LeadStage, LeadStage[]>; // CRM-SPEC section 3
export function canTransition(from: LeadStage, to: LeadStage): boolean;
export function legacyStatusForStage(s: LeadStage): string;
export async function changeLeadStage(leadId: string, to: LeadStage, opts: { lostReason?: LostReason; actorUserId: string }): Promise<void>;
export async function listLeads(q: LeadListQuery): Promise<Paged<LeadRow>>; // q,stage,owner,source,from,to,page,size,sort
export async function listTasks(q: TaskListQuery): Promise<Paged<TaskRow>>; // scope: 'mine'|'all'|'overdue'|'today', status, type, page, size
export async function generateCrmTasks(): Promise<number>; // idempotent by dedupeKey
```
`Paged<T> = { rows: T[]; total: number; page: number; size: number }` lives in `lib/crm/types.ts` (E2).

### E4 `lib/crm/tickets.ts`
```ts
export const TICKET_TRANSITIONS: Record<TicketStatus, TicketStatus[]>;
export async function listTickets(q: { q?: string; status?: TicketStatus; assignee?: string; priority?: TicketPriority; breached?: boolean; page?: number; size?: number }): Promise<Paged<TicketRow>>;
export async function getTicket(id: string): Promise<{ ticket: TicketRow; replies: TicketReplyRow[] }>;
export async function replyToTicket(id: string, a: { body: string; internal: boolean; sendSms: boolean; actorUserId: string }): Promise<void>;
export function slaState(t: { createdAt: Date; firstResponseAt: Date|null; status: TicketStatus }, now?: Date): 'ok'|'due'|'breached';
```

### E5 `lib/club/customers-admin.ts` (existing, E5 owns)
Keep all existing exports. Extend `listCustomers` with `owner`, `lifecycle`, `churn`, `tag`, `page`, `size` (server-side) and return `Paged`. Extend `getCustomer360(id)` with `{ contact, leads, tickets, tasks, health, consent }`. Add `assignCustomerOwner(id, ownerId|null, actorUserId)`.

### E6 `lib/crm/dedupe.ts`, `merge.ts`, `import.ts`, `views.ts`
```ts
export type DuplicateCandidate = { a: CustomerBrief; b: CustomerBrief; reasons: ('PHONE'|'EMAIL'|'NAME_PET')[]; score: number };
export async function findDuplicates(opts?: { limit?: number }): Promise<DuplicateCandidate[]>;
export async function mergeCustomers(survivorId: string, loserId: string, adminId: string, opts?: { dryRun?: boolean }): Promise<MergeReport>; // transactional
export type ImportRow = { phone: string; name?: string; email?: string; city?: string; birthDate?: string; tags?: string[]; notes?: string };
export function parseImportCsv(text: string): { rows: ImportRow[]; errors: { line: number; message: string }[] };
export async function previewImport(rows: ImportRow[]): Promise<{ valid: number; duplicates: number; invalid: number; rows: PreviewRow[] }>;
export async function commitImport(rows: ImportRow[], adminId: string): Promise<{ created: number; skipped: number }>;
export async function listViews(entity: SavedViewEntity, userId: string, role: Role): Promise<SavedViewRow[]>;
export async function saveView(v: { entity: SavedViewEntity; name: string; filters: unknown; sort?: string; shared?: boolean }, userId: string): Promise<SavedViewRow>;
export async function deleteView(id: string, userId: string, role: Role): Promise<void>;
export type SavedViewEntity = 'CUSTOMER'|'LEAD'|'TICKET'|'TASK'|'ORDER'|'PRODUCT';
```
Export functions for leads, tickets, tasks: `leadsCsv(filters)`, `ticketsCsv(filters)`, `tasksCsv(filters)` in `lib/crm/export.ts` (E6), returning a string; cap 10,000.

### E7 `lib/crm/health.ts`, `lib/crm/reports.ts`
```ts
export function computeHealth(input: HealthInput): { score: number; churnRisk: 'LOW'|'MEDIUM'|'HIGH' }; // pure, CRM-SPEC section 9
export async function recomputeAllHealth(): Promise<{ updated: number }>;
export async function funnelReport(range: DateRange): Promise<FunnelRow[]>;
export async function customerReport(range: DateRange): Promise<CustomerReport>;
export async function operationsReport(range: DateRange): Promise<OperationsReport>;
export async function messagingReport(range: DateRange): Promise<MessagingRow[]>;
export async function expiryReport(): Promise<ExpiryReport>;
```
Extend `lib/club/segments.ts` (E7 owns) criteria: `lifecycle?: LifecycleStage[]`, `ownerId?`, `healthBelow?`, `churnRisk?`, and OR groups `{ any: SegmentRules[] }`.

### E9 `lib/shop/expiry*.ts`, `lib/shop/inventory-admin.ts`
```ts
export type ExpiryConfigValues = { soonDays: number; criticalDays: number; minShelfLifeDays: number; discountStartDays: number; discountPercent: number };
export async function getExpiryConfig(): Promise<ExpiryConfigValues>; // 60 s cache, defaults 90/30/7/60/20
export function expiryState(date: Date|null, cfg?: Partial<ExpiryConfigValues>, now?: Date): ExpiryState; // keeps existing signature compatible
export function daysUntil(date: Date, now?: Date): number;
export function relativeMonthsFa(date: Date, now?: Date): string; // "حدود ۱۴ ماه دیگر"
export async function listBatches(q: { state?: ExpiryState; productId?: string; q?: string; location?: string; page?: number; size?: number }): Promise<Paged<BatchRow>>;
export async function nearestExpiryByProduct(productIds: string[]): Promise<Record<string, { date: Date|null; state: ExpiryState }>>;
export async function expirySummary(): Promise<{ expired: number; critical: number; soon: number; undated: number; valueAtRisk: number }>;
```
`BatchTake` in allocations gains optional `expiryDate: string|null` (ISO), written in `lib/shop/orders.ts` (E9 owns this edit).

## 4. Server actions (file, name, minRole)
| File (owner) | Actions |
|---|---|
| `app/actions/crm-leads.ts` (E3) | `changeLeadStageAction(id,to,lostReason?)` EDITOR; `assignLeadAction(id,ownerId|null)` EDITOR; `setLeadFollowUpAction(id,iso|null)` EDITOR; `convertLeadToCustomerAction(id)` EDITOR; `deleteLeadAction(id)` ADMIN; `exportLeadsCsvAction(filters)` ADMIN |
| `app/actions/leads.ts` (E3, existing public) | `createLeadAction` extended: normalise phone, `resolveContact`, set `normalizedPhone`, `recordActivity(LEAD_CREATED)`, `notifyStaff(NEW_LEAD)` |
| `app/actions/crm-tasks.ts` (E3) | `createTaskAction`, `updateTaskAction`, `completeTaskAction(id)`, `snoozeTaskAction(id, iso)`, `deleteTaskAction(id)` (all EDITOR, delete ADMIN); `exportTasksCsvAction` ADMIN |
| `app/actions/tickets.ts` (E4) | `setTicketStatusAction`, `assignTicketAction`, `setTicketPriorityAction`, `replyTicketAction(id,{body,internal,sendSms})` (EDITOR); `deleteTicketAction` ADMIN; `exportTicketsCsvAction` ADMIN. Existing `app/actions/messages.ts` stays (mark-read, delete) and is owned by E4 |
| `app/actions/crm-customers.ts` (E5) | `assignCustomerOwnerAction`, `bulkTagCustomersAction(ids,tag,mode)`, `bulkAssignCustomersAction(ids,ownerId)` (EDITOR); `quickNoteAction`. Existing `app/actions/admin-customers*` (E5 owns whichever file holds customer admin actions) |
| `app/actions/crm-data.ts` (E6) | `findDuplicatesAction`, `mergeCustomersAction(survivorId,loserId,dryRun)` ADMIN, `previewImportAction(csvText)` ADMIN, `commitImportAction(csvText)` ADMIN, `listViewsAction(entity)`, `saveViewAction`, `deleteViewAction` (EDITOR; shared views ADMIN) |
| `app/actions/crm-reports.ts` (E7) | `getReportAction(tab, range)` VIEWER; `exportReportCsvAction(tab, range)` ADMIN |
| `app/actions/admin-search.ts` (E8) | `globalSearchAction(q)` VIEWER |
| `app/actions/admin-notifications.ts` (E8) | `markNotificationsReadAction(ids?)` VIEWER |
| `app/actions/inventory.ts` (E9, existing) | keep `addBatch`, `updateBatchQuantity`, `deleteBatch`, `setTracksExpiry`; add `addBatchesAction(lines[])` EDITOR (one transaction), `adjustBatchAction(id,delta,reason,note)` ADMIN, `writeOffBatchAction(id,note)` ADMIN, `saveExpiryConfigAction(values)` ADMIN, `createExpiryCouponAction(productId, batchId)` ADMIN, `searchProductsAction(q)` EDITOR |

## 5. Design kit (owner E1): `components/admin/kit/`
Files: `page-header.tsx`, `data-table.tsx`, `filter-bar.tsx`, `use-url-state.ts`, `stat-card.tsx`, `empty-state.tsx`, `admin-tabs.tsx`, `drawer.tsx`, `status-badge.tsx`, `expiry-badge.tsx`, `bulk-bar.tsx`, `pager.tsx`, `jalali-date-field.tsx`, `product-combobox.tsx`, `form-section.tsx`, `index.ts` (barrel). Props exactly as in ADMIN-IA section 7. Extra exports from `status-badge.tsx`: `stageBadge(stage: LeadStage)`, `ticketBadge(s: TicketStatus)`, `taskBadge(s: TaskStatus)`, `lifecycleBadge(s: LifecycleStage)`, `churnBadge(r: string)`. `ExpiryBadge` imports only the pure `ExpiryState` type and label map from `lib/shop/expiry-labels.ts` (E1 owns this small file: `EXPIRY_LABEL_FA`, `EXPIRY_TONE`). `SavedViews` control (`components/admin/crm/saved-views.tsx`, E6) is passed into `FilterBar` as `views`. `ProductCombobox` calls `searchProductsAction` (E9) passed in as prop `search` so E1 has no import dependency. `CommandPalette` and `NotificationBell` are owned by E8, not the kit.

## 6. Routes and pages
| Route | Owner | Notes |
|---|---|---|
| `/admin` (dashboard) | E8 (`app/[locale]/admin/page.tsx`, `components/admin/dashboard/*`) | |
| `/admin/leads` | E3 (`leads/page.tsx`, `components/admin/crm/leads-board.tsx`, `leads-table.tsx`, `lead-drawer.tsx`; old `leads-manager.tsx` deleted) | |
| `/admin/tasks` | E3 (`tasks/page.tsx`, `components/admin/crm/tasks-manager.tsx`, `task-dialog.tsx`) | |
| `/admin/messages` | E4 (`messages/page.tsx`, `components/admin/crm/inbox.tsx`, `ticket-drawer.tsx`; old `messages-manager.tsx` deleted) | |
| `/admin/customers`, `/admin/customers/[id]` | E5 (`customers-manager.tsx`, `customer-360.tsx`, new `components/admin/crm/timeline.tsx`, `customer-health-card.tsx`) | |
| `/admin/customers/duplicates`, `/admin/customers/import` | E6 (`components/admin/crm/duplicates-manager.tsx`, `import-wizard.tsx`, `saved-views.tsx`) | |
| `/admin/reports` | E7 (`reports/page.tsx`, `components/admin/crm/reports-*.tsx`) | tabs via `?tab=funnel|customers|operations|messaging|expiry` |
| `/admin/inventory` | E9 (`inventory/page.tsx`, `components/admin/inventory/*`; old `inventory-manager.tsx` deleted) | |
| `/admin/products` | E9 (`products/page.tsx`, `components/admin/products/*` from splitting `products-manager.tsx`, which remains as thin composer) | |
| `/admin/orders`, `/admin/audit` and all other legacy pages | E10 | |
| Shell, `layout.tsx` | E8 (`components/admin/admin-shell.tsx`, `app/[locale]/admin/layout.tsx`, `command-palette.tsx`, `notification-bell.tsx`) | |
| Product page storefront | E9 (`app/[locale]/(shop)/product/[slug]/page.tsx`, `components/shop/expiry-strip.tsx`) | |
| Cron | `app/api/cron/club/route.ts` calls `runCrmDaily()` (E2); `app/api/cron/expiry/route.ts` (E9). No new cron entries (Vercel Hobby limit) | |

## 7. File ownership
| Epic | Owns (exclusive edit rights) |
|---|---|
| E0 | `prisma/schema.prisma`, `prisma/migrations/20261123_crm_v2/**`, `scripts/release-db.mjs`, `scripts/backfill-crm.ts`, `tests/unit/migrations-registry.test.ts`, `walkthrough.md`/`scaffold/seed-data.md` deletion |
| E1 | `components/admin/kit/**`, `lib/shop/expiry-labels.ts`, `__tests__/components/admin-kit/**` |
| E2 | `lib/crm/{contacts,activity,lifecycle,promote,daily,notify,badges,types}.ts`, `lib/club/hooks.ts`, `app/api/cron/club/route.ts`, `app/actions/customer-auth.ts` (only to call `linkCustomerToContact`/`promoteLeadsForCustomer`), `lib/marketing/contacts.ts` (call `resolveContact`) |
| E3 | `lib/crm/{leads,tasks,task-gen}.ts`, `app/actions/{leads,crm-leads,crm-tasks}.ts`, `app/[locale]/admin/{leads,tasks}/**`, `components/admin/crm/{leads-*,lead-drawer,tasks-manager,task-dialog}.tsx` |
| E4 | `lib/crm/tickets.ts`, `app/actions/{messages,tickets}.ts`, `app/[locale]/admin/messages/**`, `components/admin/crm/{inbox,ticket-drawer}.tsx`, contact form public action for contact messages (resolve contact, normalise phone) |
| E5 | `lib/club/customers-admin.ts`, customer admin actions, `app/[locale]/admin/customers/page.tsx`, `customers/[id]/**`, `components/admin/{customers-manager,customer-360}.tsx`, `components/admin/crm/{timeline,customer-health-card}.tsx`, `app/actions/crm-customers.ts` |
| E6 | `lib/crm/{dedupe,merge,import,views,export}.ts`, `app/actions/crm-data.ts`, `app/[locale]/admin/customers/{duplicates,import}/**`, `components/admin/crm/{duplicates-manager,import-wizard,saved-views}.tsx` |
| E7 | `lib/crm/{health,reports}.ts`, `lib/club/segments.ts`, `lib/club/reports.ts`, `app/actions/crm-reports.ts`, `app/[locale]/admin/reports/**`, `components/admin/crm/reports-*.tsx` |
| E8 | `components/admin/admin-shell.tsx`, `app/[locale]/admin/layout.tsx`, `app/[locale]/admin/page.tsx`, `components/admin/dashboard/**`, `components/admin/{command-palette,notification-bell}.tsx`, `lib/admin/search.ts`, `app/actions/{admin-search,admin-notifications}.ts` |
| E9 | `lib/shop/{expiry,expiry-config,inventory-admin,orders,stock-sync,catalog}.ts`, `app/actions/{inventory,products}.ts`, `app/api/cron/expiry/route.ts`, `app/[locale]/admin/{inventory,products}/**`, `components/admin/inventory/**`, `components/admin/products/**`, `components/admin/products-manager.tsx`, `components/shop/expiry-strip.tsx`, product storefront page, product card, order detail account page (expiry per line), `lib/marketing/pricing.ts` (read only in R1; coupon prefill only calls existing coupon creation) |
| E10 | every other file under `components/admin/*-manager.tsx` (orders, audit, posts, services, divisions, staff, faqs, testimonials, menus, homepage, media, social, users, messages excluded), `app/[locale]/admin/{orders,audit,posts,services,divisions,staff,faqs,testimonials,menus,homepage,media,social,users,settings,theme,carts,club,segments,campaigns,automations,outbox,marketing}/**` for `loading.tsx`/`error.tsx`, `tests/e2e/crm-*.spec.ts`, `tests/e2e/admin-ia.spec.ts` |
| E11 | all `*.md` outside `docs/product/`, `docs/decisions/**` |

Conflict rules: if a story needs an edit in a file owned by another epic, use the extension points above (props, imported function) and note it in your report. Shared files with a single owner: `prisma/schema.prisma` (E0), `components/admin/admin-shell.tsx` (E8), `scripts/release-db.mjs` (E0), `lib/club/hooks.ts` (E2), `app/api/cron/club/route.ts` (E2). `package.json` changes: only E1 (none expected), anyone else reports needs.

## 8. data-testids (e2e contract)
Shell: `admin-sidebar`, `nav-<slug>` (slug = last path segment, e.g. `nav-leads`, `nav-tasks`), `nav-badge-<slug>`, `cmdk-trigger`, `cmdk-input`, `cmdk-result`, `notif-bell`, `notif-item`, `quick-create`.
Kit: `data-table`, `data-row`, `filter-search`, `filter-reset`, `pager`, `pager-next`, `bulk-bar`, `empty-state`, `stat-card-<key>`.
Leads: `lead-board`, `lead-card-<id>`, `lead-column-<STAGE>`, `lead-row-<id>`, `lead-stage-select`, `lead-owner-select`, `lead-lost-reason`, `lead-convert`, `lead-followup`.
Tasks: `task-list`, `task-row-<id>`, `task-new`, `task-title`, `task-due`, `task-save`, `task-complete-<id>`, `task-snooze-<id>`, `task-scope-<mine|all|overdue|today>`.
Inbox: `ticket-row-<id>`, `ticket-drawer`, `ticket-status-select`, `ticket-assignee-select`, `ticket-reply-body`, `ticket-reply-internal`, `ticket-reply-sms`, `ticket-reply-send`, `ticket-sla-<ok|due|breached>`.
Customers: `customer-row-<id>`, `customer-filter-lifecycle`, `customer-filter-owner`, `customer-bulk-tag`, `customer-owner-select`, `customer-tab-timeline`, `timeline-item`, `timeline-filter-<type>`, `health-score`, `churn-badge`, `lifecycle-badge`.
Data tools: `duplicates-row`, `merge-open`, `merge-confirm`, `merge-dry-run`, `import-file`, `import-preview`, `import-commit`, `import-error-row`, `saved-views-trigger`, `saved-view-save`, `saved-view-item-<id>`.
Reports: `report-tab-<funnel|customers|operations|messaging|expiry>`, `report-range`, `report-export`.
Expiry: `inventory-board`, `expiry-stat-<expired|critical|soon|undated>`, `expiry-group-<state>`, `batch-row-<id>`, `batch-drawer`, `batch-line-<n>`, `batch-add-line`, `batch-save`, `batch-adjust-<id>`, `batch-writeoff-<id>`, `product-expiry` (storefront, exactly one per page), `product-expiry-badge`, `product-expiry-section` (admin editor), `product-expiry-filter`, `expiry-badge`.
Existing testids and labels are preserved wherever a component is converted.

## 9. Definition of done (per epic)
1. `npx tsc --noEmit` and `npm run lint` clean for owned files.
2. Unit tests for every pure function and action permission check; integration tests (real local DB, `tests/helpers/local-db.ts`) for merge, import commit, lead promotion, ticket reply, batch write-off.
3. `npm run test:all` green, or failures reported with cause.
4. No new `window.confirm`, no `isEn`, no unbounded query, no hard-coded English UI string, logical CSS only, 360px verified.
5. Persian copy reviewed for human tone (no machine-translation phrasing).
6. Final report lists files touched (all inside owned set), tests added, and any contract gaps.
