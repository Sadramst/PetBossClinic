import { notFound } from 'next/navigation';
import { Link } from '@/i18n/routing';
import { requireAdmin } from '@/lib/auth/guard';
import { getCampaign, getCampaignStats } from '@/lib/club/campaigns';
import { listOutbox } from '@/lib/club/messaging/outbox';
import { db } from '@/lib/db';
import { Badge } from '@/components/ui/badge';
import { Pagination } from '@/components/ui/pagination';
import { faNum, formatJalaliDateTime, toman } from '@/components/admin/format';
import { Card, Stat, TableWrap, td, th } from '@/components/admin/club/kit';
import { CAMPAIGN_STATUS, MESSAGE_STATUS } from '@/components/admin/club/status';
import { CancelCampaignButton } from '@/components/admin/club/cancel-campaign-button';

export const dynamic = 'force-dynamic';

export default async function AdminCampaignDetailPage({ params, searchParams }: { params: Promise<{ locale: string; id: string }>; searchParams: Promise<{ page?: string }> }) {
  const { locale, id } = await params;
  await requireAdmin('EDITOR', locale);
  const camp = await getCampaign(id);
  if (!camp) notFound();
  const page = Math.max(1, Number.parseInt((await searchParams).page ?? '1', 10) || 1);
  const [stats, list] = await Promise.all([getCampaignStats(id), listOutbox({ campaignId: id, page, pageSize: 30 })]);
  const names = new Map(
    (await db.customer.findMany({ where: { id: { in: list.rows.map((r) => r.customerId).filter((x): x is string => !!x) } }, select: { id: true, firstName: true, lastName: true } })).map((c) => [c.id, [c.firstName, c.lastName].filter(Boolean).join(' ') || 'بدون نام'])
  );
  const st = CAMPAIGN_STATUS[camp.status];
  const cancellable = camp.status === 'RUNNING' || camp.status === 'SCHEDULED' || stats.queued > 0;

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <nav aria-label="مسیر" className="text-xs text-muted-foreground">
        <Link href="/admin/campaigns" className="hover:text-primary">کمپین‌ها</Link> <span aria-hidden>/</span> {camp.name}
      </nav>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-extrabold">{camp.name}</h1>
            <Badge tone={st.tone}>{st.label}</Badge>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">ساخته‌شده در {formatJalaliDateTime(camp.createdAt)}{camp.scheduledFor ? ` · زمان‌بندی: ${formatJalaliDateTime(camp.scheduledFor)}` : ''}</p>
        </div>
        {cancellable && <CancelCampaignButton id={camp.id} />}
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4" data-testid="campaign-stats">
        <Stat label="مخاطبان" value={faNum(stats.recipients)} />
        <Stat label="ارسال‌شده" value={faNum(stats.sent)} hint={`در صف: ${faNum(stats.queued)}`} />
        <Stat label="ناموفق / ردشده" value={`${faNum(stats.failed)} / ${faNum(stats.skipped)}`} />
        <Stat label="منجر به خرید" value={faNum(stats.converted)} hint={`${faNum(stats.couponRedeemed)} با کد کمپین · ${toman(stats.revenue)}`} />
      </div>

      <Card title="متن پیام"><p className="whitespace-pre-wrap break-words text-sm leading-7">{camp.body}</p></Card>

      <TableWrap>
        <table className="w-full min-w-[36rem] text-sm" data-testid="campaign-outbox">
          <thead><tr className="border-b border-border">{['مشتری', 'شماره', 'وضعیت', 'زمان', 'پیام'].map((h) => <th key={h} className={th}>{h}</th>)}</tr></thead>
          <tbody className="divide-y divide-border">
            {list.rows.length === 0 && <tr><td colSpan={5} className="p-4 text-muted-foreground">پیامی در این کمپین ثبت نشده است.</td></tr>}
            {list.rows.map((m) => (
              <tr key={m.id}>
                <td className={td}>{m.customerId ? <Link href={`/admin/customers/${m.customerId}`} className="text-primary hover:underline">{names.get(m.customerId) ?? '—'}</Link> : '—'}</td>
                <td className={td} dir="ltr" style={{ textAlign: 'start' }}>{m.phone}</td>
                <td className={td}><Badge tone={MESSAGE_STATUS[m.status]?.tone ?? 'neutral'}>{MESSAGE_STATUS[m.status]?.label ?? m.status}</Badge></td>
                <td className={`${td} whitespace-nowrap`}>{formatJalaliDateTime(m.sentAt ?? m.scheduledFor)}</td>
                <td className={`${td} max-w-xs truncate`} title={m.body}>{m.error || m.body}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </TableWrap>
      <Pagination page={list.page} pageCount={list.pages} hrefFor={(p) => `/admin/campaigns/${id}${p > 1 ? `?page=${p}` : ''}`} />
    </div>
  );
}
