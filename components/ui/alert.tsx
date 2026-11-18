import * as React from "react"

import { cn } from "@/lib/utils"

export type AlertTone = "success" | "error" | "warning" | "info"

const TONES: Record<AlertTone, { box: string; icon: string; path: string }> = {
  success: {
    box: "border-emerald-500/30 bg-emerald-500/10",
    icon: "text-emerald-400",
    path: "M20 6 9 17l-5-5",
  },
  error: {
    box: "border-red-500/30 bg-red-500/10",
    icon: "text-red-400",
    path: "M12 8v5m0 3.5v.5M10.3 3.9 2.4 17.5A2 2 0 0 0 4.1 20.5h15.8a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z",
  },
  warning: {
    box: "border-amber-500/30 bg-amber-500/10",
    icon: "text-amber-400",
    path: "M12 8v5m0 3.5v.5M10.3 3.9 2.4 17.5A2 2 0 0 0 4.1 20.5h15.8a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z",
  },
  info: {
    box: "border-border-gold bg-primary/10",
    icon: "text-primary",
    path: "M12 11v6m0-9.5v.5M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z",
  },
}

// ComponentProps (not HTMLAttributes) so `ref` is accepted: in React 19 it is an ordinary prop.
export interface AlertProps extends Omit<React.ComponentProps<"div">, "title"> {
  tone?: AlertTone
  title?: React.ReactNode
  /** Buttons or links shown under the message. */
  action?: React.ReactNode
}

/**
 * Inline message block. `error` and `warning` use role="alert" (announced
 * immediately); `success` and `info` use role="status".
 */
export function Alert({ tone = "info", title, action, className, children, role, ...props }: AlertProps) {
  const t = TONES[tone]
  return (
    <div
      role={role ?? (tone === "error" || tone === "warning" ? "alert" : "status")}
      className={cn("flex items-start gap-3 rounded-2xl border p-4 text-sm", t.box, className)}
      {...props}
    >
      <svg
        className={cn("mt-0.5 h-5 w-5 shrink-0", t.icon)}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      >
        <path d={t.path} />
      </svg>
      <div className="min-w-0 flex-1">
        {title && <p className="font-bold">{title}</p>}
        {children && <div className={cn("text-foreground/85", title ? "mt-1" : undefined)}>{children}</div>}
        {action && <div className="mt-3 flex flex-wrap gap-2">{action}</div>}
      </div>
    </div>
  )
}
