import * as React from "react"

import { Link } from "@/i18n/routing"
import { cn } from "@/lib/utils"

export interface SectionHeadingProps {
  title: React.ReactNode
  subtitle?: React.ReactNode
  /** Small gold label above the title. */
  eyebrow?: React.ReactNode
  /** "View all" destination; omitted when not set. */
  href?: string
  linkLabel?: string
  /** Accessible name for the link when `linkLabel` alone is ambiguous, e.g. "مشاهده همه غذای گربه". */
  linkAriaLabel?: string
  /** Heading level (default h2). */
  as?: "h1" | "h2" | "h3"
  /** id for the heading so the section can use aria-labelledby. */
  id?: string
  align?: "start" | "center"
  /** Custom content at the inline end instead of / next to the link. */
  action?: React.ReactNode
  className?: string
}

/** Section title row: title + optional subtitle, and a "view all" link at the inline end. */
export function SectionHeading({
  title,
  subtitle,
  eyebrow,
  href,
  linkLabel = "مشاهده همه",
  linkAriaLabel,
  as: Heading = "h2",
  id,
  align = "start",
  action,
  className,
}: SectionHeadingProps) {
  const centered = align === "center"
  return (
    <div
      className={cn(
        "mb-5 flex gap-4 sm:mb-6",
        centered ? "flex-col items-center text-center" : "items-end justify-between",
        className
      )}
    >
      <div className="min-w-0">
        {eyebrow && <p className="mb-1 text-xs font-bold text-primary">{eyebrow}</p>}
        <Heading
          id={id}
          className={cn(
            "font-extrabold",
            Heading === "h1" ? "text-2xl sm:text-3xl" : "text-xl sm:text-2xl",
            !centered && "relative ps-3.5 before:absolute before:inset-y-1.5 before:start-0 before:w-1 before:rounded-full before:bg-gradient-gold"
          )}
        >
          {title}
        </Heading>
        {subtitle && (
          <p className={cn("mt-1.5 text-sm text-muted-foreground", !centered && "ps-3.5")}>{subtitle}</p>
        )}
      </div>
      {(href || action) && (
        <div className="flex shrink-0 items-center gap-2">
          {action}
          {href && (
            <Link
              href={href}
              aria-label={linkAriaLabel}
              className="group inline-flex min-h-9 items-center gap-1 rounded-lg text-sm font-bold text-primary hover:text-primary-hover"
            >
              {linkLabel}
              <svg
                className="h-4 w-4 transition-transform group-hover:-translate-x-0.5 ltr:rotate-180"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden
              >
                <path d="m15 6-6 6 6 6" />
              </svg>
            </Link>
          )}
        </div>
      )}
    </div>
  )
}
