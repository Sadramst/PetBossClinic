"use client"

import * as React from "react"

import { cn } from "@/lib/utils"

export interface TabItem {
  id: string
  label: React.ReactNode
  /** Panel content. All panels stay in the DOM (hidden) so their text remains crawlable. */
  content: React.ReactNode
  /** Small counter after the label, shown in Persian digits. */
  count?: number
  disabled?: boolean
}

export interface TabsProps {
  tabs: TabItem[]
  /** Controlled active tab id. */
  value?: string
  defaultValue?: string
  onValueChange?: (id: string) => void
  /** Accessible name of the tab list. */
  label: string
  variant?: "underline" | "pills"
  className?: string
  panelClassName?: string
}

/** Accessible tabs (WAI-ARIA pattern): arrow keys move, Home/End jump, RTL-aware. */
export function Tabs({
  tabs,
  value,
  defaultValue,
  onValueChange,
  label,
  variant = "underline",
  className,
  panelClassName,
}: TabsProps) {
  const baseId = React.useId()
  const [inner, setInner] = React.useState(defaultValue ?? tabs[0]?.id)
  const active = value ?? inner
  const refs = React.useRef<Record<string, HTMLButtonElement | null>>({})

  const select = (id: string) => {
    if (value === undefined) setInner(id)
    onValueChange?.(id)
  }

  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const enabled = tabs.filter((t) => !t.disabled)
    const index = enabled.findIndex((t) => t.id === active)
    if (index < 0) return
    const rtl = getComputedStyle(e.currentTarget).direction === "rtl"
    let next = index
    if (e.key === "ArrowLeft") next = index + (rtl ? 1 : -1)
    else if (e.key === "ArrowRight") next = index + (rtl ? -1 : 1)
    else if (e.key === "Home") next = 0
    else if (e.key === "End") next = enabled.length - 1
    else return
    e.preventDefault()
    const target = enabled[(next + enabled.length) % enabled.length]
    select(target.id)
    refs.current[target.id]?.focus()
  }

  return (
    <div className={className}>
      <div
        role="tablist"
        aria-label={label}
        onKeyDown={onKeyDown}
        className={cn(
          "scrollbar-none flex overflow-x-auto",
          variant === "underline" ? "gap-1 border-b border-border" : "gap-2"
        )}
      >
        {tabs.map((tab) => {
          const selected = tab.id === active
          return (
            <button
              key={tab.id}
              ref={(el) => {
                refs.current[tab.id] = el
              }}
              type="button"
              role="tab"
              id={`${baseId}-tab-${tab.id}`}
              aria-selected={selected}
              aria-controls={`${baseId}-panel-${tab.id}`}
              tabIndex={selected ? 0 : -1}
              disabled={tab.disabled}
              onClick={() => select(tab.id)}
              className={cn(
                "inline-flex min-h-11 shrink-0 items-center gap-1.5 whitespace-nowrap px-4 text-sm font-bold transition-colors disabled:opacity-40",
                variant === "underline"
                  ? cn(
                      "-mb-px border-b-2",
                      selected ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
                    )
                  : cn(
                      "rounded-full border",
                      selected
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border bg-surface-card text-muted-foreground hover:border-border-gold hover:text-foreground"
                    )
              )}
            >
              {tab.label}
              {tab.count !== undefined && (
                <span className="rounded-full bg-surface-elevated px-1.5 text-[11px] font-bold text-muted-foreground">
                  {tab.count.toLocaleString("fa-IR")}
                </span>
              )}
            </button>
          )
        })}
      </div>
      {tabs.map((tab) => (
        <div
          key={tab.id}
          role="tabpanel"
          id={`${baseId}-panel-${tab.id}`}
          aria-labelledby={`${baseId}-tab-${tab.id}`}
          hidden={tab.id !== active}
          tabIndex={0}
          className={cn("pt-5", panelClassName)}
        >
          {tab.content}
        </div>
      ))}
    </div>
  )
}
