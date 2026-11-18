"use client"

import * as React from "react"

import { cn } from "@/lib/utils"

let scrollLocks = 0

function lockScroll() {
  scrollLocks += 1
  if (scrollLocks === 1) document.documentElement.style.overflow = "hidden"
}

function unlockScroll() {
  scrollLocks = Math.max(0, scrollLocks - 1)
  if (scrollLocks === 0) document.documentElement.style.overflow = ""
}

/**
 * Drives a native <dialog> with showModal(): the browser provides the focus
 * trap, Esc handling, inert background and focus restoration on close.
 */
export function useModalDialog(open: boolean, onClose: () => void, dismissible = true) {
  const ref = React.useRef<HTMLDialogElement>(null)
  const onCloseRef = React.useRef(onClose)
  const openRef = React.useRef(open)
  React.useEffect(() => {
    onCloseRef.current = onClose
    openRef.current = open
  })

  React.useEffect(() => {
    const el = ref.current
    if (!el || !open) return
    if (!el.open) el.showModal()
    el.querySelector<HTMLElement>("[data-autofocus]")?.focus()
    lockScroll()
    return () => {
      unlockScroll()
      if (el.open) el.close()
    }
  }, [open])

  const handlers = {
    /** Esc key. */
    onCancel: (e: React.SyntheticEvent<HTMLDialogElement>) => {
      e.preventDefault()
      if (dismissible) onCloseRef.current()
    },
    /** The browser closed the dialog by itself (e.g. a second Esc press): keep state in sync. */
    onClose: () => {
      if (openRef.current) onCloseRef.current()
    },
    /** Click on the backdrop (the dialog element itself, outside the panel). */
    onMouseDown: (e: React.MouseEvent<HTMLDialogElement>) => {
      if (dismissible && e.target === e.currentTarget) onCloseRef.current()
    },
  }

  return { ref, handlers }
}

export function CloseButton({ onClick, label = "بستن", className }: { onClick: () => void; label?: string; className?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className={cn(
        "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-muted-foreground transition-colors hover:bg-surface-elevated hover:text-foreground",
        className
      )}
    >
      <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
        <path d="M6 6l12 12M18 6 6 18" />
      </svg>
    </button>
  )
}

const WIDTHS = { sm: "max-w-sm", md: "max-w-md", lg: "max-w-2xl" } as const

export interface DialogProps {
  open: boolean
  /** Called on Esc, backdrop click and the close button. */
  onClose: () => void
  title: React.ReactNode
  description?: React.ReactNode
  children?: React.ReactNode
  /** Action row pinned to the bottom (buttons). */
  footer?: React.ReactNode
  size?: keyof typeof WIDTHS
  /** When false, Esc/backdrop do nothing and the close button is hidden (e.g. while saving). */
  dismissible?: boolean
  className?: string
}

/** Centered modal. Content is only mounted while open. */
export function Dialog({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = "md",
  dismissible = true,
  className,
}: DialogProps) {
  const { ref, handlers } = useModalDialog(open, onClose, dismissible)
  const titleId = React.useId()
  const descId = React.useId()

  return (
    <dialog
      ref={ref}
      aria-modal="true"
      aria-labelledby={titleId}
      aria-describedby={description ? descId : undefined}
      className={cn(
        "m-auto w-[calc(100%-2rem)] overflow-visible bg-transparent p-0 text-foreground",
        WIDTHS[size]
      )}
      {...handlers}
    >
      {open && (
        <div
          className={cn(
            "animate-rise-in flex max-h-[85dvh] flex-col rounded-2xl border border-border bg-surface-card shadow-2xl",
            className
          )}
        >
          <div className="flex items-start justify-between gap-3 p-5 pb-3">
            <div className="min-w-0">
              <h2 id={titleId} className="text-base font-extrabold sm:text-lg">
                {title}
              </h2>
              {description && (
                <p id={descId} className="mt-1.5 text-sm leading-7 text-muted-foreground">
                  {description}
                </p>
              )}
            </div>
            {dismissible && <CloseButton onClick={onClose} className="-me-2 -mt-1.5" />}
          </div>
          {children && <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-5">{children}</div>}
          {footer && (
            <div className="flex flex-col-reverse gap-2 border-t border-border p-4 sm:flex-row sm:justify-end">
              {footer}
            </div>
          )}
        </div>
      )}
    </dialog>
  )
}
