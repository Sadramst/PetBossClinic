'use client'

import { useState, useTransition } from 'react'
import { useRouter } from '@/i18n/routing'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import { Pagination } from '@/components/ui/pagination'
import { Input, Select } from '@/components/ui/input'
import { toast } from '@/components/ui/toaster'
import { exportContactsCsvAction, setContactUnsubscribedAction } from '@/app/actions/admin-marketing'
import type { ContactRow } from '@/lib/marketing/admin-queries'
import { faNum, formatJalaliDateTime } from '@/components/admin/format'
import { downloadText } from './download'

const SOURCE_LABEL: Record<string, string> = { popup: 'پنجره خوش‌آمد', footer: 'فوتر سایت', signup: 'ثبت‌نام', checkout: 'تسویه حساب', admin: 'ثبت دستی' }
const COUPON_LABEL = { none: 'بدون کد', unused: 'کد استفاده نشده', used: 'کد استفاده شد', expired: 'کد منقضی' } as const
const COUPON_TONE = { none: 'neutral', unused: 'info', used: 'success', expired: 'warning' } as const

export function ContactsManager({ rows, total, page, pages, filters }: { rows: ContactRow[]; total: number; page: number; pages: number; filters: { q: string; source: string } }) {
  const router = useRouter()
  const [q, setQ] = useState(filters.q)
  const [pending, start] = useTransition()

  const hrefFor = (over: Partial<typeof filters> & { page?: number }) => {
    const p = new URLSearchParams({ tab: 'contacts' })
    const f = { ...filters, ...over }
    if (f.q) p.set('q', f.q)
    if (f.source) p.set('source', f.source)
    if (over.page && over.page > 1) p.set('page', String(over.page))
    return `/admin/marketing?${p.toString()}`
  }

  const exportCsv = () =>
    start(async () => {
      const res = await exportContactsCsvAction({ q: filters.q, source: filters.source })
      if (!res.ok || !res.data) return void toast.error('خروجی ساخته نشد', res.error)
      downloadText('marketing-contacts.csv', res.data.csv)
      toast.success('فایل آماده شد', `${faNum(res.data.count)} مخاطب`)
    })

  const toggle = (c: ContactRow) =>
    start(async () => {
      const res = await setContactUnsubscribedAction(c.id, !c.unsubscribed)
      if (!res.ok) return void toast.error('انجام نشد', res.error)
      toast.success(c.unsubscribed ? 'مخاطب دوباره فعال شد' : 'مخاطب از لیست تبلیغات خارج شد')
      router.refresh()
    })

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          <span data-testid="contacts-total">{faNum(total)}</span> مخاطب
        </p>
        <Button variant="secondary" loading={pending} onClick={exportCsv} data-testid="contacts-export">
          خروجی CSV
        </Button>
      </div>

      <form
        className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_12rem_auto]"
        role="search"
        onSubmit={(e) => {
          e.preventDefault()
          router.push(hrefFor({ q, page: 1 }))
        }}
      >
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="جستجوی موبایل، ایمیل یا نام" aria-label="جستجوی مخاطب" data-testid="contacts-search" />
        <Select aria-label="منبع" value={filters.source} onChange={(e) => router.push(hrefFor({ source: e.target.value, page: 1 }))}>
          <option value="">همه منابع</option>
          {Object.entries(SOURCE_LABEL).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </Select>
        <Button type="submit" variant="secondary">
          جستجو
        </Button>
      </form>

      {rows.length === 0 ? (
        <EmptyState variant="card" title="مخاطبی پیدا نشد" description="وقتی بازدیدکنندگان شماره یا ایمیل خود را در پنجره خوش‌آمد یا فوتر ثبت کنند، اینجا می‌بینید." />
      ) : (
        <>
          <div className="hidden overflow-hidden rounded-2xl border border-border bg-surface-card md:block">
            <table className="w-full text-sm" data-testid="contacts-table">
              <thead className="border-b border-border bg-surface-elevated text-xs text-muted-foreground">
                <tr>
                  <th className="px-3 py-3 text-start font-semibold">مخاطب</th>
                  <th className="px-3 py-3 text-start font-semibold">منبع</th>
                  <th className="px-3 py-3 text-start font-semibold">تاریخ</th>
                  <th className="px-3 py-3 text-start font-semibold">کد خوش‌آمد</th>
                  <th className="px-3 py-3 text-start font-semibold">عملیات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {rows.map((c) => (
                  <tr key={c.id} data-testid="contact-row">
                    <td className="px-3 py-3">
                      <p dir="ltr" className="text-start font-semibold">
                        {c.phone ?? c.email}
                      </p>
                      {c.phone && c.email && (
                        <p dir="ltr" className="text-start text-xs text-muted-foreground">
                          {c.email}
                        </p>
                      )}
                      {c.name && <p className="text-xs text-muted-foreground">{c.name}</p>}
                    </td>
                    <td className="px-3 py-3">{SOURCE_LABEL[c.source] ?? c.source}</td>
                    <td className="px-3 py-3 text-xs">{formatJalaliDateTime(c.createdAt)}</td>
                    <td className="px-3 py-3">
                      <Badge tone={COUPON_TONE[c.couponState]}>{COUPON_LABEL[c.couponState]}</Badge>
                      {c.isCustomer && <Badge tone="gold" className="ms-1">مشتری</Badge>}
                      {c.unsubscribed && <Badge tone="danger" className="ms-1">لغو عضویت</Badge>}
                    </td>
                    <td className="px-3 py-3">
                      <Button size="sm" variant="ghost" disabled={pending} onClick={() => toggle(c)} data-testid="contact-unsub">
                        {c.unsubscribed ? 'فعال‌سازی' : 'لغو عضویت'}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <ul className="space-y-3 md:hidden">
            {rows.map((c) => (
              <li key={c.id} className="space-y-2 rounded-2xl border border-border bg-surface-card p-4">
                <p dir="ltr" className="break-all text-start font-semibold">
                  {c.phone ?? c.email}
                </p>
                {c.phone && c.email && (
                  <p dir="ltr" className="break-all text-start text-xs text-muted-foreground">
                    {c.email}
                  </p>
                )}
                <p className="text-xs text-muted-foreground">
                  {SOURCE_LABEL[c.source] ?? c.source} · {formatJalaliDateTime(c.createdAt)}
                </p>
                <div className="flex flex-wrap gap-1">
                  <Badge tone={COUPON_TONE[c.couponState]}>{COUPON_LABEL[c.couponState]}</Badge>
                  {c.isCustomer && <Badge tone="gold">مشتری</Badge>}
                  {c.unsubscribed && <Badge tone="danger">لغو عضویت</Badge>}
                </div>
                <Button size="sm" variant="ghost" disabled={pending} onClick={() => toggle(c)}>
                  {c.unsubscribed ? 'فعال‌سازی' : 'لغو عضویت'}
                </Button>
              </li>
            ))}
          </ul>
          <Pagination page={page} pageCount={pages} hrefFor={(n) => hrefFor({ page: n })} />
        </>
      )}
    </div>
  )
}
