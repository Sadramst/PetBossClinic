import * as React from "react"

import { cn } from "@/lib/utils"

export interface CheckboxProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "type"> {
  /** Text beside the box. Clicking it toggles the box. */
  label?: React.ReactNode
  description?: React.ReactNode
}

/** Native gold checkbox with a 44px tap target and an inline label. */
export const Checkbox = React.forwardRef<HTMLInputElement, CheckboxProps>(
  ({ label, description, className, ...props }, ref) => {
    return (
      <label
        className={cn(
          "flex min-h-11 cursor-pointer items-start gap-3 py-2.5 text-sm has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-60",
          className
        )}
      >
        <input ref={ref} type="checkbox" className="mt-0.5 h-5 w-5 shrink-0 rounded accent-primary" {...props} />
        {(label || description) && (
          <span className="min-w-0">
            {label && <span className="block font-medium">{label}</span>}
            {description && <span className="block text-xs text-muted-foreground">{description}</span>}
          </span>
        )}
      </label>
    )
  }
)
Checkbox.displayName = "Checkbox"

export interface OptionCardProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "type" | "title"> {
  /** "radio" (default) for one-of-many, "checkbox" for toggles. */
  type?: "radio" | "checkbox"
  title: React.ReactNode
  description?: React.ReactNode
  /** Leading icon. */
  icon?: React.ReactNode
  /** Content at the inline end, e.g. a price or badge. */
  trailing?: React.ReactNode
}

/**
 * Selectable card (shipping method, payment method, address…). The whole card is
 * the label of a real radio/checkbox, so it works in plain forms and with the keyboard.
 */
export const OptionCard = React.forwardRef<HTMLInputElement, OptionCardProps>(
  ({ type = "radio", title, description, icon, trailing, className, ...props }, ref) => {
    return (
      <label
        className={cn(
          "group relative flex cursor-pointer items-start gap-3 rounded-2xl border border-border bg-surface-card p-4 transition-colors",
          "hover:border-border-gold has-[:checked]:border-primary has-[:checked]:bg-primary/[0.07]",
          "has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-ring",
          "has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-55",
          className
        )}
      >
        <input ref={ref} type={type} className="peer sr-only" {...props} />
        <span
          aria-hidden
          className={cn(
            "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center border-2 border-charcoal-400 transition-colors",
            "peer-checked:border-primary peer-checked:bg-primary [&>svg]:opacity-0 peer-checked:[&>svg]:opacity-100",
            type === "radio" ? "rounded-full" : "rounded-md"
          )}
        >
          <svg className="h-3 w-3 text-charcoal-950" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round">
            <path d="m5 12 5 5 9-10" />
          </svg>
        </span>
        {icon && <span className="mt-0.5 shrink-0 text-primary">{icon}</span>}
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-bold">{title}</span>
          {description && <span className="mt-0.5 block text-xs text-muted-foreground">{description}</span>}
        </span>
        {trailing && <span className="shrink-0 text-sm font-bold">{trailing}</span>}
      </label>
    )
  }
)
OptionCard.displayName = "OptionCard"
