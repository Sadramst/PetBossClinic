'use client'

import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'
import type { Role } from '@prisma/client'
import { useRouter } from '@/i18n/routing'
import { useModalDialog } from '@/components/ui/dialog'
import { globalSearchAction } from '@/app/actions/admin-search'
import type { SearchGroup } from '@/lib/admin/search'
import { ICON, NAV_GROUPS, QUICK_CREATE, canSee } from '@/lib/admin/nav'

export const OPEN_CMDK_EVENT = 'admin:open-cmdk'

interface Entry {
  key: string
  group: string
  title: string
  subtitle?: string
  href: string
  icon?: string
}

function buildCommands(role: Role): Entry[] {
  const nav = NAV_GROUPS.flatMap((g) => g.items)
    .filter((i) => canSee(role, i.minRole))
    .map<Entry & { words: string }>((i) => ({ key: `nav:${i.href}`, group: 'رفتن به', title: i.label, href: i.href, icon: i.icon, words: `${i.label} ${i.keywords ?? ''}` }))
  const create = QUICK_CREATE.filter((c) => canSee(role, c.minRole)).map<Entry & { words: string }>((c) => ({
    key: `create:${c.id}`,
    group: 'ساخت',
    title: `${c.label} جدید`,
    href: c.href,
    icon: ICON.plus,
    words: `${c.label} جدید افزودن ایجاد`,
  }))
  return [...create, ...nav]
}

const norm = (s: string) => s.replace(/ي/g, 'ی').replace(/ك/g, 'ک').toLowerCase()

/** Ctrl/Cmd+K palette: instant navigation and create commands plus capped, role-aware record search. */
export function CommandPalette({ role }: { role: Role }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const [remote, setRemote] = useState<SearchGroup[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [active, setActive] = useState(0)
  const seq = useRef(0)
  const listId = useId()
  const close = useCallback(() => setOpen(false), [])
  const { ref, handlers } = useModalDialog(open, close)

  useEffect(() => {
    const toggle = () => setOpen((o) => !o)
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        toggle()
      }
    }
    window.addEventListener('keydown', onKey)
    window.addEventListener(OPEN_CMDK_EVENT, toggle)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener(OPEN_CMDK_EVENT, toggle)
    }
  }, [])

  useEffect(() => {
    if (!open) {
      setQ('')
      setRemote([])
      setError('')
    }
  }, [open])

  useEffect(() => {
    const text = q.trim()
    if (text.length < 2) {
      setRemote([])
      setBusy(false)
      setError('')
      return
    }
    const mine = ++seq.current
    setBusy(true)
    const t = setTimeout(() => {
      globalSearchAction(text)
        .then((res) => {
          if (mine !== seq.current) return
          if (res.ok) {
            setRemote(res.data)
            setError('')
          } else {
            setRemote([])
            setError(res.error)
          }
        })
        .catch(() => {
          if (mine === seq.current) setError('جست‌وجو انجام نشد.')
        })
        .finally(() => {
          if (mine === seq.current) setBusy(false)
        })
    }, 250)
    return () => clearTimeout(t)
  }, [q])

  const commands = useMemo(() => buildCommands(role), [role])
  const entries: Entry[] = useMemo(() => {
    const text = norm(q.trim())
    const local = (text ? commands.filter((c) => norm(`${c.title} ${(c as Entry & { words?: string }).words ?? ''}`).includes(text)) : commands).slice(0, text ? 6 : 8)
    const found = remote.flatMap((g) => g.hits.map<Entry>((h) => ({ key: `${g.key}:${h.id}`, group: g.label, title: h.title, subtitle: h.subtitle, href: h.href })))
    return [...found, ...local]
  }, [q, commands, remote])

  useEffect(() => setActive(0), [entries.length, q])

  const go = (e: Entry) => {
    setOpen(false)
    router.push(e.href as never)
  }

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActive((a) => Math.min(a + 1, entries.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActive((a) => Math.max(a - 1, 0))
    } else if (e.key === 'Enter' && entries[active]) {
      e.preventDefault()
      go(entries[active])
    }
  }

  useEffect(() => {
    document.getElementById(`${listId}-${active}`)?.scrollIntoView({ block: 'nearest' })
  }, [active, listId])

  let lastGroup = ''
  return (
    <dialog
      ref={ref}
      aria-modal="true"
      aria-label="جست‌وجوی سریع"
      className="m-0 mx-auto mt-[8vh] max-h-none w-[min(36rem,calc(100vw-2rem))] max-w-none overflow-visible bg-transparent p-0 text-foreground"
      {...handlers}
    >
      {open && (
        <div className="animate-rise-in overflow-hidden rounded-2xl border border-border-gold bg-surface shadow-2xl">
          <div className="flex items-center gap-2 border-b border-border px-3">
            <svg className="h-4 w-4 shrink-0 text-muted-foreground" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d={ICON.search} />
            </svg>
            <input
              data-autofocus
              data-testid="cmdk-input"
              role="combobox"
              aria-expanded="true"
              aria-controls={listId}
              aria-activedescendant={entries[active] ? `${listId}-${active}` : undefined}
              aria-autocomplete="list"
              autoComplete="off"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={onKeyDown}
              placeholder="نام مشتری، شماره موبایل، سفارش، محصول یا بخش…"
              aria-label="جست‌وجو"
              className="h-12 min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
            <kbd className="hidden rounded-md border border-border px-1.5 py-0.5 text-[10px] text-muted-foreground sm:block" dir="ltr">
              Esc
            </kbd>
          </div>
          <ul id={listId} role="listbox" aria-label="نتایج" className="max-h-[60vh] overflow-y-auto overscroll-contain p-1.5">
            {entries.map((e, i) => {
              const header = e.group !== lastGroup
              lastGroup = e.group
              return (
                <li key={e.key} role="presentation">
                  {header && <p className="px-2.5 pb-1 pt-2 text-[11px] font-bold text-muted-foreground">{e.group}</p>}
                  <div
                    id={`${listId}-${i}`}
                    role="option"
                    aria-selected={i === active}
                    data-testid="cmdk-result"
                    onMouseMove={() => setActive(i)}
                    onClick={() => go(e)}
                    className={`flex min-h-11 cursor-pointer items-center gap-3 rounded-xl px-2.5 py-2 text-sm ${i === active ? 'bg-primary/10 text-primary' : 'text-foreground/90'}`}
                  >
                    {e.icon && (
                      <svg className="h-4 w-4 shrink-0 opacity-70" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                        <path d={e.icon} />
                      </svg>
                    )}
                    <span className="min-w-0 flex-1 truncate font-bold">{e.title}</span>
                    {e.subtitle && (
                      <span className="ltr-nums max-w-[40%] truncate text-xs text-muted-foreground" dir="auto">
                        {e.subtitle}
                      </span>
                    )}
                  </div>
                </li>
              )
            })}
            {entries.length === 0 && !busy && <li role="presentation" className="px-3 py-8 text-center text-sm text-muted-foreground">{q.trim().length < 2 ? 'دست‌کم دو حرف بنویسید.' : 'نتیجه‌ای پیدا نشد.'}</li>}
          </ul>
          <div className="flex items-center justify-between gap-2 border-t border-border px-3 py-2 text-[11px] text-muted-foreground" aria-live="polite">
            <span>{busy ? 'در حال جست‌وجو…' : error || 'با کلیدهای جهت‌دار انتخاب و با Enter باز کنید.'}</span>
          </div>
        </div>
      )}
    </dialog>
  )
}
