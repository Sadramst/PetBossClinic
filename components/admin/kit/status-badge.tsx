import type { ReactNode } from 'react'
import { Badge, type BadgeTone } from '@/components/ui/badge'

export interface StatusBadgeProps {
  tone: BadgeTone
  children: ReactNode
  /** Small dot before the text. The text always carries the meaning, never colour alone. */
  dot?: boolean
  className?: string
  'data-testid'?: string
}

export function StatusBadge({ tone, children, dot = true, className, 'data-testid': testId }: StatusBadgeProps) {
  return (
    <Badge tone={tone} dot={dot} className={className} data-testid={testId}>
      {children}
    </Badge>
  )
}

// Local string unions: structurally identical to the Prisma enums, so they accept either.
export type LeadStageValue = 'NEW' | 'CONTACTED' | 'QUALIFIED' | 'APPOINTMENT_BOOKED' | 'WON' | 'LOST'
export type TicketStatusValue = 'OPEN' | 'PENDING' | 'RESOLVED' | 'CLOSED'
export type TaskStatusValue = 'OPEN' | 'IN_PROGRESS' | 'DONE' | 'CANCELLED'
export type LifecycleStageValue = 'SUBSCRIBER' | 'LEAD' | 'PROSPECT' | 'NEW_CUSTOMER' | 'ACTIVE' | 'AT_RISK' | 'LAPSED' | 'VIP' | 'BLOCKED'

export const LEAD_STAGE_FA: Record<LeadStageValue, string> = {
  NEW: 'جدید',
  CONTACTED: 'تماس گرفته شد',
  QUALIFIED: 'نیازسنجی شد',
  APPOINTMENT_BOOKED: 'نوبت ثبت شد',
  WON: 'تبدیل شد',
  LOST: 'از دست رفت',
}
const STAGE_TONE: Record<LeadStageValue, BadgeTone> = {
  NEW: 'gold',
  CONTACTED: 'info',
  QUALIFIED: 'info',
  APPOINTMENT_BOOKED: 'warning',
  WON: 'success',
  LOST: 'neutral',
}
export const TICKET_STATUS_FA: Record<TicketStatusValue, string> = {
  OPEN: 'باز',
  PENDING: 'منتظر پاسخ مشتری',
  RESOLVED: 'حل‌شده',
  CLOSED: 'بسته‌شده',
}
const TICKET_TONE: Record<TicketStatusValue, BadgeTone> = { OPEN: 'gold', PENDING: 'warning', RESOLVED: 'success', CLOSED: 'neutral' }
export const TASK_STATUS_FA: Record<TaskStatusValue, string> = {
  OPEN: 'باز',
  IN_PROGRESS: 'در حال انجام',
  DONE: 'انجام‌شده',
  CANCELLED: 'لغو شده',
}
const TASK_TONE: Record<TaskStatusValue, BadgeTone> = { OPEN: 'gold', IN_PROGRESS: 'info', DONE: 'success', CANCELLED: 'neutral' }
export const LIFECYCLE_FA: Record<LifecycleStageValue, string> = {
  SUBSCRIBER: 'مشترک',
  LEAD: 'سرنخ',
  PROSPECT: 'مشتری بالقوه',
  NEW_CUSTOMER: 'مشتری جدید',
  ACTIVE: 'فعال',
  AT_RISK: 'در معرض ریزش',
  LAPSED: 'غیرفعال',
  VIP: 'ویژه',
  BLOCKED: 'مسدود',
}
const LIFECYCLE_TONE: Record<LifecycleStageValue, BadgeTone> = {
  SUBSCRIBER: 'neutral',
  LEAD: 'gold',
  PROSPECT: 'info',
  NEW_CUSTOMER: 'info',
  ACTIVE: 'success',
  AT_RISK: 'warning',
  LAPSED: 'neutral',
  VIP: 'solid',
  BLOCKED: 'danger',
}
const CHURN: Record<string, { tone: BadgeTone; label: string }> = {
  LOW: { tone: 'success', label: 'ریسک کم' },
  MEDIUM: { tone: 'warning', label: 'ریسک متوسط' },
  HIGH: { tone: 'danger', label: 'ریسک بالا' },
}

export const stageBadge = (stage: LeadStageValue) => (
  <StatusBadge tone={STAGE_TONE[stage] ?? 'neutral'}>{LEAD_STAGE_FA[stage] ?? stage}</StatusBadge>
)
export const ticketBadge = (s: TicketStatusValue) => (
  <StatusBadge tone={TICKET_TONE[s] ?? 'neutral'}>{TICKET_STATUS_FA[s] ?? s}</StatusBadge>
)
export const taskBadge = (s: TaskStatusValue) => (
  <StatusBadge tone={TASK_TONE[s] ?? 'neutral'}>{TASK_STATUS_FA[s] ?? s}</StatusBadge>
)
export const lifecycleBadge = (s: LifecycleStageValue) => (
  <span data-testid="lifecycle-badge">
    <StatusBadge tone={LIFECYCLE_TONE[s] ?? 'neutral'}>{LIFECYCLE_FA[s] ?? s}</StatusBadge>
  </span>
)
export const churnBadge = (r: string) => {
  const c = CHURN[r] ?? { tone: 'neutral' as BadgeTone, label: 'نامشخص' }
  return (
    <span data-testid="churn-badge">
      <StatusBadge tone={c.tone}>{c.label}</StatusBadge>
    </span>
  )
}
