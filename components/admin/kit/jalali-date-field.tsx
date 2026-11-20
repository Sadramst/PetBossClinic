'use client'

import { useEffect, useId, useState } from 'react'
import { formatJalaliInput, parseJalaliInput } from '@/lib/date/jalali'
import { formatJalaliDate } from '@/lib/shop/expiry'

export interface JalaliPreset {
  label: string
  /** Months from today. */
  months: number
}

export interface JalaliDateFieldProps {
  /** ISO string or null. */
  value: string | null
  onChange: (iso: string | null) => void
  /** Earliest accepted date (ISO). */
  min?: string
  presets?: JalaliPreset[]
  label?: string
  id?: string
  disabled?: boolean
  'data-testid'?: string
}

export function addMonths(from: Date, months: number): Date {
  const d = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate(), 12))
  d.setUTCMonth(d.getUTCMonth() + months)
  return d
}

/**
 * Jalali date entry. Type «۱۴۰۶/۰۸/۲۰» (Persian or Latin digits, / - or .) or tap a preset.
 * Emits an ISO string at 12:00 UTC so no timezone can shift the day, or null while empty or invalid.
 */
/** An unparsable incoming value (a hand-edited URL) is treated as empty instead of crashing the page. */
function safeValue(v: string | null): string | null {
  return v && !Number.isNaN(new Date(v).getTime()) ? v : null
}

export function JalaliDateField({ value: rawValue, onChange, min, presets, label, id, disabled, ...rest }: JalaliDateFieldProps) {
  const autoId = useId()
  const fieldId = id ?? autoId
  const value = safeValue(rawValue)
  const [text, setText] = useState(() => (value ? formatJalaliInput(new Date(value)) : ''))

  useEffect(() => {
    // External change (preset, reset): mirror it unless the typed text already means the same day.
    const typed = parseJalaliInput(text)
    const same = value ? typed?.toISOString() === new Date(value).toISOString() : !typed
    if (!same) setText(value ? formatJalaliInput(new Date(value)) : '')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value])

  const parsed = text.trim() ? parseJalaliInput(text) : null
  const tooEarly = parsed && min ? parsed.getTime() < new Date(min).getTime() : false
  const invalid = Boolean(text.trim()) && (!parsed || tooEarly)
  const msg = !text.trim()
    ? 'مثال: ۱۴۰۶/۰۸/۲۰'
    : !parsed
      ? 'تاریخ معتبر نیست. به شکل ۱۴۰۶/۰۸/۲۰ بنویسید.'
      : tooEarly
        ? 'این تاریخ زودتر از حداقل مجاز است.'
        : formatJalaliDate(parsed)

  const set = (v: string) => {
    setText(v)
    const d = v.trim() ? parseJalaliInput(v) : null
    onChange(d && !(min && d.getTime() < new Date(min).getTime()) ? d.toISOString() : null)
  }

  return (
    <div className="space-y-1.5">
      {label && (
        <label htmlFor={fieldId} className="block text-xs font-bold">
          {label}
        </label>
      )}
      <input
        id={fieldId}
        data-testid={rest['data-testid']}
        type="text"
        inputMode="numeric"
        dir="ltr"
        disabled={disabled}
        value={text}
        onChange={(e) => set(e.target.value)}
        placeholder="1406/08/20"
        aria-invalid={invalid || undefined}
        aria-describedby={`${fieldId}-hint`}
        className="field ltr-nums text-start"
      />
      <p id={`${fieldId}-hint`} className={`text-[11px] leading-5 ${invalid ? 'text-red-400' : 'text-muted-foreground'}`}>
        {msg}
      </p>
      {presets && presets.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {presets.map((p) => (
            <button
              key={p.label}
              type="button"
              disabled={disabled}
              onClick={() => set(formatJalaliInput(addMonths(new Date(), p.months)))}
              className="chip"
            >
              {p.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
