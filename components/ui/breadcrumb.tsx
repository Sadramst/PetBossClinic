import * as React from "react"

import { Link } from "@/i18n/routing"
import { cn } from "@/lib/utils"

export interface BreadcrumbItem {
  label: string
  /** Omit on the last (current) item. */
  href?: string
}

/**
 * Visual breadcrumb trail only. Structured data (BreadcrumbList JSON-LD) stays
 * where each page already emits it. Scrolls horizontally on narrow screens.
 */
export function Breadcrumb({ items, className }: { items: BreadcrumbItem[]; className?: string }) {
  return (
    <nav aria-label="مسیر صفحه" className={cn("scrollbar-none overflow-x-auto", className)}>
      <ol className="flex items-center gap-1.5 whitespace-nowrap text-xs text-muted-foreground">
        {items.map((item, i) => {
          const last = i === items.length - 1
          return (
            <li key={`${item.label}-${i}`} className="flex items-center gap-1.5">
              {i > 0 && (
                <svg className="h-3 w-3 shrink-0 opacity-60 ltr:rotate-180" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d="m15 6-6 6 6 6" />
                </svg>
              )}
              {item.href && !last ? (
                <Link href={item.href} className="inline-flex min-h-8 items-center hover:text-primary">
                  {item.label}
                </Link>
              ) : (
                <span aria-current={last ? "page" : undefined} className="inline-flex min-h-8 items-center font-medium text-foreground/90">
                  {item.label}
                </span>
              )}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
