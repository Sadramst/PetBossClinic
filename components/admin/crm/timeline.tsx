'use client'

import { useState, useTransition } from 'react'
import { Link } from '@/i18n/routing'
import { EmptyState } from '@/components/admin/kit'
import { Button } from '@/components/ui/button'
import { toast } from '@/components/ui/toaster'
import { loadTimelineAction } from '@/app/actions/crm-customers'
import { TIMELINE_GROUPS } from '@/lib/crm/labels'
import { formatJalaliDateTime } from '@/components/admin/format'
import { cn } from '@/lib/utils'

export type TimelineEntry = {
  key: string
  type: string
  label: string
  summary: string
  occurredAt: string | Date
  href?: string
}

export interface TimelineProps {
  customerId: string
  initial: TimelineEntry[]
  initialCursor: string | null
}

const DOT: Record<string, string> = {
  orders: 'bg-primary',
  clinic: 'bg-emerald-500',
  messages: 'bg-sky-500',
  points: 'bg-amber-500',
  work: 'bg-violet-500',
  lead: 'bg-rose-400',
}

export function groupOf(type: string): string | null {
  return TIMELINE_GROUPS.find((g) => g.types.includes(type))?.id ?? null
}

/** Unified activity feed: one newest-first list across orders, clinic, messages, points and work. */
export function Timeline({ customerId, initial, initialCursor }: TimelineProps) {
  const [group, setGroup] = useState<string | null>(null)
  const [items, setItems] = useState<TimelineEntry[]>(initial)
  const [cursor, setCursor] = useState<string | null>(initialCursor)
  const [pending, start] = useTransition()

  function load(nextGroup: string | null, more: boolean) {
    start(async () => {
      const r = await loadTimelineAction(customerId, nextGroup, more ? cursor : null)
      if (!r.ok) return void toast.error(r.error)
      setItems((cur) => (more ? [...cur, ...r.data.items] : r.data.items))
      setCursor(r.data.nextCursor)
    })
  }

  function pick(g: string | null) {
    setGroup(g)
    if (g === null && items === initial) return
    load(g, false)
  }

  return (
    <section aria-label="تاریخچهٔ مشتری" className="space-y-3" data-testid="timeline">
      <div role="group" aria-label="فیلتر تاریخچه" className="flex flex-wrap gap-2">
        {[{ id: null as string | null, label: 'همه' }, ...TIMELINE_GROUPS.map((g) => ({ id: g.id as string | null, label: g.label }))].map((g) => (
          <button
            key={g.id ?? 'all'}
            type="button"
            aria-pressed={group === g.id}
            onClick={() => pick(g.id)}
            data-testid={`timeline-filter-${g.id ?? 'all'}`}
            className={cn('min-h-9 rounded-full border px-3 text-xs font-bold', group === g.id ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground hover:text-foreground')}
          >
            {g.label}
          </button>
        ))}
      </div>

      {items.length === 0 ? (
        <EmptyState title="رویدادی ثبت نشده" description="سفارش، مراجعه، پیام و کارهای این مشتری اینجا به ترتیب زمان جمع می‌شود." />
      ) : (
        <ol className="relative space-y-3 border-s border-border ps-5" data-testid="timeline-list">
          {items.map((it) => {
            const g = groupOf(it.type)
            const body = (
              <>
                <span className="block text-sm font-bold">{it.label}</span>
                {it.summary && <span className="block text-sm leading-6 text-muted-foreground">{it.summary}</span>}
              </>
            )
            return (
              <li key={it.key} className="relative" data-testid="timeline-item" data-type={it.type}>
                <span aria-hidden className={cn('absolute -start-[1.65rem] top-1.5 h-2.5 w-2.5 rounded-full', g ? DOT[g] : 'bg-border')} />
                {it.href ? (
                  <Link href={it.href} className="block hover:text-primary">
                    {body}
                  </Link>
                ) : (
                  body
                )}
                <time className="text-[11px] text-muted-foreground" dateTime={new Date(it.occurredAt).toISOString()}>
                  {formatJalaliDateTime(new Date(it.occurredAt))}
                </time>
              </li>
            )
          })}
        </ol>
      )}

      {cursor && (
        <Button variant="secondary" size="sm" disabled={pending} onClick={() => load(group, true)} data-testid="timeline-more">
          رویدادهای قدیمی‌تر
        </Button>
      )}
    </section>
  )
}
