'use client'

import { Link } from '@/i18n/routing'
import { faNum } from '@/components/admin/format'
import { cn } from '@/lib/utils'

export interface AdminTabItem {
  id: string
  label: string
  count?: number
  /** When set, the tab is a link (URL-synced). Otherwise `onChange` handles it. */
  href?: string
}

export interface AdminTabsProps {
  items: AdminTabItem[]
  value: string
  onChange?: (id: string) => void
  label?: string
  /** data-testid becomes `<testIdPrefix>-<id>`. */
  testIdPrefix?: string
}

/** Tab strip for module pages. Link tabs keep state in the URL; button tabs call onChange. */
export function AdminTabs({ items, value, onChange, label = 'بخش‌ها', testIdPrefix }: AdminTabsProps) {
  return (
    <nav aria-label={label} className="scrollbar-none flex overflow-x-auto border-b border-border">
      {items.map((t) => {
        const selected = t.id === value
        const cls = cn(
          '-mb-px inline-flex min-h-11 shrink-0 items-center gap-1.5 whitespace-nowrap border-b-2 px-4 text-sm font-bold transition-colors',
          selected ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground',
        )
        const inner = (
          <>
            {t.label}
            {t.count !== undefined && (
              <span className="rounded-full bg-surface-elevated px-1.5 text-[11px] font-bold text-muted-foreground">{faNum(t.count)}</span>
            )}
          </>
        )
        const tid = testIdPrefix ? `${testIdPrefix}-${t.id}` : undefined
        return t.href ? (
          <Link key={t.id} href={t.href} aria-current={selected ? 'page' : undefined} className={cls} data-testid={tid}>
            {inner}
          </Link>
        ) : (
          <button key={t.id} type="button" aria-current={selected ? 'page' : undefined} onClick={() => onChange?.(t.id)} className={cls} data-testid={tid}>
            {inner}
          </button>
        )
      })}
    </nav>
  )
}
