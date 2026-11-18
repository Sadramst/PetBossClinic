import * as React from "react"

import { cn } from "@/lib/utils"

const STAR = "M12 2.5l2.9 6.1 6.6.9-4.8 4.6 1.2 6.6L12 17.6l-5.9 3.1 1.2-6.6L2.5 9.5l6.6-.9L12 2.5z"

const SIZES = { sm: "h-3.5 w-3.5", md: "h-4.5 w-4.5", lg: "h-6 w-6" } as const

export interface RatingProps extends React.HTMLAttributes<HTMLDivElement> {
  /** 0 to `max`, fractions allowed (4.3 fills 30% of the fifth star). */
  value: number
  max?: number
  /** Number of reviews, shown in parentheses with Persian digits. */
  count?: number
  size?: keyof typeof SIZES
  /** Show the numeric value next to the stars. */
  showValue?: boolean
}

/** Read-only star rating with a Persian accessible label. */
export function Rating({ value, max = 5, count, size = "md", showValue, className, ...props }: RatingProps) {
  const safe = Math.max(0, Math.min(max, value || 0))
  const valueFa = safe.toLocaleString("fa-IR", { maximumFractionDigits: 1 })
  const label =
    `امتیاز ${valueFa} از ${max.toLocaleString("fa-IR")}` +
    (count !== undefined ? `، ${count.toLocaleString("fa-IR")} نظر` : "")
  return (
    <div role="img" aria-label={label} className={cn("inline-flex items-center gap-1.5", className)} {...props}>
      <span className="flex items-center gap-0.5" aria-hidden>
        {Array.from({ length: max }, (_, i) => {
          const fill = Math.max(0, Math.min(1, safe - i))
          return (
            <span key={i} className={cn("relative block", SIZES[size])}>
              <svg className="absolute inset-0 h-full w-full text-charcoal-500" viewBox="0 0 24 24" fill="currentColor">
                <path d={STAR} />
              </svg>
              {fill > 0 && (
                <span className="absolute inset-y-0 start-0 overflow-hidden" style={{ width: `${fill * 100}%` }}>
                  <svg className={cn("max-w-none text-primary", SIZES[size])} viewBox="0 0 24 24" fill="currentColor">
                    <path d={STAR} />
                  </svg>
                </span>
              )}
            </span>
          )
        })}
      </span>
      {showValue && <span className="text-xs font-bold" aria-hidden>{valueFa}</span>}
      {count !== undefined && (
        <span className="text-xs text-muted-foreground" aria-hidden>
          ({count.toLocaleString("fa-IR")})
        </span>
      )}
    </div>
  )
}
