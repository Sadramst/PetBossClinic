import { requireAdmin } from '@/lib/auth/guard'
import { PageHeader } from '@/components/admin/kit/page-header'
import { faNum, roleAtLeast } from '@/components/admin/format'
import { Link } from '@/i18n/routing'
import { REPORT_TABS, REPORT_TAB_LABEL, buildReport, rangeForDays, type ReportTab } from '@/lib/crm/reports'
import { ReportsExportButton } from '@/components/admin/crm/reports-export-button'

export const dynamic = 'force-dynamic'

const RANGES = [7, 30, 90, 365]

export default async function AdminReportsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>
  searchParams: Promise<{ tab?: string; days?: string }>
}) {
  const { locale } = await params
  const session = await requireAdmin('VIEWER', locale)
  const sp = await searchParams
  const tab: ReportTab = (REPORT_TABS as readonly string[]).includes(sp.tab ?? '') ? (sp.tab as ReportTab) : 'funnel'
  const d = Number.parseInt(sp.days ?? '30', 10)
  const days = RANGES.includes(d) ? d : 30
  const report = await buildReport(tab, rangeForDays(days))
  const cell = (v: string | number) => (typeof v === 'number' ? faNum(v) : v)
  return (
    <div className="space-y-5">
      <PageHeader
        title="گزارش‌ها"
        subtitle="قیف فروش، مشتریان، عملیات، پیام‌رسانی و انقضای کالا"
        breadcrumbs={[{ label: 'گزارش‌ها' }]}
        actions={roleAtLeast(session.role, 'ADMIN') ? <ReportsExportButton tab={tab} days={days} /> : undefined}
        tabs={{
          items: REPORT_TABS.map((t) => ({ id: t, label: REPORT_TAB_LABEL[t], href: `/admin/reports?tab=${t}&days=${days}` })),
          value: tab,
          testIdPrefix: 'report-tab',
        }}
      />
      {tab !== 'expiry' && (
        <div className="flex flex-wrap items-center gap-2 text-sm" data-testid="report-range">
          <span className="text-muted-foreground">بازه:</span>
          {RANGES.map((r) => (
            <Link
              key={r}
              href={`/admin/reports?tab=${tab}&days=${r}`}
              className={`rounded-full border px-3 py-1 ${r === days ? 'border-primary bg-primary/10 font-bold text-primary' : 'border-border text-muted-foreground'}`}
            >
              {faNum(r)} روز
            </Link>
          ))}
        </div>
      )}
      <div className="grid gap-4 lg:grid-cols-2">
        {report.sections.map((s) => (
          <section key={s.title} className="rounded-2xl border border-border bg-card p-4">
            <h2 className="mb-3 text-base font-bold">{s.title}</h2>
            {s.rows.length === 0 ? (
              <p className="text-sm text-muted-foreground">داده‌ای برای نمایش نیست.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-muted-foreground">
                      {s.head.map((h) => (
                        <th key={h} className="px-2 py-2 text-start font-bold">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {s.rows.map((r, i) => (
                      <tr key={i} className="border-b border-border/50 last:border-0">
                        {r.map((c, j) => (
                          <td key={j} className="px-2 py-2">
                            {cell(c)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        ))}
      </div>
    </div>
  )
}
