'use client'

import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

export interface Column<T> {
  key: string
  header: string
  cell: (row: T) => ReactNode
  sortable?: boolean
  align?: 'start' | 'center' | 'end'
  className?: string
}

export type SortState = { key: string; dir: 'asc' | 'desc' } | null

export interface DataTableProps<T> {
  columns: Column<T>[]
  rows: T[]
  rowKey: (row: T) => string
  selectable?: boolean
  selected?: string[]
  onSelectedChange?: (keys: string[]) => void
  sort?: SortState
  onSortChange?: (sort: SortState) => void
  /** Below `md` the table is replaced by one card per row. */
  mobileCard?: (row: T) => ReactNode
  /** Shown instead of the table when there are no rows. */
  empty?: ReactNode
  loading?: boolean
  /** Accessible table caption. */
  caption?: string
  onRowClick?: (row: T) => void
}

const ALIGN = { start: 'text-start', center: 'text-center', end: 'text-end' } as const

/** Sortable, selectable table with a card layout on phones. State is controlled by the caller. */
export function DataTable<T>({
  columns,
  rows,
  rowKey,
  selectable,
  selected = [],
  onSelectedChange,
  sort,
  onSortChange,
  mobileCard,
  empty,
  loading,
  caption,
  onRowClick,
}: DataTableProps<T>) {
  if (loading) {
    return (
      <div data-testid="data-table-loading" role="status" aria-label="در حال بارگذاری" className="space-y-2 rounded-2xl border border-border bg-surface-card p-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-10 animate-pulse rounded-lg bg-surface-elevated" />
        ))}
      </div>
    )
  }
  if (rows.length === 0 && empty) return <>{empty}</>

  const keys = rows.map(rowKey)
  const allSelected = keys.length > 0 && keys.every((k) => selected.includes(k))
  const someSelected = !allSelected && keys.some((k) => selected.includes(k))
  const toggle = (k: string) =>
    onSelectedChange?.(selected.includes(k) ? selected.filter((x) => x !== k) : [...selected, k])
  const toggleAll = () => onSelectedChange?.(allSelected ? selected.filter((k) => !keys.includes(k)) : [...new Set([...selected, ...keys])])

  const nextSort = (key: string): SortState => {
    if (!sort || sort.key !== key) return { key, dir: 'asc' }
    return sort.dir === 'asc' ? { key, dir: 'desc' } : null
  }

  const table = (
    <div className={cn('overflow-x-auto rounded-2xl border border-border bg-surface-card', mobileCard && 'hidden md:block')}>
      <table data-testid="data-table" className="w-full min-w-[40rem] border-collapse text-sm">
        {caption && <caption className="sr-only">{caption}</caption>}
        <thead className="bg-surface text-xs text-muted-foreground">
          <tr>
            {selectable && (
              <th scope="col" className="w-10 px-3 py-3">
                <input
                  type="checkbox"
                  aria-label="انتخاب همه ردیف‌ها"
                  checked={allSelected}
                  ref={(el) => {
                    if (el) el.indeterminate = someSelected
                  }}
                  onChange={toggleAll}
                  className="h-4 w-4 accent-[var(--color-primary,#d4af37)]"
                />
              </th>
            )}
            {columns.map((c) => {
              const active = sort?.key === c.key
              return (
                <th
                  key={c.key}
                  scope="col"
                  aria-sort={active ? (sort!.dir === 'asc' ? 'ascending' : 'descending') : c.sortable ? 'none' : undefined}
                  className={cn('px-3 py-3 font-bold', ALIGN[c.align ?? 'start'], c.className)}
                >
                  {c.sortable && onSortChange ? (
                    <button type="button" onClick={() => onSortChange(nextSort(c.key))} className="inline-flex min-h-8 items-center gap-1 hover:text-primary">
                      {c.header}
                      <span aria-hidden className={active ? 'text-primary' : 'opacity-40'}>
                        {active ? (sort!.dir === 'asc' ? '↑' : '↓') : '↕'}
                      </span>
                    </button>
                  ) : (
                    c.header
                  )}
                </th>
              )
            })}
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {rows.map((row) => {
            const k = rowKey(row)
            const isSel = selected.includes(k)
            return (
              <tr
                key={k}
                data-testid="data-row"
                data-row-id={k}
                aria-selected={selectable ? isSel : undefined}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                className={cn('hover:bg-surface-hover', isSel && 'bg-primary/5', onRowClick && 'cursor-pointer')}
              >
                {selectable && (
                  <td className="w-10 px-3 py-2.5" onClick={(e) => e.stopPropagation()}>
                    <input type="checkbox" aria-label="انتخاب ردیف" checked={isSel} onChange={() => toggle(k)} className="h-4 w-4 accent-[var(--color-primary,#d4af37)]" />
                  </td>
                )}
                {columns.map((c) => (
                  <td key={c.key} className={cn('px-3 py-2.5 align-middle', ALIGN[c.align ?? 'start'], c.className)}>
                    {c.cell(row)}
                  </td>
                ))}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )

  if (!mobileCard) return table
  return (
    <>
      {table}
      <ul className="space-y-2 md:hidden" aria-label={caption}>
        {rows.map((row) => {
          const k = rowKey(row)
          return (
            <li key={k} data-testid="data-row-card" data-row-id={k} className="rounded-2xl border border-border bg-surface-card p-3">
              {selectable && (
                <label className="mb-2 flex min-h-11 items-center gap-2 text-xs text-muted-foreground">
                  <input type="checkbox" checked={selected.includes(k)} onChange={() => toggle(k)} className="h-4 w-4 accent-[var(--color-primary,#d4af37)]" />
                  انتخاب
                </label>
              )}
              {mobileCard(row)}
            </li>
          )
        })}
      </ul>
    </>
  )
}
