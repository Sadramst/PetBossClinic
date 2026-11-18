import * as React from "react"

import { cn } from "@/lib/utils"

const fa = (n: number) => n.toLocaleString("fa-IR")

/** Whole-percent discount between a compare-at price and the current price (0 when none). */
export function discountPercent(price: number | null | undefined, compareAt: number | null | undefined): number {
  if (!price || !compareAt || price <= 0 || compareAt <= price) return 0
  return Math.round(((compareAt - price) / compareAt) * 100)
}

const SIZES = {
  sm: { price: "text-sm", unit: "text-[10px]", compare: "text-[11px]" },
  md: { price: "text-base", unit: "text-xs", compare: "text-xs" },
  lg: { price: "text-2xl sm:text-3xl", unit: "text-sm", compare: "text-sm" },
} as const

export interface PriceTagProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Current price in Toman. null/0 renders the "call" label. */
  price: number | null | undefined
  /** Original price in Toman; shown struck through when higher than `price`. */
  compareAt?: number | null
  size?: keyof typeof SIZES
  /** Show the red "٪۲۰" chip when there is a discount (default true). */
  showDiscount?: boolean
  /** Stack compare-at above the price (cards) or keep everything on one line. */
  layout?: "stacked" | "inline"
  /** Text when there is no price. */
  emptyLabel?: string
}

/**
 * Price in Toman with Persian digits. The amount keeps the `.text-gradient-gold`
 * class used across the shop (and asserted by e2e tests on product cards).
 */
export function PriceTag({
  price,
  compareAt,
  size = "md",
  showDiscount = true,
  layout = "stacked",
  emptyLabel = "تماس بگیرید",
  className,
  ...props
}: PriceTagProps) {
  const s = SIZES[size]
  if (!price || price <= 0) {
    return (
      <div className={cn("font-bold text-muted-foreground", s.price, className)} {...props}>
        {emptyLabel}
      </div>
    )
  }
  const off = discountPercent(price, compareAt)
  return (
    <div
      className={cn(
        "flex",
        layout === "stacked" ? "flex-col items-start gap-0.5" : "flex-wrap items-center gap-x-2 gap-y-0.5",
        className
      )}
      {...props}
    >
      {off > 0 && compareAt && (
        <span className="flex items-center gap-1.5">
          <s className={cn("text-muted-foreground decoration-muted-foreground/70", s.compare)}>
            <span className="sr-only">قیمت قبلی: </span>
            {fa(compareAt)}
          </s>
          {showDiscount && (
            <span className="inline-flex h-5 items-center rounded-full bg-red-500 px-1.5 text-[11px] font-extrabold leading-none text-white">
              <span className="sr-only">تخفیف </span>
              {fa(off)}٪
            </span>
          )}
        </span>
      )}
      <span className="flex items-baseline gap-1">
        <span className={cn("font-extrabold text-gradient-gold", s.price)}>{fa(price)}</span>
        <span className={cn("font-medium text-muted-foreground", s.unit)}>تومان</span>
      </span>
    </div>
  )
}
