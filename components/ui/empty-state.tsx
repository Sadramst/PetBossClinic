import * as React from "react"

import { cn } from "@/lib/utils"

export interface EmptyStateProps extends Omit<React.HTMLAttributes<HTMLDivElement>, "title"> {
  /** Icon element (an svg ~28px). Rendered inside a gold-tinted circle. */
  icon?: React.ReactNode
  title: React.ReactNode
  description?: React.ReactNode
  /** Primary action, e.g. `<Link href="/shop" className="btn btn-gold">…</Link>`. */
  action?: React.ReactNode
  /** Secondary action, e.g. `<Link className="btn btn-outline">`. */
  secondaryAction?: React.ReactNode
  /** Heading level for the title. Use "h1" when this is the whole page. */
  as?: "h1" | "h2" | "h3" | "p"
  /** `card` draws a bordered surface, `plain` (default) has no box. */
  variant?: "plain" | "card"
  size?: "sm" | "md"
}

const DEFAULT_ICON = (
  <svg className="h-7 w-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M3 8.5 12 4l9 4.5v7L12 20l-9-4.5v-7z" />
    <path d="m3 8.5 9 4.5 9-4.5M12 13v7" />
  </svg>
)

/** One look for every "nothing here" moment: empty cart, no results, no orders, no posts. */
export function EmptyState({
  icon = DEFAULT_ICON,
  title,
  description,
  action,
  secondaryAction,
  as: Heading = "h2",
  variant = "plain",
  size = "md",
  className,
  children,
  ...props
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "mx-auto flex max-w-md flex-col items-center text-center",
        size === "md" ? "px-4 py-12 sm:py-16" : "px-4 py-8",
        variant === "card" && "max-w-none rounded-2xl border border-dashed border-border bg-surface-card/60",
        className
      )}
      {...props}
    >
      {icon && (
        <div
          aria-hidden
          className={cn(
            "flex items-center justify-center rounded-full border border-border-gold bg-primary/10 text-primary",
            size === "md" ? "h-16 w-16" : "h-12 w-12"
          )}
        >
          {icon}
        </div>
      )}
      <Heading className={cn("font-extrabold", size === "md" ? "mt-5 text-lg sm:text-xl" : "mt-3 text-base")}>
        {title}
      </Heading>
      {description && <p className="mt-2 max-w-sm text-sm leading-7 text-muted-foreground">{description}</p>}
      {children}
      {(action || secondaryAction) && (
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          {action}
          {secondaryAction}
        </div>
      )}
    </div>
  )
}
