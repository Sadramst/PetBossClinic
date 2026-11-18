import * as React from "react"

import { Link } from "@/i18n/routing"
import { cn } from "@/lib/utils"

export interface PaginationProps {
  /** Current page, 1-based. */
  page: number
  pageCount: number
  /** Builds the URL of a page. Page 1 should return the bare canonical URL. */
  hrefFor: (page: number) => string
  /** Pages shown on each side of the current one (default 1). */
  siblings?: number
  className?: string
}

const cell =
  "inline-flex h-11 min-w-11 items-center justify-center rounded-xl border px-3 text-sm font-bold transition-colors"

/**
 * Link-based pagination (crawlable, works without JS). Keeps the storefront
 * contract: nav[aria-label="صفحه‌بندی"], rel="prev"/"next" anchors, aria-current="page".
 */
export function Pagination({ page, pageCount, hrefFor, siblings = 1, className }: PaginationProps) {
  if (pageCount <= 1) return null
  const wanted = new Set<number>([1, pageCount])
  for (let n = page - siblings; n <= page + siblings; n++) wanted.add(n)
  const pages = [...wanted].filter((n) => n >= 1 && n <= pageCount).sort((a, b) => a - b)

  return (
    <nav aria-label="صفحه‌بندی" className={cn("mt-8 flex flex-wrap items-center justify-center gap-2", className)}>
      {page > 1 && (
        <Link href={hrefFor(page - 1)} rel="prev" className={cn(cell, "border-border px-4 hover:border-primary hover:text-primary")}>
          قبلی
        </Link>
      )}
      {pages.map((n, i) => (
        <React.Fragment key={n}>
          {i > 0 && n - pages[i - 1] > 1 && (
            <span aria-hidden className="px-1 text-muted-foreground">
              …
            </span>
          )}
          <Link
            href={hrefFor(n)}
            aria-current={n === page ? "page" : undefined}
            aria-label={`صفحه ${n.toLocaleString("fa-IR")}`}
            className={cn(
              cell,
              n === page
                ? "border-primary bg-primary text-charcoal-950"
                : "border-border hover:border-primary hover:text-primary"
            )}
          >
            {n.toLocaleString("fa-IR")}
          </Link>
        </React.Fragment>
      ))}
      {page < pageCount && (
        <Link href={hrefFor(page + 1)} rel="next" className={cn(cell, "border-border px-4 hover:border-primary hover:text-primary")}>
          بعدی
        </Link>
      )}
    </nav>
  )
}
