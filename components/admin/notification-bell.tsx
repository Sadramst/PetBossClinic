'use client'

import { useCallback, useEffect, useRef, useState, useTransition } from 'react'
import { Link, usePathname } from '@/i18n/routing'
import { markNotificationsReadAction, refreshNotificationsAction } from '@/app/actions/admin-notifications'
import type { NotificationItem } from '@/lib/admin/shell-data'
import { ICON } from '@/lib/admin/nav'
import { faNum, relativeAgeFa } from '@/components/admin/format'

export interface NotificationBellProps {
  initial: { unread: number; items: NotificationItem[] }
}

/** Header bell. The list is refreshed after each navigation (no websockets) and when opened. */
export function NotificationBell({ initial }: NotificationBellProps) {
  const [state, setState] = useState(initial)
  const [open, setOpen] = useState(false)
  const [pending, start] = useTransition()
  const box = useRef<HTMLDivElement>(null)
  const pathname = usePathname()
  const first = useRef(true)

  const refresh = useCallback(() => {
    refreshNotificationsAction()
      .then((r) => r.ok && setState(r.data))
      .catch(() => undefined)
  }, [])

  useEffect(() => {
    if (first.current) {
      first.current = false
      return
    }
    refresh()
  }, [pathname, refresh])

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

  const markRead = (ids?: string[]) =>
    start(async () => {
      const r = await markNotificationsReadAction(ids)
      if (r.ok) setState(r.data)
    })

  return (
    <div ref={box} className="relative">
      <button
        type="button"
        data-testid="notif-bell"
        aria-label={state.unread > 0 ? `اعلان‌ها، ${faNum(state.unread)} خوانده‌نشده` : 'اعلان‌ها'}
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={() => {
          setOpen((o) => !o)
          if (!open) refresh()
        }}
        className="relative inline-flex h-11 w-11 items-center justify-center rounded-xl text-foreground hover:bg-surface-elevated"
      >
        <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d={ICON.bell} />
        </svg>
        {state.unread > 0 && (
          <span aria-hidden className="absolute end-1 top-1 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-black leading-none text-charcoal-950">
            {state.unread > 99 ? '۹۹+' : faNum(state.unread)}
          </span>
        )}
      </button>
      {open && (
        <div
          role="dialog"
          aria-label="اعلان‌ها"
          className="fixed inset-x-3 top-16 z-50 max-h-[70vh] overflow-hidden rounded-2xl border border-border bg-surface shadow-2xl sm:absolute sm:inset-x-auto sm:end-0 sm:top-full sm:mt-2 sm:w-96"
        >
          <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-2.5">
            <h2 className="text-sm font-extrabold">اعلان‌ها</h2>
            <button type="button" disabled={pending || state.unread === 0} onClick={() => markRead()} className="text-xs font-bold text-primary hover:underline disabled:opacity-40">
              همه را خوانده کن
            </button>
          </div>
          {state.items.length === 0 ? (
            <p className="px-4 py-10 text-center text-sm text-muted-foreground">اعلانی ندارید. وقتی سفارش، سرنخ یا پیام تازه برسد اینجا می‌بینید.</p>
          ) : (
            <ul className="max-h-[56vh] divide-y divide-border overflow-y-auto">
              {state.items.map((n) => {
                const body = (
                  <>
                    <span className="flex items-start gap-2">
                      {!n.read && <span aria-label="خوانده‌نشده" className="mt-2 h-2 w-2 shrink-0 rounded-full bg-primary" />}
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-bold leading-6">{n.title}</span>
                        {n.body && <span className="clamp-2 block text-xs leading-5 text-muted-foreground">{n.body}</span>}
                        <span className="mt-0.5 block text-[11px] text-muted-foreground">{relativeAgeFa(n.createdAt)}</span>
                      </span>
                    </span>
                  </>
                )
                return (
                  <li key={n.id} data-testid="notif-item" className={n.read ? 'opacity-70' : ''}>
                    {n.href ? (
                      <Link
                        href={n.href as never}
                        onClick={() => {
                          setOpen(false)
                          if (!n.read) markRead([n.id])
                        }}
                        className="block min-h-11 px-4 py-3 hover:bg-surface-hover"
                      >
                        {body}
                      </Link>
                    ) : (
                      <button type="button" onClick={() => !n.read && markRead([n.id])} className="block min-h-11 w-full px-4 py-3 text-start hover:bg-surface-hover">
                        {body}
                      </button>
                    )}
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
