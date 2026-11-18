'use client'

import { useEffect, useState } from 'react'
import type { Role } from '@prisma/client'
import { Link, usePathname } from '@/i18n/routing'
import { PetBossLogo } from '@/components/shared/pet-boss-logo'
import { Sheet } from '@/components/ui/sheet'
import { logoutAction } from '@/app/actions/auth'

const RANK: Record<Role, number> = { SUPER_ADMIN: 5, ADMIN: 4, EDITOR: 3, AUTHOR: 2, VIEWER: 1 }

const ROLE_FA: Record<Role, string> = {
  SUPER_ADMIN: 'مدیر ارشد',
  ADMIN: 'مدیر',
  EDITOR: 'کارشناس',
  AUTHOR: 'نویسنده',
  VIEWER: 'مشاهده‌گر',
}

type BadgeKey = 'openOrders' | 'unreadMessages' | 'newLeads'

interface NavItem {
  href: string
  label: string
  /** SVG path data (24x24, stroke) */
  icon: string
  minRole?: Role
  badge?: BadgeKey
}

const ICON = {
  dashboard: 'M3 13h8V3H3v10zm10 8h8V11h-8v10zM3 21h8v-6H3v6zM13 3v6h8V3h-8z',
  orders: 'M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2M9 5a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2M9 5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2m-6 7h6m-6 4h4',
  products: 'm21 8-9-5-9 5m18 0-9 5m9-5v8l-9 5m0-8L3 8m9 5v8M3 8v8l9 5',
  inventory: 'M12 7v5l3 2m6-2a9 9 0 1 1-18 0 9 9 0 0 1 18 0z',
  customers: 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2m20 0v-2a4 4 0 0 0-3-3.87M15 3.13a4 4 0 0 1 0 7.75M13 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0z',
  marketing: 'M3 11v2a1 1 0 0 0 1 1h2l5 4V6L6 10H4a1 1 0 0 0-1 1zm13.5-2.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12',
  posts: 'M4 5a1 1 0 0 1 1-1h11l4 4v11a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5zm4 5h8m-8 4h8m-8 4h5',
  home: 'm3 11 9-8 9 8v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1v-9z',
  menus: 'M4 6h16M4 12h16M4 18h10',
  services: 'M12 5v14m-7-7h14M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z',
  divisions: 'M4 21V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v16m0-10h2a2 2 0 0 1 2 2v8M2 21h20M8 7h4m-4 4h4m-4 4h4',
  staff: 'M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M16 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0z',
  faqs: 'M9.1 9a3 3 0 0 1 5.8 1c0 2-3 3-3 3m.1 4h.01M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z',
  testimonials: 'm12 3 2.7 5.6 6.3.9-4.5 4.3 1 6.2-5.5-3-5.5 3 1-6.2L3 9.5l6.3-.9L12 3z',
  media: 'M4 5h16a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1zm-1 12 5-5 4 4 3-3 6 6M15.5 9.5h.01',
  social: 'M8.6 13.5 15.4 17.5m0-11-6.8 4M21 5a3 3 0 1 1-6 0 3 3 0 0 1 6 0zM9 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0zm12 7a3 3 0 1 1-6 0 3 3 0 0 1 6 0z',
  leads: 'M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2z',
  messages: 'M4 5h16a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1zm-1 2 9 6 9-6',
  settings: 'M4 21v-7m0-4V3m8 18v-9m0-4V3m8 18v-5m0-4V3M1 14h6m2-6h6m2 8h6',
  theme: 'M12 22a10 10 0 1 1 10-10c0 2.2-1.8 3-4 3h-2a2 2 0 0 0-1.5 3.3c.3.4.5.8.5 1.2 0 1.4-1.3 2.5-3 2.5zM7.5 11h.01M10.5 7h.01M15 7.5h.01',
  users: 'M12 2 4 5v6c0 5 3.4 9.3 8 11 4.6-1.7 8-6 8-11V5l-8-3zm-3 10 2 2 4-4',
  audit: 'M3 12a9 9 0 1 0 3-6.7L3 8m0-5v5h5m4-1v5l3 2',
} as const

const SECTIONS: { label?: string; items: NavItem[] }[] = [
  { items: [{ href: '/admin', label: 'داشبورد', icon: ICON.dashboard }] },
  {
    label: 'فروشگاه',
    items: [
      { href: '/admin/orders', label: 'سفارش‌ها', icon: ICON.orders, badge: 'openOrders' },
      { href: '/admin/products', label: 'محصولات', icon: ICON.products },
      { href: '/admin/inventory', label: 'موجودی و انقضا', icon: ICON.inventory },
      { href: '/admin/customers', label: 'مشتریان', icon: ICON.customers },
      { href: '/admin/marketing', label: 'بازاریابی', icon: ICON.marketing, minRole: 'EDITOR' },
    ],
  },
  {
    label: 'محتوا',
    items: [
      { href: '/admin/posts', label: 'مقالات', icon: ICON.posts },
      { href: '/admin/homepage', label: 'صفحه اصلی', icon: ICON.home, minRole: 'EDITOR' },
      { href: '/admin/menus', label: 'منوها', icon: ICON.menus, minRole: 'EDITOR' },
      { href: '/admin/services', label: 'خدمات', icon: ICON.services },
      { href: '/admin/divisions', label: 'بخش‌ها', icon: ICON.divisions },
      { href: '/admin/staff', label: 'کادر درمانی', icon: ICON.staff },
      { href: '/admin/faqs', label: 'پرسش‌های متداول', icon: ICON.faqs },
      { href: '/admin/testimonials', label: 'نظرات مشتریان', icon: ICON.testimonials, minRole: 'EDITOR' },
      { href: '/admin/media', label: 'رسانه و تصاویر', icon: ICON.media },
      { href: '/admin/social', label: 'شبکه‌های اجتماعی', icon: ICON.social, minRole: 'EDITOR' },
    ],
  },
  {
    label: 'ارتباط با مشتری',
    items: [
      { href: '/admin/leads', label: 'درخواست‌ها (سرنخ)', icon: ICON.leads, badge: 'newLeads' },
      { href: '/admin/messages', label: 'پیام‌های تماس', icon: ICON.messages, badge: 'unreadMessages' },
    ],
  },
  {
    label: 'پیکربندی',
    items: [
      { href: '/admin/settings', label: 'تنظیمات سایت', icon: ICON.settings, minRole: 'ADMIN' },
      { href: '/admin/theme', label: 'قالب', icon: ICON.theme },
      { href: '/admin/users', label: 'کاربران و نقش‌ها', icon: ICON.users, minRole: 'SUPER_ADMIN' },
      { href: '/admin/audit', label: 'گزارش فعالیت', icon: ICON.audit },
    ],
  },
]

function Icon({ d, className = 'h-[18px] w-[18px]' }: { d: string; className?: string }) {
  return (
    <svg className={`shrink-0 ${className}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d={d} />
    </svg>
  )
}

export interface AdminShellProps {
  role: Role
  userName: string
  badges: Record<BadgeKey, number>
  children: React.ReactNode
}

function AdminNav({ role, badges, pathname, onNavigate }: { role: Role; badges: AdminShellProps['badges']; pathname: string; onNavigate?: () => void }) {
  return (
    <nav aria-label="منوی مدیریت" className="space-y-5">
      {SECTIONS.map((section, idx) => {
        const items = section.items.filter((i) => RANK[role] >= RANK[i.minRole ?? 'VIEWER'])
        if (items.length === 0) return null
        return (
          <div key={idx}>
            {section.label && <p className="mb-1.5 px-3 text-[11px] font-bold text-muted-foreground">{section.label}</p>}
            <ul className="space-y-0.5">
              {items.map((item) => {
                const active = pathname === item.href || (item.href !== '/admin' && pathname.startsWith(item.href))
                const count = item.badge ? badges[item.badge] : 0
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      onClick={onNavigate}
                      aria-current={active ? 'page' : undefined}
                      className={`flex min-h-10 items-center gap-3 rounded-xl px-3 py-2 text-[13px] font-semibold transition-colors ${
                        active ? 'bg-primary text-charcoal-950 font-bold shadow-gold' : 'text-foreground/80 hover:bg-surface-elevated hover:text-primary'
                      }`}
                    >
                      <Icon d={item.icon} />
                      <span className="min-w-0 flex-1 truncate">{item.label}</span>
                      {count > 0 && (
                        <span
                          className={`inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[11px] font-bold leading-none ${
                            active ? 'bg-charcoal-950 text-primary' : 'bg-primary text-charcoal-950'
                          }`}
                        >
                          {count.toLocaleString('fa-IR')}
                        </span>
                      )}
                    </Link>
                  </li>
                )
              })}
            </ul>
          </div>
        )
      })}
    </nav>
  )
}

export function AdminShell({ role, userName, badges, children }: AdminShellProps) {
  const pathname = usePathname()
  const [menuOpen, setMenuOpen] = useState(false)

  // Close the drawer whenever the route changes.
  useEffect(() => {
    setMenuOpen(false)
  }, [pathname])

  const handleLogout = async () => {
    const res = await logoutAction('fa')
    window.location.href = res?.redirectUrl || '/admin/login'
  }

  // The print view renders bare, without the admin chrome.
  if (/\/admin\/orders\/[^/]+\/print$/.test(pathname)) return <>{children}</>

  const userBlock = (
    <div className="flex items-center gap-2 text-xs">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-border-gold bg-primary/10 font-bold text-primary">
        {userName.trim().charAt(0) || '؟'}
      </span>
      <span className="min-w-0">
        <span className="block truncate font-bold">{userName}</span>
        <span className="block text-[11px] text-muted-foreground">{ROLE_FA[role]}</span>
      </span>
    </div>
  )

  return (
    <div className="flex min-h-screen bg-background text-foreground">
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-e border-border bg-surface lg:flex print:hidden">
        <div className="border-b border-border p-5">
          <Link href="/admin" className="flex items-center gap-2" aria-label="داشبورد مدیریت">
            <PetBossLogo size="sm" variant="gold" />
          </Link>
          <div className="mt-2 text-[11px] text-muted-foreground">پنل مدیریت کلینیک و فروشگاه</div>
        </div>
        <div className="scrollbar-thin flex-1 overflow-y-auto px-3 py-4">
          <AdminNav role={role} badges={badges} pathname={pathname} />
        </div>
        <div className="border-t border-border p-4">{userBlock}</div>
      </aside>

      <Sheet open={menuOpen} onClose={() => setMenuOpen(false)} title="منوی مدیریت" side="start" footer={userBlock}>
        <div id="admin-mobile-nav">
          <AdminNav role={role} badges={badges} pathname={pathname} onNavigate={() => setMenuOpen(false)} />
        </div>
      </Sheet>

      <div className="flex min-h-screen min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-14 items-center justify-between gap-2 border-b border-border bg-surface/90 px-4 backdrop-blur sm:h-16 lg:px-6 print:hidden">
          <div className="flex min-w-0 items-center gap-2">
            <button
              type="button"
              onClick={() => setMenuOpen(true)}
              aria-label="باز کردن منو"
              aria-expanded={menuOpen}
              aria-controls="admin-mobile-nav"
              className="relative -ms-2 inline-flex h-11 w-11 items-center justify-center rounded-xl text-foreground hover:bg-surface-elevated lg:hidden"
            >
              <Icon d={ICON.menus} className="h-5 w-5" />
              {badges.openOrders + badges.unreadMessages > 0 && <span aria-hidden className="absolute end-2 top-2 h-2 w-2 rounded-full bg-primary" />}
            </button>
            <p className="truncate text-sm font-bold">پنل مدیریت پت‌باس</p>
          </div>
          <div className="flex shrink-0 items-center gap-1.5 sm:gap-3">
            <Link href="/" target="_blank" className="btn btn-ghost btn-sm">
              <span className="hidden sm:inline">مشاهده سایت</span>
              <span className="sm:hidden">سایت</span>
            </Link>
            <button type="button" onClick={handleLogout} className="btn btn-danger-outline btn-sm">
              خروج
            </button>
          </div>
        </header>

        <main className="min-w-0 flex-1 bg-background p-4 sm:p-6 lg:p-8 print:p-0">{children}</main>
      </div>
    </div>
  )
}
