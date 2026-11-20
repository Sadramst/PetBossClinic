'use client'

import { useEffect, useRef, useState } from 'react'
import type { Role } from '@prisma/client'
import { Link, usePathname } from '@/i18n/routing'
import { PetBossLogo } from '@/components/shared/pet-boss-logo'
import { Sheet } from '@/components/ui/sheet'
import { logoutAction } from '@/app/actions/auth'
import { CommandPalette, OPEN_CMDK_EVENT } from '@/components/admin/command-palette'
import { NotificationBell } from '@/components/admin/notification-bell'
import { faNum } from '@/components/admin/format'
import { ICON, QUICK_CREATE, ROLE_FA, canSee, isNavActive, navFor, navSlug, navTitleFor } from '@/lib/admin/nav'
import type { NotificationItem, ShellBadges } from '@/lib/admin/shell-data'

export interface AdminShellProps {
  role: Role
  userName: string
  badges: ShellBadges
  notifications?: { unread: number; items: NotificationItem[] }
  children: React.ReactNode
}

function Icon({ d, className = 'h-[18px] w-[18px]' }: { d: string; className?: string }) {
  return (
    <svg className={`shrink-0 ${className}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d={d} />
    </svg>
  )
}

function AdminNav({ role, badges, pathname, onNavigate }: { role: Role; badges: ShellBadges; pathname: string; onNavigate?: () => void }) {
  return (
    <nav aria-label="منوی مدیریت" className="space-y-5">
      {navFor(role).map((group, idx) => (
        <div key={group.label ?? idx}>
          {group.label && <p className="mb-1.5 px-3 text-[11px] font-bold text-muted-foreground">{group.label}</p>}
          <ul className="space-y-0.5">
            {group.items.map((item) => {
              const active = isNavActive(item, pathname)
              const count = item.badge ? badges[item.badge] : 0
              const slug = navSlug(item.href)
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={onNavigate}
                    data-testid={`nav-${slug}`}
                    aria-current={active ? 'page' : undefined}
                    className={`flex min-h-10 items-center gap-3 rounded-xl px-3 py-2 text-[13px] font-semibold transition-colors ${
                      active ? 'bg-primary font-bold text-charcoal-950 shadow-gold' : 'text-foreground/80 hover:bg-surface-elevated hover:text-primary'
                    }`}
                  >
                    <Icon d={item.icon} />
                    <span className="min-w-0 flex-1 truncate">{item.label}</span>
                    {count > 0 && (
                      <span
                        data-testid={`nav-badge-${slug}`}
                        aria-label={`${faNum(count)} مورد`}
                        className={`inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[11px] font-bold leading-none ${
                          active ? 'bg-charcoal-950 text-primary' : 'bg-primary text-charcoal-950'
                        }`}
                      >
                        {count > 99 ? `${faNum(99)}+` : faNum(count)}
                      </span>
                    )}
                  </Link>
                </li>
              )
            })}
          </ul>
        </div>
      ))}
    </nav>
  )
}

function QuickCreateMenu({ role }: { role: Role }) {
  const [open, setOpen] = useState(false)
  const box = useRef<HTMLDivElement>(null)
  const pathname = usePathname()
  const items = QUICK_CREATE.filter((c) => canSee(role, c.minRole))

  useEffect(() => setOpen(false), [pathname])
  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (box.current && !box.current.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  if (items.length === 0) return null
  return (
    <div ref={box} className="relative">
      <button
        type="button"
        data-testid="quick-create"
        aria-label="افزودن سریع"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-primary text-charcoal-950 hover:opacity-90"
      >
        <Icon d={ICON.plus} className="h-5 w-5" />
      </button>
      {open && (
        <div role="menu" aria-label="افزودن سریع" className="absolute end-0 top-full z-50 mt-2 w-48 overflow-hidden rounded-2xl border border-border bg-surface p-1.5 shadow-2xl">
          {items.map((c) => (
            <Link key={c.id} role="menuitem" href={c.href as never} className="flex min-h-11 items-center gap-2 rounded-xl px-3 text-sm font-bold hover:bg-surface-hover hover:text-primary">
              <Icon d={ICON.plus} className="h-4 w-4 text-primary" />
              {c.label} جدید
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}

export function AdminShell({ role, userName, badges, notifications, children }: AdminShellProps) {
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
  const pending = badges.orders + badges.tickets + badges.tasks + badges.leads
  const section = navTitleFor(pathname)

  return (
    <div className="flex min-h-screen bg-background text-foreground">
      <a href="#admin-main" className="sr-only focus:not-sr-only focus:fixed focus:start-3 focus:top-3 focus:z-[60] focus:rounded-lg focus:bg-primary focus:px-3 focus:py-2 focus:text-charcoal-950">
        رفتن به محتوای اصلی
      </a>
      <aside data-testid="admin-sidebar" className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-e border-border bg-surface lg:flex print:hidden">
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
        <header className="sticky top-0 z-30 flex h-14 items-center justify-between gap-1 border-b border-border bg-surface/90 px-3 backdrop-blur sm:h-16 sm:gap-2 sm:px-4 lg:px-6 print:hidden">
          <div className="flex min-w-0 items-center gap-1">
            <button
              type="button"
              onClick={() => setMenuOpen(true)}
              aria-label="باز کردن منو"
              aria-expanded={menuOpen}
              aria-controls="admin-mobile-nav"
              className="relative inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-foreground hover:bg-surface-elevated lg:hidden"
            >
              <Icon d={ICON.menu} className="h-5 w-5" />
              {pending > 0 && <span aria-hidden className="absolute end-2 top-2 h-2 w-2 rounded-full bg-primary" />}
            </button>
            <p className="truncate text-sm font-bold">{section ?? 'پنل مدیریت پت‌باس'}</p>
          </div>
          <div className="flex shrink-0 items-center gap-0.5 sm:gap-1.5">
            <button
              type="button"
              data-testid="cmdk-trigger"
              onClick={() => window.dispatchEvent(new Event(OPEN_CMDK_EVENT))}
              aria-label="جست‌وجوی سریع (Ctrl+K)"
              className="inline-flex h-11 items-center justify-center gap-2 rounded-xl px-3 text-muted-foreground hover:bg-surface-elevated hover:text-foreground sm:border sm:border-border sm:bg-surface-card"
            >
              <Icon d={ICON.search} className="h-5 w-5 sm:h-4 sm:w-4" />
              <span className="hidden text-xs sm:inline">جست‌وجو</span>
              <kbd className="hidden rounded-md border border-border px-1.5 py-0.5 text-[10px] md:inline" dir="ltr">
                Ctrl K
              </kbd>
            </button>
            <QuickCreateMenu role={role} />
            <NotificationBell initial={notifications ?? { unread: 0, items: [] }} />
            <Link href="/" target="_blank" className="btn btn-ghost btn-sm hidden sm:inline-flex">
              مشاهده سایت
            </Link>
            <button type="button" onClick={handleLogout} className="btn btn-danger-outline btn-sm">
              خروج
            </button>
          </div>
        </header>

        <main id="admin-main" tabIndex={-1} className="min-w-0 flex-1 bg-background p-4 outline-none sm:p-6 lg:p-8 print:p-0">
          {children}
        </main>
      </div>
      <CommandPalette role={role} />
    </div>
  )
}
