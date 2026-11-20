'use client'

import { faNum } from '@/components/admin/format'
import { cn } from '@/lib/utils'

export interface PagerProps {
  page: number
  pageSize: number
  total: number
  onPage: (page: number) => void
  onSize?: (size: number) => void
  sizes?: number[]
}

export function pagerRange(page: number, pageSize: number, total: number): { from: number; to: number; pageCount: number } {
  const pageCount = Math.max(1, Math.ceil(total / Math.max(1, pageSize)))
  if (total === 0) return { from: 0, to: 0, pageCount }
  return { from: (page - 1) * pageSize + 1, to: Math.min(total, page * pageSize), pageCount }
}

const cell = 'inline-flex h-11 min-w-11 items-center justify-center rounded-xl border px-3 text-sm font-bold transition-colors disabled:opacity-40'

/** Button pager with a «نمایش ۱ تا ۲۵ از ۳٬۴۲۰» summary. State lives in the caller (usually the URL). */
export function Pager({ page, pageSize, total, onPage, onSize, sizes = [25, 50, 100] }: PagerProps) {
  const { from, to, pageCount } = pagerRange(page, pageSize, total)
  const wanted = new Set<number>([1, pageCount, page - 1, page, page + 1])
  const pages = [...wanted].filter((n) => n >= 1 && n <= pageCount).sort((a, b) => a - b)
  return (
    <div data-testid="pager" className="flex flex-wrap items-center justify-between gap-3 py-3">
      <p className="text-xs text-muted-foreground" aria-live="polite">
        {total === 0 ? 'موردی نیست' : `نمایش ${faNum(from)} تا ${faNum(to)} از ${faNum(total)}`}
      </p>
      <nav aria-label="صفحه‌بندی" className="flex flex-wrap items-center gap-1.5">
        <button type="button" className={cn(cell, 'border-border')} disabled={page <= 1} onClick={() => onPage(page - 1)} data-testid="pager-prev">
          قبلی
        </button>
        {pages.map((n, i) => (
          <span key={n} className="inline-flex items-center gap-1.5">
            {i > 0 && n - pages[i - 1] > 1 && (
              <span aria-hidden className="text-muted-foreground">
                …
              </span>
            )}
            <button
              type="button"
              aria-current={n === page ? 'page' : undefined}
              aria-label={`صفحه ${faNum(n)}`}
              onClick={() => onPage(n)}
              className={cn(cell, n === page ? 'border-primary bg-primary text-charcoal-950' : 'border-border hover:border-primary')}
            >
              {faNum(n)}
            </button>
          </span>
        ))}
        <button type="button" className={cn(cell, 'border-border')} disabled={page >= pageCount} onClick={() => onPage(page + 1)} data-testid="pager-next">
          بعدی
        </button>
      </nav>
      {onSize && (
        <label className="flex items-center gap-2 text-xs text-muted-foreground">
          تعداد در صفحه
          <select className="field field-sm w-20" value={pageSize} onChange={(e) => onSize(Number(e.target.value))}>
            {sizes.map((s) => (
              <option key={s} value={s}>
                {faNum(s)}
              </option>
            ))}
          </select>
        </label>
      )}
    </div>
  )
}
