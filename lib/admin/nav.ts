import type { Role } from '@prisma/client'

/** Admin navigation, shared by the sidebar and the command palette. Pure data, safe for client bundles. */

export type BadgeKey = 'orders' | 'leads' | 'tickets' | 'tasks' | 'inventory'

export interface NavItem {
  href: string
  label: string
  /** 24x24 stroke path data. Every item has its own icon. */
  icon: string
  minRole: Role
  badge?: BadgeKey
  /** Other route prefixes that keep this item highlighted (merged sub-pages). */
  alsoMatch?: string[]
  /** Extra search words for the command palette. */
  keywords?: string
}
export interface NavGroup {
  label?: string
  items: NavItem[]
}

export const RANK: Record<Role, number> = { SUPER_ADMIN: 5, ADMIN: 4, EDITOR: 3, AUTHOR: 2, VIEWER: 1 }
export const ROLE_FA: Record<Role, string> = {
  SUPER_ADMIN: 'مدیر ارشد',
  ADMIN: 'مدیر',
  EDITOR: 'کارشناس',
  AUTHOR: 'نویسنده',
  VIEWER: 'مشاهده‌گر',
}

export const ICON = {
  dashboard: 'M3 13h8V3H3v10zm10 8h8V11h-8v10zM3 21h8v-6H3v6zM13 3v6h8V3h-8z',
  orders: 'M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2M9 5a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2M9 5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2m-6 7h6m-6 4h4',
  products: 'm21 8-9-5-9 5m18 0-9 5m9-5v8l-9 5m0-8L3 8m9 5v8M3 8v8l9 5',
  inventory: 'M12 7v5l3 2m6-2a9 9 0 1 1-18 0 9 9 0 0 1 18 0z',
  coupon: 'M20.6 13.4 13.4 20.6a2 2 0 0 1-2.8 0L2 12V2h10l8.6 8.6a2 2 0 0 1 0 2.8zM7 7h.01',
  customers: 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2m20 0v-2a4 4 0 0 0-3-3.87M15 3.13a4 4 0 0 1 0 7.75M13 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0z',
  leads: 'M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2z',
  tasks: 'M9 11l3 3 8-8M20 12v7a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h9',
  messages: 'M4 5h16a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1zm-1 2 9 6 9-6',
  carts: 'M3 4h2l2.4 11h10.2L20 7H6.2M9 20a1 1 0 1 0 0-.01M17 20a1 1 0 1 0 0-.01',
  club: 'M12 3l2.7 5.6 6.3.9-4.5 4.3 1 6.2L12 17l-5.5 3 1-6.2L3 9.5l6.3-.9L12 3z',
  segments: 'M21.2 15.9A10 10 0 1 1 8 2.8M22 12A10 10 0 0 0 12 2v10z',
  campaigns: 'M3 11v2a1 1 0 0 0 1 1h2l5 4V6L6 10H4a1 1 0 0 0-1 1zm13.5-2.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12',
  automations: 'M13 2 3 14h9l-1 8 10-12h-9l1-8z',
  outbox: 'm22 2-7 20-4-9-9-4zM22 2 11 13',
  reports: 'M3 3v18h18M7 15v3m4-8v8m4-5v5m4-9v9',
  posts: 'M4 5a1 1 0 0 1 1-1h11l4 4v11a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5zm4 5h8m-8 4h8m-8 4h5',
  homepage: 'm3 11 9-8 9 8v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1v-9z',
  services: 'M12 5v14m-7-7h14M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z',
  faqs: 'M9.1 9a3 3 0 0 1 5.8 1c0 2-3 3-3 3m.1 4h.01M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z',
  media: 'M4 5h16a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1zm-1 12 5-5 4 4 3-3 6 6M15.5 9.5h.01',
  settings: 'M4 21v-7m0-4V3m8 18v-9m0-4V3m8 18v-5m0-4V3M1 14h6m2-6h6m2 8h6',
  theme: 'M12 22a10 10 0 1 1 10-10c0 2.2-1.8 3-4 3h-2a2 2 0 0 0-1.5 3.3c.3.4.5.8.5 1.2 0 1.4-1.3 2.5-3 2.5zM7.5 11h.01M10.5 7h.01M15 7.5h.01',
  users: 'M12 2 4 5v6c0 5 3.4 9.3 8 11 4.6-1.7 8-6 8-11V5l-8-3zm-3 10 2 2 4-4',
  audit: 'M3 12a9 9 0 1 0 3-6.7L3 8m0-5v5h5m4-1v5l3 2',
  menu: 'M4 6h16M4 12h16M4 18h10',
  search: 'm21 21-4.3-4.3M17 10a7 7 0 1 1-14 0 7 7 0 0 1 14 0z',
  bell: 'M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 0 1-3.4 0',
  plus: 'M12 5v14M5 12h14',
} as const

export const NAV_GROUPS: NavGroup[] = [
  { items: [{ href: '/admin', label: 'داشبورد', icon: ICON.dashboard, minRole: 'VIEWER', keywords: 'پیشخوان خانه' }] },
  {
    label: 'فروش',
    items: [
      { href: '/admin/orders', label: 'سفارش‌ها', icon: ICON.orders, minRole: 'VIEWER', badge: 'orders', keywords: 'خرید فاکتور' },
      { href: '/admin/products', label: 'محصولات', icon: ICON.products, minRole: 'EDITOR', alsoMatch: ['/admin/categories'], keywords: 'کالا دسته‌بندی' },
      { href: '/admin/inventory', label: 'موجودی و انقضا', icon: ICON.inventory, minRole: 'EDITOR', badge: 'inventory', keywords: 'انبار محموله بچ تاریخ انقضا' },
      { href: '/admin/marketing', label: 'بازاریابی و تخفیف', icon: ICON.coupon, minRole: 'ADMIN', keywords: 'کد تخفیف بازاریابی' },
    ],
  },
  {
    label: 'مشتریان',
    items: [
      { href: '/admin/customers', label: 'مشتریان', icon: ICON.customers, minRole: 'VIEWER', keywords: 'مشتری پت حیوان' },
      { href: '/admin/leads', label: 'سرنخ‌ها', icon: ICON.leads, minRole: 'VIEWER', badge: 'leads', keywords: 'درخواست مشاوره' },
      { href: '/admin/tasks', label: 'وظایف من', icon: ICON.tasks, minRole: 'VIEWER', badge: 'tasks', keywords: 'کار پیگیری' },
      { href: '/admin/messages', label: 'پیام‌ها و پشتیبانی', icon: ICON.messages, minRole: 'EDITOR', badge: 'tickets', keywords: 'تیکت تماس' },
      { href: '/admin/carts', label: 'سبدهای رهاشده', icon: ICON.carts, minRole: 'VIEWER' },
      { href: '/admin/club', label: 'باشگاه مشتریان', icon: ICON.club, minRole: 'EDITOR', keywords: 'امتیاز سطح' },
    ],
  },
  {
    label: 'ارتباطات',
    items: [
      { href: '/admin/segments', label: 'بخش‌بندی‌ها', icon: ICON.segments, minRole: 'EDITOR', keywords: 'گروه مشتریان' },
      { href: '/admin/campaigns', label: 'کمپین‌ها', icon: ICON.campaigns, minRole: 'EDITOR', keywords: 'پیامک' },
      { href: '/admin/automations', label: 'پیام‌های خودکار', icon: ICON.automations, minRole: 'ADMIN' },
      { href: '/admin/outbox', label: 'صف پیامک', icon: ICON.outbox, minRole: 'EDITOR' },
      { href: '/admin/reports', label: 'گزارش‌ها', icon: ICON.reports, minRole: 'VIEWER', keywords: 'آمار تحلیل' },
    ],
  },
  {
    label: 'محتوا و سایت',
    items: [
      { href: '/admin/posts', label: 'مقالات', icon: ICON.posts, minRole: 'AUTHOR', keywords: 'وبلاگ' },
      { href: '/admin/homepage', label: 'صفحه اصلی و منوها', icon: ICON.homepage, minRole: 'EDITOR', alsoMatch: ['/admin/menus', '/admin/social'], keywords: 'منو شبکه اجتماعی' },
      { href: '/admin/services', label: 'خدمات و کادر درمان', icon: ICON.services, minRole: 'EDITOR', alsoMatch: ['/admin/divisions', '/admin/staff'], keywords: 'دامپزشک بخش' },
      { href: '/admin/faqs', label: 'پرسش‌ها و نظرات', icon: ICON.faqs, minRole: 'EDITOR', alsoMatch: ['/admin/testimonials'] },
      { href: '/admin/media', label: 'رسانه', icon: ICON.media, minRole: 'AUTHOR', keywords: 'تصویر' },
    ],
  },
  {
    label: 'تنظیمات',
    items: [
      { href: '/admin/settings', label: 'تنظیمات سایت', icon: ICON.settings, minRole: 'ADMIN' },
      { href: '/admin/theme', label: 'قالب', icon: ICON.theme, minRole: 'ADMIN', keywords: 'رنگ ظاهر' },
      { href: '/admin/users', label: 'کاربران', icon: ICON.users, minRole: 'SUPER_ADMIN', keywords: 'نقش دسترسی' },
      { href: '/admin/audit', label: 'گزارش فعالیت', icon: ICON.audit, minRole: 'ADMIN', keywords: 'لاگ' },
    ],
  },
]

export interface QuickCreate {
  id: string
  label: string
  href: string
  minRole: Role
}
/** The module pages open their create form when they see ?new=1. */
export const QUICK_CREATE: QuickCreate[] = [
  { id: 'customer', label: 'مشتری', href: '/admin/customers?new=1', minRole: 'EDITOR' },
  { id: 'lead', label: 'سرنخ', href: '/admin/leads?new=1', minRole: 'EDITOR' },
  { id: 'task', label: 'وظیفه', href: '/admin/tasks?new=1', minRole: 'EDITOR' },
  { id: 'order', label: 'سفارش دستی', href: '/admin/orders?new=1', minRole: 'EDITOR' },
  { id: 'batch', label: 'محموله', href: '/admin/inventory?new=1', minRole: 'EDITOR' },
]

export function canSee(role: Role, min: Role): boolean {
  return RANK[role] >= RANK[min]
}

export function navFor(role: Role): NavGroup[] {
  return NAV_GROUPS.map((g) => ({ ...g, items: g.items.filter((i) => canSee(role, i.minRole)) })).filter((g) => g.items.length > 0)
}

export function navSlug(href: string): string {
  const last = href.split('?')[0].split('/').filter(Boolean).pop()
  return !last || last === 'admin' ? 'dashboard' : last
}

export function isNavActive(item: NavItem, pathname: string): boolean {
  const match = (p: string) => (p === '/admin' ? pathname === '/admin' : pathname === p || pathname.startsWith(`${p}/`))
  return match(item.href) || (item.alsoMatch ?? []).some(match)
}

/** Breadcrumb label for a path: the nav item that owns it. */
export function navTitleFor(pathname: string): string | null {
  for (const g of NAV_GROUPS) for (const i of g.items) if (isNavActive(i, pathname)) return i.label
  return null
}
