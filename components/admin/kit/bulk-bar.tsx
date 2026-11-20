'use client'

import { faNum } from '@/components/admin/format'
import { cn } from '@/lib/utils'

export interface BulkAction {
  label: string
  onClick: () => void
  tone?: 'default' | 'danger'
  disabled?: boolean
}

export interface BulkBarProps {
  count: number
  actions: BulkAction[]
  onClear: () => void
}

/** Appears when rows are selected. Renders nothing at zero. */
export function BulkBar({ count, actions, onClear }: BulkBarProps) {
  if (count <= 0) return null
  return (
    <div
      data-testid="bulk-bar"
      role="region"
      aria-label="عملیات گروهی"
      className="sticky bottom-3 z-20 flex flex-wrap items-center gap-2 rounded-2xl border border-border-gold bg-surface-elevated p-3 shadow-gold"
    >
      <span className="me-auto text-sm font-bold" aria-live="polite">
        {faNum(count)} مورد انتخاب شده
      </span>
      {actions.map((a) => (
        <button
          key={a.label}
          type="button"
          disabled={a.disabled}
          onClick={a.onClick}
          className={cn('btn btn-sm', a.tone === 'danger' ? 'btn-danger-outline' : 'btn-outline')}
        >
          {a.label}
        </button>
      ))}
      <button type="button" onClick={onClear} className="btn btn-ghost btn-sm">
        لغو انتخاب
      </button>
    </div>
  )
}
