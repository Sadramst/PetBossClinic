import { requireAdmin } from '@/lib/auth/guard';
import { AUTOMATION_DEFAULTS, getAutomationRules, getAutomationStats } from '@/lib/club/automations';
import { normalizeCouponTemplate } from '@/lib/club/messaging/personalize';
import { senderStatus } from '@/lib/club/messaging/sender';
import { Alert } from '@/components/ui/alert';
import { formatJalaliDateTime } from '@/components/admin/format';
import { PageHeader } from '@/components/admin/kit';
import { AutomationsManager } from '@/components/admin/club/automations-manager';

export const dynamic = 'force-dynamic';

export default async function AdminAutomationsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  await requireAdmin('EDITOR', locale);
  const [rules, stats] = await Promise.all([getAutomationRules(), getAutomationStats()]);
  const status = senderStatus();
  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <PageHeader title="پیام‌های خودکار" breadcrumbs={[{ label: 'ارتباطات' }, { label: 'پیام‌های خودکار' }]} subtitle="هر قانون که روشن شود، سیستم هر ساعت مشتریان مناسب را پیدا می‌کند و پیام را در صف می‌گذارد. همه قوانین در ابتدا خاموش‌اند و فقط به مشتریانی که رضایت پیامک دارند ارسال می‌شود." />
      {status.message && <Alert tone="warning" title="سرویس پیامک متصل نیست">{status.message}</Alert>}
      <AutomationsManager
        rules={rules.map((r) => {
          const def = AUTOMATION_DEFAULTS[r.kind];
          const s = stats[r.kind];
          return {
            kind: r.kind,
            label: def.label,
            description: def.description,
            enabled: r.enabled,
            params: (r.params && typeof r.params === 'object' ? r.params : def.params) as Record<string, number>,
            paramLabels: def.paramLabels,
            body: r.bodyTemplate,
            coupon: normalizeCouponTemplate(r.couponTemplate),
            lastRun: s?.lastQueuedAt ? formatJalaliDateTime(s.lastQueuedAt) : null,
            queued7d: s?.queued7d ?? 0,
            sent7d: s?.sent7d ?? 0,
          };
        })}
      />
    </div>
  );
}
