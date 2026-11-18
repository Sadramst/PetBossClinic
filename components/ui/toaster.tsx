"use client"

import * as React from "react"

import { cn } from "@/lib/utils"
import { mountOnce } from "./portal-host"

export type ToastTone = "success" | "error" | "info"

export interface ToastOptions {
  title: React.ReactNode
  description?: React.ReactNode
  tone?: ToastTone
  /** Milliseconds before auto-dismiss (default 4000, errors 6000). 0 keeps it until closed. */
  duration?: number
}

interface ToastItem extends ToastOptions {
  id: number
  tone: ToastTone
  duration: number
}

/* ── Tiny module-level store: no provider required ── */
let items: ToastItem[] = []
let nextId = 1
const listeners = new Set<() => void>()
const EMPTY: ToastItem[] = []

function emit() {
  listeners.forEach((l) => l())
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

function dismiss(id?: number) {
  items = id === undefined ? [] : items.filter((t) => t.id !== id)
  emit()
}

function show(options: ToastOptions | string): number {
  if (typeof window === "undefined") return 0
  const opts: ToastOptions = typeof options === "string" ? { title: options } : options
  const tone = opts.tone ?? "info"
  const item: ToastItem = {
    ...opts,
    id: nextId++,
    tone,
    duration: opts.duration ?? (tone === "error" ? 6000 : 4000),
  }
  // Keep at most three on screen.
  items = [...items, item].slice(-3)
  if (listeners.size === 0) mountOnce("toaster", <Toaster />)
  emit()
  return item.id
}

type Message = React.ReactNode

/**
 * Imperative toast API, usable from any client code:
 *   toast.success('آدرس ذخیره شد')
 *   toast.error('حذف انجام نشد', 'دوباره تلاش کنید')
 */
export const toast = Object.assign(show, {
  success: (title: Message, description?: Message) => show({ title, description, tone: "success" }),
  error: (title: Message, description?: Message) => show({ title, description, tone: "error" }),
  info: (title: Message, description?: Message) => show({ title, description, tone: "info" }),
  dismiss,
})

/** Hook form: `const toast = useToast(); toast.success('ذخیره شد')`. */
export function useToast() {
  return toast
}

const TONES: Record<ToastTone, { box: string; icon: string; path: string }> = {
  success: { box: "border-emerald-500/40", icon: "bg-emerald-500/15 text-emerald-400", path: "M20 6 9 17l-5-5" },
  error: { box: "border-red-500/40", icon: "bg-red-500/15 text-red-400", path: "M12 7v6m0 3.5v.5" },
  info: { box: "border-border-gold", icon: "bg-primary/15 text-primary", path: "M12 11v6m0-9.5v.5" },
}

function ToastCard({ item }: { item: ToastItem }) {
  const [paused, setPaused] = React.useState(false)

  React.useEffect(() => {
    if (!item.duration || paused) return
    const timer = window.setTimeout(() => dismiss(item.id), item.duration)
    return () => window.clearTimeout(timer)
  }, [item.id, item.duration, paused])

  const t = TONES[item.tone]
  return (
    <div
      role={item.tone === "error" ? "alert" : "status"}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
      className={cn(
        "animate-rise-in pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-2xl border bg-surface-elevated p-3 ps-3.5 shadow-2xl",
        t.box
      )}
    >
      <span aria-hidden className={cn("mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full", t.icon)}>
        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
          <path d={t.path} />
        </svg>
      </span>
      <div className="min-w-0 flex-1 py-0.5 text-sm">
        <p className="font-bold">{item.title}</p>
        {item.description && <p className="mt-0.5 text-xs text-muted-foreground">{item.description}</p>}
      </div>
      <button
        type="button"
        onClick={() => dismiss(item.id)}
        aria-label="بستن پیام"
        className="-m-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:bg-surface-hover hover:text-foreground"
      >
        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
          <path d="M6 6l12 12M18 6 6 18" />
        </svg>
      </button>
    </div>
  )
}

/**
 * Toast viewport. Optional: `toast()` mounts one automatically when none
 * exists. Mount it in a layout only if you want it inside that React tree.
 * Sits above the mobile bottom nav and is centred on every screen size.
 */
export function Toaster() {
  const list = React.useSyncExternalStore(
    subscribe,
    () => items,
    () => EMPTY
  )
  return (
    <div
      aria-label="اعلان‌ها"
      className="pointer-events-none fixed inset-x-0 bottom-20 z-[70] flex flex-col items-center gap-2 px-4 lg:bottom-6"
    >
      {list.map((item) => (
        <ToastCard key={item.id} item={item} />
      ))}
    </div>
  )
}

/** Convenience wrapper for layouts: renders children plus one Toaster. */
export function ToastProvider({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <Toaster />
    </>
  )
}
