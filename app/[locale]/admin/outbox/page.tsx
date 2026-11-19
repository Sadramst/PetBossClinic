import { db } from '@/lib/db';
import { Link } from '@/i18n/routing';
import { requireAdmin } from '@/lib/auth/guard';
import { listOutbox, outboxCounts } from '@/lib/club/messaging/outbox';
import { senderStatus } from '@/lib/club/messaging/sender';
import { Alert } from '@/components/ui/alert';
import { Pagination } from '@/components/ui/pagination';
import { faNum, formatJalaliDateTime } from '@/components/admin/format';
import { OutboxManager } from '@/components/admin/club/outbox-manager';
import { MESSAGE_KIND, MESSAGE_STATUS } from '@/components/admin/club/status';

export const dynamic = 'force-dynamic';

type SP = { status?: string; kind?: string; page?: string };
const STATUSES = ['QUEUED', 'SENDING', 'SENT', 'FAILED', 'SKIPPED', 'CANCELLED'] as const;

export default async function AdminOutboxPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<SP> }) {
  const { locale } = await params;
  await requireAdmin('EDITOR', locale);
  const sp = await searchParams;
  const status = (STATUSES as readonly string[]).includes(sp.status ?? '') ? (sp.status as (typeof STATUSES)[number]) : undefined;
  const kind = sp.kind && sp.kind in MESSAGE_KIND ? sp.kind : undefined;
  const page = Math.max(1, Number.parseInt(sp.page ?? '1', 10) || 1);
  const [list, counts] = await Promise.all([listOutbox({ status, kind, page, pageSize: 30 }), outboxCounts()]);
  const sender = senderStatus();
  const names = new Map(
    (await db.customer.findMany({ where: { id: { in: list.rows.map((r) => r.customerId).filter((x): x is string => !!x) } }, select: { id: true, firstName: true, lastName: true } })).map((c) => [c.id, [c.firstName, c.lastName].filter(Boolean).join(' ') || 'بدون نام'])
  );
  const qs = (over: Record<string, string | undefined>) => {
    const p = new URLSearchParams();
    const m = { status, kind, ...over };
    for (const [k, v] of Object.entries(m)) if (v) p.set(k, v);
    const s = p.toString();
    return `/admin/outbox${s ? `?${s}` : ''}`;
  };

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <div>
        <h1 className="text-xl font-extrabold">صف پیامک‌ها</h1>
        <p className="mt-1 text-sm text-muted-foreground">همه پیام‌های کمپین، خودکار و دستی اینجا ثبت می‌شوند. ارسال هر ساعت خودکار انجام می‌شود.</p>
      </div>
      {sender.message && !sender.configured && (
        <Alert tone="warning" title="در انتظار اتصال سرویس پیامک" data-testid="sender-banner">
          {sender.message} پیام‌ها در صف می‌مانند و هیچ‌کدام از بین نمی‌روند.
        </Alert>
      )}
      {sender.message && sender.configured && (
        <Alert tone="info" title="حالت آزمایشی پیامک" data-testid="sender-console-note">
          {sender.message}
        </Alert>
      )}
      <div className="flex flex-wrap gap-2" role="group" aria-label="فیلتر وضعیت">
        <Link href={qs({ status: undefined, page: undefined })} className={`btn btn-sm ${!status ? 'btn-gold' : 'btn-ghost'}`}>همه</Link>
        {STATUSES.map((s) => (
          <Link key={s} href={qs({ status: s, page: undefined })} className={`btn btn-sm ${status === s ? 'btn-gold' : 'btn-ghost'}`}>
            {MESSAGE_STATUS[s].label} ({faNum(counts[s])})
          </Link>
        ))}
      </div>
      <div className="flex flex-wrap gap-2 text-xs" role="group" aria-label="فیلتر نوع">
        <Link href={qs({ kind: undefined, page: undefined })} className={`rounded-full border px-3 py-1 ${!kind ? 'border-primary text-primary' : 'border-border'}`}>همه نوع‌ها</Link>
        {Object.entries(MESSAGE_KIND).map(([k, l]) => (
          <Link key={k} href={qs({ kind: k, page: undefined })} className={`rounded-full border px-3 py-1 ${kind === k ? 'border-primary text-primary' : 'border-border'}`}>{l}</Link>
        ))}
      </div>
      <OutboxManager
        configured={sender.configured}
        queued={counts.QUEUED}
        rows={list.rows.map((m) => ({
          id: m.id,
          customerId: m.customerId,
          name: m.customerId ? names.get(m.customerId) ?? '—' : '—',
          phone: m.phone,
          kind: MESSAGE_KIND[m.kind] ?? m.kind,
          status: m.status,
          body: m.body,
          error: m.error ?? '',
          attempts: m.attempts,
          when: formatJalaliDateTime(m.sentAt ?? m.scheduledFor),
        }))}
      />
      <Pagination page={list.page} pageCount={list.pages} hrefFor={(p) => qs({ page: p > 1 ? String(p) : undefined })} />
    </div>
  );
}
