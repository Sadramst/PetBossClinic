'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'

export type FilterDef =
  | { key: string; label: string; type: 'select'; options: { value: string; label: string }[]; value: string; testId?: string }
  | { key: string; label: string; type: 'toggle'; value: boolean; testId?: string }

export interface FilterBarProps {
  search: { value: string; placeholder: string }
  filters?: FilterDef[]
  /** Saved-views control (owned by the CRM data epic), rendered at the end of the bar. */
  views?: ReactNode
  /** Called with only the changed keys. `q` carries the search text. */
  onChange: (patch: Record<string, string | boolean>) => void
  onReset: () => void
  /** Debounce for the search box in ms (0 disables). */
  debounceMs?: number
  /** True when any filter or search is applied; shows the reset button. */
  dirty?: boolean
}

/**
 * Sticky filter row: debounced search, select/toggle filters, reset.
 * It does not touch the URL itself; pass `useUrlState`'s patch as `onChange`.
 */
export function FilterBar({ search, filters = [], views, onChange, onReset, debounceMs = 300, dirty }: FilterBarProps) {
  const [text, setText] = useState(search.value)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const last = useRef(search.value)

  // Keep the box in sync when the URL changes from outside (reset, back button).
  useEffect(() => {
    if (search.value !== last.current) {
      last.current = search.value
      setText(search.value)
    }
  }, [search.value])
  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current)
  }, [])

  const commit = (v: string) => {
    last.current = v
    onChange({ q: v })
  }
  const onText = (v: string) => {
    setText(v)
    if (timer.current) clearTimeout(timer.current)
    if (debounceMs <= 0) return commit(v)
    timer.current = setTimeout(() => commit(v), debounceMs)
  }
  const showReset = dirty ?? (Boolean(text) || filters.some((f) => (f.type === 'toggle' ? f.value : f.value !== '')))

  return (
    <div role="search" className="sticky top-14 z-20 -mx-4 mb-4 flex flex-wrap items-center gap-2 border-b border-border bg-background/95 px-4 py-3 backdrop-blur sm:top-16 sm:mx-0 sm:rounded-2xl sm:border sm:bg-surface-card sm:px-3">
      <input
        type="search"
        value={text}
        onChange={(e) => onText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            if (timer.current) clearTimeout(timer.current)
            commit(text)
          }
        }}
        placeholder={search.placeholder}
        aria-label={search.placeholder}
        data-testid="filter-search"
        className="field min-w-0 flex-1 basis-48"
      />
      {filters.map((f) =>
        f.type === 'select' ? (
          <label key={f.key} className="flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
            <span className="sr-only sm:not-sr-only">{f.label}</span>
            <select
              value={f.value}
              aria-label={f.label}
              data-testid={f.testId}
              onChange={(e) => onChange({ [f.key]: e.target.value })}
              className="field field-sm min-w-0 max-w-[11rem]"
            >
              {f.options.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
        ) : (
          <label key={f.key} className="flex min-h-9 items-center gap-2 text-xs font-bold">
            <input type="checkbox" checked={f.value} data-testid={f.testId} onChange={(e) => onChange({ [f.key]: e.target.checked })} className="h-4 w-4 accent-[var(--color-primary,#d4af37)]" />
            {f.label}
          </label>
        ),
      )}
      {views}
      {showReset && (
        <button
          type="button"
          data-testid="filter-reset"
          onClick={() => {
            if (timer.current) clearTimeout(timer.current)
            last.current = ''
            setText('')
            onReset()
          }}
          className="btn btn-ghost btn-sm"
        >
          پاک‌کردن فیلترها
        </button>
      )}
    </div>
  )
}
