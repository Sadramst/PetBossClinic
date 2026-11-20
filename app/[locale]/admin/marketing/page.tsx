import { Link } from '@/i18n/routing'
import { requireAdmin } from '@/lib/auth/guard'
import { getMarketingConfig } from '@/lib/marketing/config'
import { couponFormOptions, listContacts, listCoupons, listGroups, marketingReport } from '@/lib/marketing/admin-queries'
import { toTehranLocalInput } from '@/lib/marketing/admin-validators'
import { CouponsManager } from '@/components/admin/marketing/coupons-manager'
import { GroupsManager } from '@/components/admin/marketing/groups-manager'
import { ContactsManager } from '@/components/admin/marketing/contacts-manager'
import { ConfigForm } from '@/components/admin/marketing/config-form'
import { ReportView } from '@/components/admin/marketing/report-view'
import { Alert } from '@/components/ui/alert'
import { PageHeader } from '@/components/admin/kit'

export const dynamic = 'force-dynamic'

const TABS = [
  { id: 'coupons', label: 'کدهای تخفیف' },
  { id: 'groups', label: 'گروه‌های مشتریان' },
  { id: 'contacts', label: 'مخاطبان' },
  { id: 'config', label: 'تنظیمات کمپین' },
  { id: 'report', label: 'گزارش' },
] as const

type TabId = (typeof TABS)[number]['id']
type SP = { tab?: string; q?: string; status?: string; type?: string; source?: string; page?: string }

export default async function AdminMarketingPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<SP> }) {
  const { locale } = await params
  // Campaign data includes phone numbers and emails of leads: staff only, like orders.
  await requireAdmin('ADMIN', locale)
  const sp = await searchParams
  const tab: TabId = TABS.some((t) => t.id === sp.tab) ? (sp.tab as TabId) : 'coupons'
  const page = Math.max(1, Number.parseInt(sp.page ?? '1', 10) || 1)

  let content: React.ReactNode
  try {
    if (tab === 'coupons') {
      const [list, options] = await Promise.all([listCoupons({ q: sp.q, status: sp.status, type: sp.type, source: sp.source, page }), couponFormOptions()])
      content = (
        <CouponsManager
          rows={list.rows}
          total={list.total}
          page={list.page}
          pages={list.pages}
          options={options}
          filters={{ q: sp.q ?? '', status: sp.status ?? '', type: sp.type ?? '', source: sp.source ?? '' }}
        />
      )
    } else if (tab === 'groups') {
      content = <GroupsManager groups={await listGroups()} />
    } else if (tab === 'contacts') {
      const list = await listContacts({ q: sp.q, source: sp.source, page })
      content = <ContactsManager rows={list.rows} total={list.total} page={list.page} pages={list.pages} filters={{ q: sp.q ?? '', source: sp.source ?? '' }} />
    } else if (tab === 'config') {
      const c = await getMarketingConfig()
      content = (
        <ConfigForm
          initial={{
            popupEnabled: c.popupEnabled,
            popupTitle: c.popupTitle,
            popupText: c.popupText,
            popupDelaySeconds: c.popupDelaySeconds,
            welcomeEnabled: c.welcomeEnabled,
            welcomeType: c.welcomeType,
            welcomeValue: c.welcomeValue,
            welcomeMaxDiscount: c.welcomeMaxDiscount,
            welcomeMinSubtotal: c.welcomeMinSubtotal,
            welcomeValidDays: c.welcomeValidDays,
            bannerEnabled: c.bannerEnabled,
            bannerText: c.bannerText ?? '',
            bannerLink: c.bannerLink ?? '',
            bannerEndsAt: toTehranLocalInput(c.bannerEndsAt),
            bannerCouponCode: c.bannerCouponCode ?? '',
          }}
        />
      )
    } else {
      content = <ReportView r={await marketingReport()} />
    }
  } catch (e) {
    console.error('[admin/marketing] load failed', (e as Error)?.message)
    content = <Alert tone="error" title="بارگذاری انجام نشد">اطلاعات این بخش خوانده نشد. صفحه را دوباره باز کنید.</Alert>
  }

  return (
    <div className="space-y-5">
      <PageHeader title="بازاریابی و تخفیف‌ها" breadcrumbs={[{ label: 'کوپن و تخفیف' }]} subtitle="کد تخفیف، گروه مشتریان، مخاطبان جمع‌آوری‌شده و تنظیمات کمپین خوش‌آمد." />
      <nav aria-label="بخش‌های بازاریابی" className="-mx-1 flex gap-1 overflow-x-auto border-b border-border px-1" data-testid="marketing-tabs">
        {TABS.map((t) => (
          <Link
            key={t.id}
            href={`/admin/marketing?tab=${t.id}`}
            aria-current={t.id === tab ? 'page' : undefined}
            data-testid={`marketing-tab-${t.id}`}
            className={`inline-flex min-h-11 shrink-0 items-center border-b-2 px-3 text-sm font-bold transition-colors ${t.id === tab ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
          >
            {t.label}
          </Link>
        ))}
      </nav>
      {content}
    </div>
  )
}
