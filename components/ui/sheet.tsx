"use client"

import * as React from "react"

import { cn } from "@/lib/utils"
import { CloseButton, useModalDialog } from "./dialog"

const SIDES = {
  /** Slides up from the bottom edge: mobile filters, sort, quick actions. */
  bottom: {
    dialog: "mx-auto mb-0 mt-auto w-full max-w-xl",
    panel: "max-h-[88dvh] rounded-t-3xl border-t pb-safe",
  },
  /** Inline-start edge (the right side in RTL): navigation menus. */
  start: {
    dialog: "me-auto ms-0 h-dvh w-[min(22rem,88vw)]",
    panel: "h-full border-e",
  },
  /** Inline-end edge (the left side in RTL): cart, details. */
  end: {
    dialog: "me-0 ms-auto h-dvh w-[min(22rem,88vw)]",
    panel: "h-full border-s",
  },
} as const

export interface SheetProps {
  open: boolean
  onClose: () => void
  title: React.ReactNode
  /** Hide the title visually (still announced). */
  hideTitle?: boolean
  side?: keyof typeof SIDES
  children: React.ReactNode
  /** Sticky action bar at the bottom, e.g. "نمایش نتایج". */
  footer?: React.ReactNode
  className?: string
}

/** Drawer built on native <dialog>: focus trap, Esc and backdrop close for free. */
export function Sheet({ open, onClose, title, hideTitle, side = "bottom", children, footer, className }: SheetProps) {
  const { ref, handlers } = useModalDialog(open, onClose)
  const titleId = React.useId()
  const s = SIDES[side]

  return (
    <dialog
      ref={ref}
      aria-modal="true"
      aria-labelledby={titleId}
      className={cn("max-h-none max-w-none overflow-visible bg-transparent p-0 text-foreground", s.dialog)}
      {...handlers}
    >
      {open && (
        <div className={cn("animate-rise-in flex flex-col border-border bg-surface shadow-2xl", s.panel, className)}>
          {side === "bottom" && <div aria-hidden className="mx-auto mt-2.5 h-1 w-10 shrink-0 rounded-full bg-surface-hover" />}
          <div className="flex shrink-0 items-center justify-between gap-3 border-b border-border px-4 py-2.5">
            <h2 id={titleId} className={cn("text-base font-extrabold", hideTitle && "sr-only")}>
              {title}
            </h2>
            <CloseButton onClick={onClose} className="-me-2 ms-auto" />
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4">{children}</div>
          {footer && <div className="shrink-0 border-t border-border p-4">{footer}</div>}
        </div>
      )}
    </dialog>
  )
}

/** Alias: a Sheet opened from the side. */
export const Drawer = Sheet
