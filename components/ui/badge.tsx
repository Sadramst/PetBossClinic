import * as React from "react"

import { cn } from "@/lib/utils"

export type BadgeTone = "neutral" | "gold" | "solid" | "success" | "warning" | "danger" | "info"

const TONES: Record<BadgeTone, string> = {
  neutral: "border-border bg-surface-elevated text-muted-foreground",
  gold: "border-border-gold bg-primary/10 text-primary",
  solid: "border-transparent bg-gradient-gold text-charcoal-950",
  success: "border-emerald-500/30 bg-emerald-500/10 text-emerald-400",
  warning: "border-amber-500/30 bg-amber-500/10 text-amber-400",
  danger: "border-red-500/30 bg-red-500/10 text-red-400",
  info: "border-sky-500/30 bg-sky-500/10 text-sky-400",
}

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  tone?: BadgeTone
  size?: "sm" | "md"
  /** Small coloured dot before the text (status lists). */
  dot?: boolean
}

/** Compact status label: stock state, order status, discount, "new". */
export function Badge({ tone = "neutral", size = "sm", dot, className, children, ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border font-bold leading-none",
        size === "sm" ? "h-6 px-2.5 text-[11px]" : "h-7 px-3 text-xs",
        TONES[tone],
        className
      )}
      {...props}
    >
      {dot && <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-current" />}
      {children}
    </span>
  )
}

/** Maps Prisma `StockStatus` values to a tone and Persian label. */
export const STOCK_BADGE: Record<string, { tone: BadgeTone; label: string }> = {
  IN_STOCK: { tone: "success", label: "موجود" },
  LOW_STOCK: { tone: "warning", label: "تعداد محدود" },
  OUT_OF_STOCK: { tone: "neutral", label: "ناموجود" },
  ON_BACKORDER: { tone: "info", label: "پیش‌سفارش" },
}

/** `<StockBadge status={product.stockStatus} />` */
export function StockBadge({ status, className }: { status: string; className?: string }) {
  const entry = STOCK_BADGE[status] ?? STOCK_BADGE.OUT_OF_STOCK
  return (
    <Badge tone={entry.tone} dot className={className}>
      {entry.label}
    </Badge>
  )
}
