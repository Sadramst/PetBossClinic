import type { OrderStatus, Role } from '@prisma/client'
import type { BadgeTone } from '@/components/ui/badge'

/** Shared by the admin orders UI and updateOrderAction (no server-only imports here). */

export const ORDER_STATUS_LABEL: Record<OrderStatus, string> = {
  PENDING_PAYMENT: 'در انتظار پرداخت',
  PAYMENT_FAILED: 'پرداخت ناموفق',
  CONFIRMED: 'تأییدشده',
  PROCESSING: 'در حال آماده‌سازی',
  SHIPPED: 'ارسال‌شده',
  DELIVERED: 'تحویل‌شده',
  CANCELLED: 'لغوشده',
}

export const ORDER_STATUS_TONE: Record<OrderStatus, BadgeTone> = {
  PENDING_PAYMENT: 'warning',
  PAYMENT_FAILED: 'danger',
  CONFIRMED: 'info',
  PROCESSING: 'gold',
  SHIPPED: 'info',
  DELIVERED: 'success',
  CANCELLED: 'neutral',
}

/** Normal life cycle of an order. */
const NEXT: Record<OrderStatus, OrderStatus[]> = {
  PENDING_PAYMENT: ['CONFIRMED', 'CANCELLED'],
  PAYMENT_FAILED: ['CONFIRMED', 'CANCELLED'],
  CONFIRMED: ['PROCESSING', 'SHIPPED', 'CANCELLED'],
  PROCESSING: ['SHIPPED', 'CANCELLED'],
  SHIPPED: ['DELIVERED', 'CANCELLED'],
  DELIVERED: [],
  CANCELLED: [],
}

/** Corrections only a manager may make (undo a wrong click). */
const REOPEN: Partial<Record<OrderStatus, OrderStatus[]>> = {
  DELIVERED: ['SHIPPED'],
  CANCELLED: ['CONFIRMED'],
  SHIPPED: ['PROCESSING'],
}

const isManager = (role: Role) => role === 'ADMIN' || role === 'SUPER_ADMIN'

/** Statuses an order in `from` may move to (excluding staying where it is). */
export function allowedNextStatuses(from: OrderStatus, role: Role): OrderStatus[] {
  return [...NEXT[from], ...(isManager(role) ? REOPEN[from] ?? [] : [])]
}

export function canTransition(from: OrderStatus, to: OrderStatus, role: Role): boolean {
  return from === to || allowedNextStatuses(from, role).includes(to)
}

/** The single most natural next step, offered as a quick-action button. */
export const QUICK_ACTION: Partial<Record<OrderStatus, { to: OrderStatus; label: string }>> = {
  CONFIRMED: { to: 'PROCESSING', label: 'شروع آماده‌سازی' },
  PROCESSING: { to: 'SHIPPED', label: 'ثبت ارسال' },
  SHIPPED: { to: 'DELIVERED', label: 'تحویل شد' },
}

/** 09xxxxxxxxx -> 989xxxxxxxxx for wa.me links. */
export function waNumber(phone: string): string {
  const digits = phone.replace(/\D/g, '')
  if (digits.startsWith('98')) return digits
  if (digits.startsWith('0')) return `98${digits.slice(1)}`
  return `98${digits}`
}

/** Persian status message a staff member can send to the customer. */
export function customerStatusMessage(o: { number: string; status: OrderStatus; shipName: string; trackingCode?: string | null }): string {
  const lines: Record<OrderStatus, string> = {
    PENDING_PAYMENT: 'سفارش شما ثبت شده و در انتظار پرداخت است.',
    PAYMENT_FAILED: 'پرداخت سفارش شما ناموفق بود. برای تکمیل خرید می‌توانید دوباره پرداخت کنید یا با ما تماس بگیرید.',
    CONFIRMED: 'سفارش شما تأیید شد و به‌زودی آماده‌سازی می‌شود.',
    PROCESSING: 'سفارش شما در حال آماده‌سازی و بسته‌بندی است.',
    SHIPPED: 'سفارش شما ارسال شد.',
    DELIVERED: 'سفارش شما تحویل داده شد. از خرید شما سپاسگزاریم.',
    CANCELLED: 'سفارش شما لغو شد. در صورت پرداخت، مبلغ به حساب شما بازگردانده می‌شود.',
  }
  return [
    `${o.shipName} عزیز، سلام.`,
    `سفارش ${o.number} در پت‌باس: ${lines[o.status]}`,
    o.trackingCode && (o.status === 'SHIPPED' || o.status === 'DELIVERED') ? `کد رهگیری: ${o.trackingCode}` : null,
    'کلینیک و پت‌شاپ پت‌باس',
  ]
    .filter(Boolean)
    .join('\n')
}
