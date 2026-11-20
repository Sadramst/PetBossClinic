import { Badge } from '@/components/ui/badge'
import { formatJalaliDate, type ExpiryState } from '@/lib/shop/expiry'
import { EXPIRY_LABEL_FA, EXPIRY_TONE } from '@/lib/shop/expiry-labels'
import { faNum } from '@/components/admin/format'

export interface ExpiryBadgeProps {
  state: ExpiryState
  daysLeft?: number | null
  date?: Date | null
  size?: 'sm' | 'md'
  /** Appends the Jalali date after the label. */
  showDate?: boolean
  className?: string
}

function daysText(state: ExpiryState, days: number | null | undefined): string {
  if (days === null || days === undefined || !Number.isFinite(days)) return ''
  if (days === 0) return 'امروز'
  return state === 'expired' ? `${faNum(Math.abs(days))} روز پیش` : `${faNum(days)} روز مانده`
}

/** One badge for every expiry state. The label is text, so it never relies on colour alone. */
export function ExpiryBadge({ state, daysLeft, date, size = 'sm', showDate, className }: ExpiryBadgeProps) {
  const extra = state === 'none' || state === 'ok' ? '' : daysText(state, daysLeft)
  const dateText = showDate && date ? formatJalaliDate(date, 'numeric') : ''
  return (
    <Badge tone={EXPIRY_TONE[state]} size={size} dot data-testid="expiry-badge" data-state={state} className={className}>
      <span>{EXPIRY_LABEL_FA[state]}</span>
      {extra && <span className="font-medium opacity-80">· {extra}</span>}
      {dateText && <span className="ltr-nums font-medium opacity-80">· {dateText}</span>}
    </Badge>
  )
}
