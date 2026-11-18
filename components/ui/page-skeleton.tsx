import * as React from "react"

import { LoadingRegion, ProductGridSkeleton } from "./skeleton"

/**
 * Ready-made route skeletons. Use from a segment's loading.tsx:
 *
 *   export { PageSkeleton as default } from '@/components/ui/page-skeleton';
 *
 * Only add loading.tsx to segments whose pages never call notFound() after an
 * await during a dynamic (per-request) render: a loading.tsx makes the page
 * stream, and a streamed page has already answered HTTP 200 by the time
 * notFound() runs, which turns real 404s into soft 404s.
 */

/** Generic page: breadcrumb bar, title, intro lines and three content cards. */
export function PageSkeleton() {
  return (
    <LoadingRegion className="container-site py-8 sm:py-12">
      <div className="skeleton h-3 w-40" />
      <div className="skeleton mt-6 h-8 w-2/3 max-w-md" />
      <div className="mt-4 space-y-2.5">
        <div className="skeleton h-3.5 w-full max-w-2xl" />
        <div className="skeleton h-3.5 w-5/6 max-w-xl" />
      </div>
      <div className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="rounded-2xl border border-border bg-surface-card p-5">
            <div className="skeleton h-28 w-full" />
            <div className="skeleton mt-4 h-4 w-3/4" />
            <div className="skeleton mt-2.5 h-3.5 w-1/2" />
          </div>
        ))}
      </div>
    </LoadingRegion>
  )
}

/** Product listing: title bar, sort row and a grid of card placeholders. */
export function ListingSkeleton({ count = 8 }: { count?: number }) {
  return (
    <LoadingRegion className="container-site py-6 sm:py-10">
      <div className="skeleton h-3 w-40" />
      <div className="mt-5 flex items-center justify-between gap-4">
        <div className="skeleton h-8 w-48" />
        <div className="skeleton h-11 w-32" />
      </div>
      <div className="mt-6">
        <ProductGridSkeleton count={count} />
      </div>
    </LoadingRegion>
  )
}

/** Product detail: square gallery beside the buy box. */
export function ProductDetailSkeleton() {
  return (
    <LoadingRegion className="container-site py-6 sm:py-10">
      <div className="skeleton h-3 w-56" />
      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2 lg:gap-10">
        <div className="skeleton aspect-square w-full rounded-2xl" />
        <div>
          <div className="skeleton h-3.5 w-24" />
          <div className="skeleton mt-4 h-8 w-5/6" />
          <div className="skeleton mt-3 h-4 w-1/2" />
          <div className="skeleton mt-8 h-9 w-40" />
          <div className="skeleton mt-6 h-12 w-full rounded-xl" />
          <div className="mt-8 space-y-2.5">
            <div className="skeleton h-3.5 w-full" />
            <div className="skeleton h-3.5 w-full" />
            <div className="skeleton h-3.5 w-2/3" />
          </div>
        </div>
      </div>
    </LoadingRegion>
  )
}

/** Account / checkout style page: narrow column of form-like cards. */
export function FormPageSkeleton() {
  return (
    <LoadingRegion className="container-narrow py-8 sm:py-12">
      <div className="skeleton h-8 w-48" />
      {[0, 1].map((i) => (
        <div key={i} className="mt-6 rounded-2xl border border-border bg-surface-card p-5">
          <div className="skeleton h-4 w-32" />
          <div className="skeleton mt-4 h-11 w-full rounded-xl" />
          <div className="skeleton mt-3 h-11 w-full rounded-xl" />
        </div>
      ))}
      <div className="skeleton mt-6 h-12 w-full rounded-xl" />
    </LoadingRegion>
  )
}
