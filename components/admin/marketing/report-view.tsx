import type { MarketingReport } from '@/lib/marketing/admin-queries'
import { EmptyState } from '@/components/ui/empty-state'
import { faNum, toman } from '@/components/admin/format'

function Stat({ label, value, hint, id }: { label: string; value: string; hint?: string; id: string }) {
  return (
    <div className="rounded-2xl border border-border bg-surface-card p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-xl font-extrabold" data-testid={`stat-${id}`}>
        {value}
      </p>
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </div>
  )
}

const pct = (a: number, b: number) => (b > 0 ? `${faNum(Math.round((a / b) * 100))}٪` : '—')

export function ReportView({ r }: { r: MarketingReport }) {
  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat id="redemptions" label="دفعات استفاده از کد" value={faNum(r.redemptions)} hint={`${faNum(r.activeCoupons)} کد فعال`} />
        <Stat id="discount" label="مجموع تخفیف داده‌شده" value={toman(r.totalDiscount)} />
        <Stat id="revenue" label="فروش سفارش‌های دارای تخفیف" value={toman(r.discountedRevenue)} hint={`${faNum(r.discountedOrders)} سفارش تأییدشده`} />
        <Stat id="conversion" label="تبدیل مخاطب به خریدار" value={pct(r.converted, r.contactsTotal)} hint={`${faNum(r.converted)} از ${faNum(r.contactsTotal)} مخاطب`} />
        <Stat id="contacts7" label="مخاطب جدید، ۷ روز اخیر" value={faNum(r.contacts7)} />
        <Stat id="contacts30" label="مخاطب جدید، ۳۰ روز اخیر" value={faNum(r.contacts30)} />
        <Stat id="welcome-issued" label="کد خوش‌آمد صادرشده" value={faNum(r.welcomeIssued)} />
        <Stat id="welcome-used" label="کد خوش‌آمد استفاده‌شده" value={pct(r.welcomeUsed, r.welcomeIssued)} hint={`${faNum(r.welcomeUsed)} کد`} />
      </div>

      <section className="rounded-2xl border border-border bg-surface-card p-4" aria-labelledby="top-h">
        <h2 id="top-h" className="text-sm font-extrabold">
          پرمصرف‌ترین کدها
        </h2>
        {r.topCoupons.length === 0 ? (
          <EmptyState size="sm" title="هنوز کدی استفاده نشده" description="با اولین خرید دارای تخفیف، این فهرست پر می‌شود." />
        ) : (
          <ul className="mt-3 divide-y divide-border" data-testid="top-coupons">
            {r.topCoupons.map((t) => (
              <li key={t.code} className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-sm">
                <span className="min-w-0">
                  <span className="font-mono font-extrabold text-primary" dir="ltr">
                    {t.code}
                  </span>
                  <span className="ms-2 text-muted-foreground">{t.title}</span>
                </span>
                <span className="text-xs">
                  {faNum(t.uses)} بار · {toman(t.amount)} تخفیف
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
