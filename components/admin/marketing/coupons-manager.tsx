'use client'

import { useState, useTransition } from 'react'
import { useRouter } from '@/i18n/routing'
import { Badge, type BadgeTone } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import { Pagination } from '@/components/ui/pagination'
import { Input, Select } from '@/components/ui/input'
import { confirmDialog } from '@/components/ui/confirm-dialog'
import { toast } from '@/components/ui/toaster'
import { deleteCouponAction, duplicateCouponAction, exportBatchCsvAction, setCouponActiveAction } from '@/app/actions/admin-marketing'
import { COUPON_STATUS_LABEL, type CouponStatus } from '@/lib/marketing/admin-validators'
import { describeOffer } from '@/lib/marketing/coupon-rules'
import type { CouponFormOptions, CouponRow } from '@/lib/marketing/admin-queries'
import { faNum, formatJalaliDateTime, toman } from '@/components/admin/format'
import { BulkDialog, CouponDialog } from './coupon-dialogs'
import { downloadText } from './download'

const TONE: Record<CouponStatus, BadgeTone> = { active: 'success', inactive: 'neutral', scheduled: 'info', expired: 'warning', used_up: 'danger' }
const TYPE_LABEL = { PERCENT: 'درصدی', FIXED: 'مبلغ ثابت', FREE_SHIPPING: 'ارسال رایگان' } as const
const SOURCE_LABEL: Record<string, string> = { manual: 'دستی', welcome: 'خوش‌آمد', bulk: 'گروهی' }

export interface CouponsManagerProps {
  rows: CouponRow[]
  total: number
  page: number
  pages: number
  options: CouponFormOptions
  filters: { q: string; status: string; type: string; source: string }
}

function scope(c: CouponRow): string[] {
  const out: string[] = []
  if (c.autoApply) out.push('خودکار')
  if (c.firstOrderOnly) out.push('اولین خرید')
  if (c.customerLabel) out.push(`شخصی: ${c.customerLabel}`)
  if (c.groupName) out.push(`گروه: ${c.groupName}`)
  if (c.categoryIds.length + c.brandIds.length + c.productIds.length > 0) out.push('محدود به کالاهای خاص')
  if (c.minSubtotal > 0) out.push(`حداقل خرید ${toman(c.minSubtotal)}`)
  return out
}

export function CouponsManager({ rows, total, page, pages, options, filters }: CouponsManagerProps) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const [q, setQ] = useState(filters.q)
  const [dialog, setDialog] = useState<{ key: number; editing: CouponRow | null } | null>(null)
  const [bulk, setBulk] = useState<number | null>(null)

  const hrefFor = (over: Partial<typeof filters> & { page?: number }) => {
    const p = new URLSearchParams({ tab: 'coupons' })
    const f = { ...filters, ...over }
    if (f.q) p.set('q', f.q)
    if (f.status) p.set('status', f.status)
    if (f.type) p.set('type', f.type)
    if (f.source) p.set('source', f.source)
    if (over.page && over.page > 1) p.set('page', String(over.page))
    return `/admin/marketing?${p.toString()}`
  }
  const refresh = () => router.refresh()

  const run = (fn: () => Promise<{ ok: boolean; error?: string }>, okTitle: string) =>
    start(async () => {
      const res = await fn()
      if (!res.ok) toast.error('انجام نشد', res.error)
      else {
        toast.success(okTitle)
        refresh()
      }
    })

  const copy = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code)
      toast.success('کد کپی شد', code)
    } catch {
      toast.error('کپی نشد', 'کد را دستی انتخاب و کپی کنید.')
    }
  }

  const remove = (c: CouponRow) =>
    start(async () => {
      const ok = await confirmDialog({ title: `حذف کد ${c.code}؟`, description: 'این کار برگشت‌پذیر نیست. کدی که در سفارشی استفاده شده باشد حذف نمی‌شود؛ آن را غیرفعال کنید.', confirmLabel: 'حذف کد' })
      if (!ok) return
      const res = await deleteCouponAction(c.id)
      if (!res.ok) toast.error('حذف نشد', res.error)
      else {
        toast.success('کد حذف شد')
        refresh()
      }
    })

  const downloadBatch = (batchId: string) =>
    start(async () => {
      const res = await exportBatchCsvAction(batchId)
      if (!res.ok || !res.data) toast.error('دانلود نشد', res.error)
      else downloadText(`coupons-${batchId.slice(0, 8)}.csv`, res.data.csv)
    })

  const actions = (c: CouponRow) => (
    <div className="flex flex-wrap gap-1.5">
      <Button size="sm" variant="secondary" onClick={() => setDialog({ key: Date.now(), editing: c })} data-testid="coupon-edit">
        ویرایش
      </Button>
      <Button size="sm" variant="secondary" disabled={pending} onClick={() => run(() => setCouponActiveAction(c.id, !c.isActive), c.isActive ? 'کد غیرفعال شد' : 'کد فعال شد')} data-testid="coupon-toggle">
        {c.isActive ? 'غیرفعال‌سازی' : 'فعال‌سازی'}
      </Button>
      <Button size="sm" variant="ghost" disabled={pending} onClick={() => run(() => duplicateCouponAction(c.id), 'نسخه غیرفعال ساخته شد')} data-testid="coupon-duplicate">
        تکثیر
      </Button>
      <Button size="sm" variant="dangerOutline" disabled={pending} onClick={() => remove(c)} data-testid="coupon-delete">
        حذف
      </Button>
    </div>
  )

  const usage = (c: CouponRow) => (c.usageLimit != null ? `${faNum(c.usedCount)} از ${faNum(c.usageLimit)}` : `${faNum(c.usedCount)} بار`)
  const period = (c: CouponRow) =>
    c.startsAt || c.endsAt ? `${c.startsAt ? formatJalaliDateTime(c.startsAt) : 'اکنون'} تا ${c.endsAt ? formatJalaliDateTime(c.endsAt) : 'نامحدود'}` : 'بدون محدودیت زمانی'

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">{faNum(total)} کد تخفیف</p>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={() => setBulk(Date.now())} data-testid="bulk-open">
            ساخت گروهی کد
          </Button>
          <Button variant="gold" onClick={() => setDialog({ key: Date.now(), editing: null })} data-testid="coupon-new">
            کد تخفیف جدید
          </Button>
        </div>
      </div>

      <form
        className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_repeat(3,minmax(0,9rem))_auto]"
        onSubmit={(e) => {
          e.preventDefault()
          router.push(hrefFor({ q, page: 1 }))
        }}
        role="search"
      >
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="جستجوی کد یا عنوان" aria-label="جستجوی کد تخفیف" data-testid="coupon-search" />
        <Select aria-label="وضعیت" value={filters.status} onChange={(e) => router.push(hrefFor({ status: e.target.value, page: 1 }))} data-testid="coupon-filter-status">
          <option value="">همه وضعیت‌ها</option>
          {(Object.keys(COUPON_STATUS_LABEL) as CouponStatus[]).map((k) => (
            <option key={k} value={k}>
              {COUPON_STATUS_LABEL[k]}
            </option>
          ))}
        </Select>
        <Select aria-label="نوع" value={filters.type} onChange={(e) => router.push(hrefFor({ type: e.target.value, page: 1 }))} data-testid="coupon-filter-type">
          <option value="">همه انواع</option>
          {Object.entries(TYPE_LABEL).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </Select>
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
        <EmptyState variant="card" title={filters.q || filters.status || filters.type || filters.source ? 'کدی با این فیلتر پیدا نشد' : 'هنوز کد تخفیفی نساخته‌اید'} description="با «کد تخفیف جدید» اولین کمپین فروش را بسازید." />
      ) : (
        <>
          {/* Wide screens: table */}
          <div className="hidden overflow-hidden rounded-2xl border border-border bg-surface-card md:block">
            <table className="w-full text-sm" data-testid="coupons-table">
              <thead className="border-b border-border bg-surface-elevated text-xs text-muted-foreground">
                <tr>
                  <th className="px-3 py-3 text-start font-semibold">کد و عنوان</th>
                  <th className="px-3 py-3 text-start font-semibold">تخفیف</th>
                  <th className="px-3 py-3 text-start font-semibold">وضعیت</th>
                  <th className="px-3 py-3 text-start font-semibold">استفاده</th>
                  <th className="px-3 py-3 text-start font-semibold">عملیات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {rows.map((c) => (
                  <tr key={c.id} data-testid="coupon-row" data-code={c.code} className="align-top">
                    <td className="max-w-[16rem] px-3 py-3">
                      <button type="button" onClick={() => copy(c.code)} className="font-mono text-sm font-extrabold text-primary hover:underline" dir="ltr" title="کپی کد">
                        {c.code}
                      </button>
                      <p className="mt-0.5 truncate font-semibold">{c.title}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">{SOURCE_LABEL[c.source] ?? c.source}</p>
                    </td>
                    <td className="px-3 py-3">
                      <p className="font-bold">{describeOffer(c)}</p>
                      <p className="mt-1 text-xs leading-6 text-muted-foreground">{scope(c).join(' · ') || 'همه مشتریان و کل سبد'}</p>
                      <p className="text-xs text-muted-foreground">{period(c)}</p>
                    </td>
                    <td className="px-3 py-3">
                      <Badge tone={TONE[c.status]} dot data-testid="coupon-status">
                        {COUPON_STATUS_LABEL[c.status]}
                      </Badge>
                    </td>
                    <td className="px-3 py-3 whitespace-nowrap" data-testid="coupon-usage">
                      {usage(c)}
                    </td>
                    <td className="px-3 py-3">{actions(c)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Phones: cards, no horizontal scroll */}
          <ul className="space-y-3 md:hidden" data-testid="coupons-cards">
            {rows.map((c) => (
              <li key={c.id} className="space-y-2 rounded-2xl border border-border bg-surface-card p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <button type="button" onClick={() => copy(c.code)} className="font-mono text-sm font-extrabold text-primary" dir="ltr">
                      {c.code}
                    </button>
                    <p className="truncate font-semibold">{c.title}</p>
                  </div>
                  <Badge tone={TONE[c.status]} dot>
                    {COUPON_STATUS_LABEL[c.status]}
                  </Badge>
                </div>
                <p className="text-sm font-bold">{describeOffer(c)}</p>
                <p className="text-xs leading-6 text-muted-foreground">
                  {scope(c).join(' · ') || 'همه مشتریان و کل سبد'}
                  <br />
                  {period(c)}
                </p>
                <p className="text-xs">استفاده: {usage(c)}</p>
                {actions(c)}
              </li>
            ))}
          </ul>
          <Pagination page={page} pageCount={pages} hrefFor={(n) => hrefFor({ page: n })} />
        </>
      )}

      {options.batches.length > 0 && (
        <section className="rounded-2xl border border-border bg-surface-card p-4" aria-labelledby="batches-h">
          <h2 id="batches-h" className="text-sm font-extrabold">
            دسته‌های ساخته‌شده
          </h2>
          <ul className="mt-3 divide-y divide-border">
            {options.batches.map((b) => (
              <li key={b.batchId} className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-sm">
                <span className="min-w-0">
                  <span className="font-semibold">{b.title}</span>
                  <span className="ms-2 text-xs text-muted-foreground">
                    {faNum(b.count)} کد · {faNum(b.used)} استفاده‌شده
                  </span>
                </span>
                <Button size="sm" variant="secondary" disabled={pending} onClick={() => downloadBatch(b.batchId)}>
                  دانلود CSV
                </Button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {dialog && (
        <CouponDialog
          key={dialog.key}
          open
          editing={dialog.editing}
          options={options}
          onClose={() => setDialog(null)}
          onSaved={() => {
            setDialog(null)
            refresh()
          }}
        />
      )}
      {bulk !== null && <BulkDialog key={bulk} open options={options} onClose={() => setBulk(null)} onDone={refresh} />}
    </div>
  )
}
