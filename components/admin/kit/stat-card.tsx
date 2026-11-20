import type { ReactNode } from 'react'
import { Link } from '@/i18n/routing'
import { cn } from '@/lib/utils'

export type StatTone = 'neutral' | 'gold' | 'ok' | 'warn' | 'danger'

export interface StatCardProps {
  label: string
  value: ReactNode
  hint?: ReactNode
  tone?: StatTone
  href?: string
  /** Highlights the card, e.g. when its filter is applied. */
  active?: boolean
  icon?: ReactNode
  /** Used for data-testid="stat-card-<statKey>". */
  statKey?: string
  className?: string
}

const TONE: Record<StatTone, string> = {
  neutral: 'border-border',
  gold: 'border-primary shadow-gold',
  ok: 'border-emerald-500/40',
  warn: 'border-amber-500/50',
  danger: 'border-red-500/50',
}
const ICON_TONE: Record<StatTone, string> = {
  neutral: 'border-border bg-surface text-primary',
  gold: 'border-border-gold bg-primary/15 text-primary',
  ok: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400',
  warn: 'border-amber-500/30 bg-amber-500/10 text-amber-400',
  danger: 'border-red-500/30 bg-red-500/10 text-red-400',
}

/** Number tile: a count, a one-line status, and an optional link to the filtered list. */
export function StatCard({ label, value, hint, tone = 'neutral', href, active, icon, statKey, className }: StatCardProps) {
  const body = (
    <>
      {icon && (
        <span aria-hidden className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border', ICON_TONE[tone])}>
          {icon}
        </span>
      )}
      <span className="min-w-0">
        <span className="block break-words text-lg font-black leading-8 sm:text-xl">{value}</span>
        <span className="block text-xs font-bold text-foreground/90">{label}</span>
        {hint && <span className="mt-0.5 block text-[11px] leading-5 text-muted-foreground">{hint}</span>}
      </span>
    </>
  )
  const cls = cn(
    'flex min-w-0 items-start gap-3 rounded-2xl border bg-surface-card p-4 transition-colors',
    TONE[tone],
    active && 'ring-2 ring-primary',
    href && 'hover:border-primary',
    className,
  )
  const testId = statKey ? `stat-card-${statKey}` : undefined
  return href ? (
    <Link href={href} className={cls} data-testid={testId} aria-current={active ? 'true' : undefined}>
      {body}
    </Link>
  ) : (
    <div className={cls} data-testid={testId}>
      {body}
    </div>
  )
}
