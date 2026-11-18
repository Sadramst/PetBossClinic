import * as React from "react"

import { cn } from "@/lib/utils"

const SIZES = { sm: "h-4 w-4", md: "h-6 w-6", lg: "h-9 w-9" } as const

export interface SpinnerProps extends Omit<React.HTMLAttributes<HTMLSpanElement>, "children"> {
  size?: keyof typeof SIZES
  /** Screen-reader text. Pass `null` when the surrounding control is already labelled. */
  label?: string | null
}

/** Small circular progress indicator in the current text colour. */
export function Spinner({ size = "md", label = "در حال بارگذاری…", className, ...props }: SpinnerProps) {
  return (
    <span
      role={label ? "status" : undefined}
      aria-hidden={label ? undefined : true}
      className={cn("inline-flex", className)}
      {...props}
    >
      <svg className={cn("animate-spin", SIZES[size])} viewBox="0 0 24 24" fill="none" aria-hidden>
        <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="3" opacity="0.25" />
        <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
      </svg>
      {label && <span className="sr-only">{label}</span>}
    </span>
  )
}
