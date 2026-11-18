import * as React from "react"

import { cn } from "@/lib/utils"

/** Shimmering placeholder block. Size it with utilities: `<Skeleton className="h-4 w-32" />`. */
export function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div aria-hidden className={cn("skeleton", className)} {...props} />
}

/** Several text-line placeholders; the last line is shorter. */
export function SkeletonText({ lines = 3, className }: { lines?: number; className?: string }) {
  return (
    <div aria-hidden className={cn("space-y-2.5", className)}>
      {Array.from({ length: lines }, (_, i) => (
        <div key={i} className={cn("skeleton h-3.5", i === lines - 1 ? "w-3/5" : "w-full")} />
      ))}
    </div>
  )
}

/** Placeholder matching the storefront product card (square image, two title lines, price). */
export function ProductCardSkeleton({ className }: { className?: string }) {
  return (
    <div aria-hidden className={cn("overflow-hidden rounded-2xl border border-border bg-surface-card", className)}>
      <div className="skeleton aspect-square rounded-none" />
      <div className="space-y-2.5 p-3">
        <div className="skeleton h-3 w-1/3" />
        <div className="skeleton h-3.5 w-full" />
        <div className="skeleton h-3.5 w-2/3" />
        <div className="skeleton mt-3 h-4 w-1/2" />
      </div>
    </div>
  )
}

/** Product grid placeholder in the same columns as the listing pages. */
export function ProductGridSkeleton({
  count = 8,
  className = "grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 xl:grid-cols-4",
}: {
  count?: number
  className?: string
}) {
  return (
    <div aria-hidden className={className}>
      {Array.from({ length: count }, (_, i) => (
        <ProductCardSkeleton key={i} />
      ))}
    </div>
  )
}

/**
 * Wrapper for route-level loading.tsx files: announces "loading" once to
 * assistive tech and hides the decorative skeletons inside.
 */
export function LoadingRegion({
  label = "در حال بارگذاری…",
  className,
  children,
}: {
  label?: string
  className?: string
  children: React.ReactNode
}) {
  return (
    <div role="status" aria-busy="true" aria-live="polite" className={className}>
      <span className="sr-only">{label}</span>
      {children}
    </div>
  )
}
