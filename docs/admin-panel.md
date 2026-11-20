# Admin and CRM Panel

Full IA is in [product/ADMIN-IA.md](./product/ADMIN-IA.md). Summary of the built panel at `/admin` (25 items, 6 groups, `lib/admin/nav.ts`).

| Group | Modules |
|---|---|
| Home | Dashboard (role-based work queue, widgets per role) |
| Shop | Orders, Products, Inventory and expiry, Customers, Marketing (coupons, groups) |
| CRM | Leads (board and list), Tasks, Messages (support inbox), Club, Segments, Campaigns, Automations, Outbox, Carts, Reports |
| Content | Posts, Homepage, Menus, Services, Divisions, Staff, FAQs, Testimonials, Media, Social |
| System | Settings, Theme studio, Users, Audit log |

## Shell
Header with command palette (Ctrl or Cmd + K, searches customers, orders, products, leads, pets, coupons), quick-create, notification bell, nav badges. Mobile uses a drawer.

## Roles
Roles: SUPER_ADMIN > ADMIN > EDITOR > AUTHOR > VIEWER. Typical gates: editors work leads, tasks, tickets, products, inventory; admins also delete, export, merge, import, bulk price change, view audit, club, marketing, theme and expiry settings; super admins manage users. Owners see all dashboard widgets. RECEPTION and VET roles are R2.

## Conventions
Lists use the kit (`DataTable`, `FilterBar`, `Pager`, `useUrlState`) with server-side filtering (ADR-016); destructive actions use `confirmDialog`; every mutation is audited.

## Key CRM behaviours
- Lead stages with legal transitions; LOST needs a reason; WON is reopenable by admins only.
- Customer 360: health card, lifecycle (9 stages), churn risk, owner, notes, unified timeline.
- Duplicates and merge (admin), CSV import with preview (admin), saved views (shared by admin).
- Expiry: inventory board with states, batch drawer, adjust with reason, write-off, near-expiry coupon, configurable thresholds and daily digest.

## Known gaps
Orders list is not on the kit yet; several content managers (homepage, posts, services, staff, faqs, menus, media, social, settings, users) still use old layouts and some English strings; product editor lacks the expiry block. See roadmap.
