"use client"

import * as React from "react"

import { cn } from "@/lib/utils"

export interface QuantityStepperProps {
  value: number
  onChange: (next: number) => void
  min?: number
  /** Upper bound (usually the stock on hand). */
  max?: number
  disabled?: boolean
  size?: "sm" | "md"
  /** Accessible name of the group, e.g. the product title. */
  label?: string
  /** When the value equals `min`, the minus button calls this instead (shown as a bin icon). */
  onRemove?: () => void
  className?: string
}

/** − value + control with Persian digits and 44px (md) / 36px (sm) tap targets. */
export function QuantityStepper({
  value,
  onChange,
  min = 1,
  max = 99,
  disabled,
  size = "md",
  label = "تعداد",
  onRemove,
  className,
}: QuantityStepperProps) {
  const atMin = value <= min
  const atMax = value >= max
  const removeMode = atMin && Boolean(onRemove)
  const btn = cn(
    "flex shrink-0 items-center justify-center rounded-lg text-primary transition-colors hover:bg-primary/10 disabled:pointer-events-none disabled:opacity-35",
    size === "md" ? "h-11 w-11" : "h-9 w-9"
  )
  return (
    <div
      role="group"
      aria-label={label}
      className={cn(
        "inline-flex items-center rounded-xl border border-border bg-input",
        disabled && "opacity-60",
        className
      )}
    >
      <button
        type="button"
        className={btn}
        disabled={disabled || atMax}
        aria-label="افزایش تعداد"
        onClick={() => onChange(Math.min(max, value + 1))}
      >
        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden>
          <path d="M12 5v14M5 12h14" />
        </svg>
      </button>
      <output
        aria-live="polite"
        className={cn("text-center font-extrabold tabular-nums", size === "md" ? "min-w-9 text-base" : "min-w-7 text-sm")}
      >
        {value.toLocaleString("fa-IR")}
      </output>
      <button
        type="button"
        className={cn(btn, removeMode && "text-red-400 hover:bg-red-500/10")}
        disabled={disabled || (atMin && !onRemove)}
        aria-label={removeMode ? "حذف از سبد" : "کاهش تعداد"}
        onClick={() => (removeMode ? onRemove?.() : onChange(Math.max(min, value - 1)))}
      >
        {removeMode ? (
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-12M9 7V4h6v3" />
          </svg>
        ) : (
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden>
            <path d="M5 12h14" />
          </svg>
        )}
      </button>
    </div>
  )
}
