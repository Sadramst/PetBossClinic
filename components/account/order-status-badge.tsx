import { Badge, type BadgeTone } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

/** Customer-facing wording and colour for each order status (one map for the list and the detail page). */
export const ORDER_STATUS_VIEW: Record<string, { label: string; tone: BadgeTone; className?: string }> = {
  PENDING_PAYMENT: { label: 'در انتظار پرداخت', tone: 'warning' },
  PAYMENT_FAILED: { label: 'پرداخت ناموفق', tone: 'danger' },
  CONFIRMED: { label: 'ثبت و تأیید شد', tone: 'info' },
  PROCESSING: { label: 'در حال آماده‌سازی', tone: 'gold' },
  SHIPPED: { label: 'ارسال شد', tone: 'info', className: 'border-violet-500/30 bg-violet-500/10 text-violet-300' },
  DELIVERED: { label: 'تحویل داده شد', tone: 'success' },
  CANCELLED: { label: 'لغو شد', tone: 'danger' },
};

export function OrderStatusBadge({ status, size = 'sm', className }: { status: string; size?: 'sm' | 'md'; className?: string }) {
  const view = ORDER_STATUS_VIEW[status] ?? { label: status, tone: 'neutral' as BadgeTone };
  return (
    <Badge tone={view.tone} size={size} dot className={cn(view.className, className)}>
      {view.label}
    </Badge>
  );
}
