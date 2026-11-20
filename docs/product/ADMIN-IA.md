# Admin Information Architecture

All existing routes stay valid. Only grouping, labels, icons and the shell change. `minRole` filtering via the existing `RANK` logic stays.

## 1. Sidebar (22 items, 6 groups)
| Group | Item (Persian) | Route | minRole |
|---|---|---|---|
| (root) | داشبورد | /admin | VIEWER |
| فروش | سفارش‌ها | /admin/orders | VIEWER |
| | محصولات | /admin/products | EDITOR |
| | موجودی و انقضا | /admin/inventory | EDITOR |
| | کوپن و تخفیف | /admin/marketing | ADMIN |
| مشتریان | مشتریان | /admin/customers | VIEWER |
| | سرنخ‌ها | /admin/leads | VIEWER |
| | وظایف من | /admin/tasks | VIEWER |
| | پیام‌ها و پشتیبانی | /admin/messages | EDITOR |
| | سبدهای رهاشده | /admin/carts | VIEWER |
| | باشگاه مشتریان | /admin/club | ADMIN |
| ارتباطات | بخش‌بندی‌ها | /admin/segments | EDITOR |
| | کمپین‌ها | /admin/campaigns | EDITOR |
| | پیام‌های خودکار | /admin/automations | ADMIN |
| | صف پیامک | /admin/outbox | EDITOR |
| | گزارش‌ها | /admin/reports | VIEWER |
| محتوا و سایت | مقالات | /admin/posts | AUTHOR |
| | صفحه اصلی و منوها | /admin/homepage | EDITOR |
| | خدمات و کادر درمان | /admin/services | EDITOR |
| | پرسش‌ها و نظرات | /admin/faqs | EDITOR |
| | رسانه | /admin/media | AUTHOR |
| تنظیمات | تنظیمات سایت | /admin/settings | ADMIN |
| | قالب | /admin/theme | ADMIN |
| | کاربران | /admin/users | ADMIN |
| | گزارش فعالیت | /admin/audit | ADMIN |

Notes: existing sub-routes (menus, social, divisions, staff, testimonials, categories) remain reachable as tabs or secondary links inside their merged parents (`NavItem.alsoMatch` prefixes keep active state). Theme gets `minRole: ADMIN` and its save action must enforce it. Icons must be unique per item. Badges: orders (open), leads (NEW), messages (OPEN tickets), tasks (overdue + due today), inventory (expired + critical). Badge counts are computed once in the layout with a single grouped query, cached 30 s.

## 2. Header
Left to right in RTL: breadcrumb (PageHeader), global search trigger (Ctrl+K), quick-create menu (+ مشتری، سرنخ، وظیفه، سفارش دستی، محموله), notification bell, user menu.

## 3. Global search and command palette
- Component `CommandPalette`; opens on Ctrl/Cmd+K and header button.
- Server action `globalSearchAction(q)`: min 2 chars, rate limited, role-aware, returns max 5 per group: مشتری (name, phone, email), سفارش (number, phone), محصول (name, sku), سرنخ (name, phone), پت (name, microchip). Phone queries normalised. Also static commands (navigate to any sidebar item, create actions).
- Keyboard: arrows, Enter, Esc; groups announced with `role=listbox`.

## 4. Dashboard widgets per role
| Widget | Owner/ADMIN | RECEPTION/EDITOR | Shop operator | VIEWER |
|---|---|---|---|---|
| وظایف امروز (tasks due/overdue) | yes | yes | yes | no |
| سرنخ‌های جدید (NEW, with age) | yes | yes | no | yes |
| پیام‌های باز | yes | yes | no | yes |
| سفارش‌های نیازمند اقدام (PAID not shipped, pending payment, needs refund) | yes | no | yes | yes |
| انقضا (expired, under 30 d, value at risk) | yes | no | yes | yes |
| کمبود موجودی | yes | no | yes | yes |
| سبدهای رهاشده ارزشمند | yes | yes | no | no |
| خطاهای صف پیامک | yes | no | no | no |
| فروش امروز و ۷ روز اخیر | yes | no | no | yes |
| مشتریان پرخطر (churn HIGH) | yes | yes | no | no |
Each tile shows a count, a one-line status and links to the pre-filtered list. Widgets are server components in `components/admin/dashboard/*`; role visibility via a `WIDGETS` map.

## 5. List page standard
Every list page = `PageHeader` + `FilterBar` + `DataTable` + `Pagination`.
- URL state: `q`, filters, `sort`, `dir`, `page`, `size` (25, 50, 100). Shareable.
- Server-side filtering and pagination; response includes total; header shows "نمایش ۱ تا ۲۵ از ۳٬۴۲۰".
- States: skeleton (loading.tsx per route), `EmptyState` (with action), error boundary (error.tsx) with retry.
- Bulk bar appears when rows selected: count, actions (tag, assign, change stage, mark read, export), clear.
- Saved views dropdown in the FilterBar for entities that support it.
- Below `md`, rows render as cards (`DataTable` `mobileCard` render prop).
- Destructive actions always `confirmDialog`; never `window.confirm`.
- Badges always carry text, not colour alone.

## 6. Notification centre
`NotificationBell` reads `StaffNotification` (user-targeted or role-targeted): NEW_ORDER, NEW_LEAD, NEW_TICKET, TASK_DUE, EXPIRY_DIGEST, OUTBOX_FAILURES. Unread count, mark read, mark all read, deep link. Created by hooks (`notifyStaff()`), 30-day retention, polled on navigation (no websockets).

## 7. Shared design kit (`components/admin/kit/*`, re-exported from `index.ts`)
| Component | Key props |
|---|---|
| `PageHeader` | `title`, `subtitle?`, `breadcrumbs?: {label,href?}[]`, `actions?: ReactNode`, `tabs?` |
| `DataTable<T>` | `columns: {key,header,cell(row),sortable?,align?,className?}[]`, `rows`, `rowKey`, `selectable?`, `selected`, `onSelectedChange`, `sort`, `onSortChange`, `mobileCard?(row)`, `empty?`, `loading?` |
| `FilterBar` | `search: {value,placeholder}`, `filters: FilterDef[]`, `views?: SavedViewControls`, `onChange(patch)`, `onReset`, URL-synced via `useUrlState` |
| `useUrlState` (hook) | `(defaults) => [state, patch]` using `useSearchParams` and `router.replace` |
| `StatCard` | `label`, `value`, `hint?`, `tone?: 'neutral'|'gold'|'ok'|'warn'|'danger'`, `href?`, `active?`, `icon?` |
| `EmptyState` | wraps `components/ui/empty-state` with `title`, `description?`, `action?` |
| `AdminTabs` | wraps `ui/tabs`; `items: {id,label,count?,href?}[]`, URL-synced option |
| `Drawer` | wraps `ui/sheet`; `open`, `onOpenChange`, `title`, `description?`, `footer?`, `side='start'` |
| `ConfirmDialog` | use `confirmDialog({title,description,confirmLabel,tone})` from `components/ui/confirm-dialog` (already exists; kit re-exports) |
| `StatusBadge` | `tone`, `children`, `dot?` always text; presets: `stageBadge`, `ticketBadge`, `taskBadge` |
| `ExpiryBadge` | `state: ExpiryState`, `daysLeft?: number|null`, `date?: Date|null`, `size?`, `showDate?` |
| `BulkBar` | `count`, `actions: {label,onClick,tone?}[]`, `onClear` |
| `Pager` | wraps `ui/pagination`; `page`, `pageSize`, `total`, `onPage`, `onSize` |
| `JalaliDateField` | `value: string(ISO)|null`, `onChange(iso|null)`, `min?`, `presets?: {label,months}[]` |
| `ProductCombobox` | `value`, `onChange(product)`, async search action, shows name, sku, barcode, recents |
| `CommandPalette` | no props; mounted once in the shell |
| `NotificationBell` | `initial: {unread, items}` |
| `FormSection` | `title`, `description?`, `children` for editor blocks |

## 8. Mobile behaviour
Drawer nav (existing `onNavigate`), sticky filter bar, tables become cards below `md`, action buttons min 44px, no horizontal page scroll at 360px (covered by e2e overflow test), Drawer used for create/edit forms on small screens.

## 9. Breadcrumbs
`PageHeader.breadcrumbs` always begins with "پیشخوان"; detail pages show list then record name (e.g. مشتریان / سارا احمدی).
