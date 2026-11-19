import { db } from '@/lib/db';
import { Link } from '@/i18n/routing';
import { requireAdmin } from '@/lib/auth/guard';
import { getLoyaltyConfig } from '@/lib/club/config';
import { listCampaigns } from '@/lib/club/campaigns';
import { senderStatus } from '@/lib/club/messaging/sender';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { formatJalaliDateTime, faNum } from '@/components/admin/format';
import { CampaignsShell } from '@/components/admin/club/campaigns-shell';
import { CAMPAIGN_STATUS } from '@/components/admin/club/status';

export const dynamic = 'force-dynamic';

export default async function AdminCampaignsPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<{ segment?: string }> }) {
  const { locale } = await params;
  await requireAdmin('EDITOR', locale);
  const sp = await searchParams;
  const [campaigns, segments, cfg] = await Promise.all([listCampaigns(60), db.segment.findMany({ select: { id: true, name: true }, orderBy: { name: 'asc' }, take: 100 }), getLoyaltyConfig()]);
  const status = senderStatus();

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      {status.message && <Alert tone="warning" title="سرویس پیامک متصل نیست">{status.message}</Alert>}
      <CampaignsShell segments={segments} tiers={cfg.tiers.map((t) => ({ key: t.key, label: t.label }))} initialSegmentId={sp.segment && segments.some((s) => s.id === sp.segment) ? sp.segment : undefined} />
      {campaigns.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">هنوز کمپینی نساخته‌اید.</p>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3" data-testid="campaigns-list">
          {campaigns.map((c) => {
            const st = CAMPAIGN_STATUS[c.status];
            return (
              <li key={c.id}>
                <Link href={`/admin/campaigns/${c.id}`} className="block h-full min-w-0 rounded-2xl border border-border bg-surface-card p-4 transition-colors hover:border-primary">
                  <div className="flex items-start justify-between gap-2">
                    <h2 className="min-w-0 break-words font-bold">{c.name}</h2>
                    <Badge tone={st.tone}>{st.label}</Badge>
                  </div>
                  <p className="mt-2 line-clamp-2 text-xs leading-6 text-muted-foreground">{c.body}</p>
                  <p className="mt-3 text-xs text-muted-foreground">
                    {faNum(c.recipientsCount)} مخاطب · {faNum(c.sentCount)} ارسال‌شده · {faNum(c.convertedCount)} خرید
                  </p>
                  <p className="mt-1 text-[11px] text-muted-foreground">{formatJalaliDateTime(c.createdAt)}</p>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
