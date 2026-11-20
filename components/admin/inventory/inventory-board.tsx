'use client'

import { Link } from '@/i18n/routing'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { EmptyState, ExpiryBadge, FilterBar, PageHeader, Pager, StatCard, useUrlState } from '@/components/admin/kit'
import { faNum, toman } from '@/components/admin/format'
import { formatJalaliDate, type ExpiryState } from '@/lib/shop/expiry'
import { EXPIRY_LABEL_FA } from '@/lib/shop/expiry-labels'
import type { BatchRow, ExpirySummary } from '@/lib/shop/inventory-admin'
import type { ExpiryConfigValues } from '@/lib/shop/expiry-rules'
import { BatchDrawer } from './batch-drawer'
import { BatchActions } from './batch-actions'
import { ExpirySettings } from './expiry-settings'

const GROUPS: { state: ExpiryState; title: string }[] = [
  { state: 'expired', title: 'منقضی‌شده' },
  { state: 'critical', title: 'انقضای بحرانی' },
  { state: 'soon', title: 'نزدیک به انقضا' },
  { state: 'ok', title: 'سالم' },
  { state: 'none', title: 'بدون تاریخ' },
]

const STATE_PARAMS = ['expired', 'critical', 'soon', 'none'] as const

export interface InventoryBoardProps {
  rows: BatchRow[]
  total: number
  page: number
  size: number
  summary: ExpirySummary
  config: ExpiryConfigValues
  digestPhones: string[]
  canAdmin: boolean
  openNew: boolean
}

export function InventoryBoard({ rows, total, page, size, summary, config, digestPhones, canAdmin, openNew }: InventoryBoardProps) {
  const router = useRouter()
  const [url, patch] = useUrlState({ q: '', state: '', location: '', page: 1, size: 25 })
  const [drawer, setDrawer] = useState<{ key: number; product: BatchRow | null } | null>(openNew ? { key: 0, product: null } : null)
  const refresh = () => router.refresh()
  const dirty = !!(url.q || url.state || url.location)

  const grouped = GROUPS.map((g) => ({ ...g, items: rows.filter((r) => r.state === g.state) })).filter((g) => g.items.length)
  const toggle = (state: string) => patch({ state: url.state === state ? null : state })

  return (
    <div data-testid="inventory-board" className="space-y-6">
      <PageHeader
        title="موجودی و انقضا"
        subtitle="هر محموله ورودی یک بچ با تاریخ انقضاست. فروشگاه همیشه نزدیک‌ترین تاریخ قابل فروش را نشان می‌دهد و بچ منقضی را خودکار از فروش خارج می‌کند."
        breadcrumbs={[{ label: 'موجودی' }]}
        actions={
          <>
            <ExpirySettings initial={config} phones={digestPhones} canEdit={canAdmin} />
            <Button variant="gold" onClick={() => setDrawer({ key: Date.now(), product: null })} data-testid="batch-new">
              ثبت محموله
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <button type="button" aria-pressed={url.state === 'expired'} onClick={() => toggle('expired')} className="text-start">
          <StatCard statKey="expired" label="منقضی‌شده" value={faNum(summary.expired)} tone="danger" active={url.state === 'expired'} hint="نیازمند اقدام" />
        </button>
        <button type="button" aria-pressed={url.state === 'critical'} onClick={() => toggle('critical')} className="text-start">
          <StatCard statKey="critical" label={`کمتر از ${faNum(config.criticalDays)} روز`} value={faNum(summary.critical)} tone="warn" active={url.state === 'critical'} />
        </button>
        <button type="button" aria-pressed={url.state === 'soon'} onClick={() => toggle('soon')} className="text-start">
          <StatCard statKey="soon" label={`کمتر از ${faNum(config.soonDays)} روز`} value={faNum(summary.soon)} tone="gold" active={url.state === 'soon'} />
        </button>
        <button type="button" aria-pressed={url.state === 'none'} onClick={() => toggle('none')} className="text-start">
          <StatCard statKey="undated" label="بدون تاریخ" value={faNum(summary.undated)} active={url.state === 'none'} hint="کالای فاسدشدنی بی‌تاریخ" />
        </button>
        <StatCard statKey="risk" label="ارزش در معرض خطر" value={summary.valueAtRisk ? toman(summary.valueAtRisk) : '—'} tone={summary.valueAtRisk ? 'danger' : 'neutral'} hint="بچ‌های منقضی و بحرانی با قیمت تمام‌شده" />
      </div>

      {summary.expired > 0 && (
        <p role="alert" className="rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm font-bold text-red-300">
          {faNum(summary.expired)} بچ منقضی هنوز در انبار ثبت شده است. آن را امحا یا تعدیل کنید تا گزارش‌ها دقیق بماند.
        </p>
      )}

      <FilterBar
        search={{ value: url.q, placeholder: 'نام، کد، بارکد یا شماره بچ' }}
        filters={[
          {
            key: 'state',
            label: 'وضعیت',
            type: 'select',
            value: url.state,
            testId: 'inventory-filter-state',
            options: [{ value: '', label: 'همه وضعیت‌ها' }, ...[...STATE_PARAMS, 'ok' as const].map((s) => ({ value: s, label: EXPIRY_LABEL_FA[s] }))],
          },
        ]}
        onChange={(p) => patch(p as Record<string, string>)}
        onReset={() => patch({ q: null, state: null, location: null })}
        dirty={dirty}
      />

      {rows.length === 0 ? (
        <EmptyState title={dirty ? 'بچی با این فیلتر پیدا نشد' : 'هنوز بچی ثبت نشده'} description="با «ثبت محموله» اولین ورودی انبار را اضافه کنید." />
      ) : (
        <div className="space-y-4">
          {grouped.map((g) => (
            <details key={g.state} open={g.state === 'expired' || g.state === 'critical' || grouped.length <= 2 || !!url.state} data-testid={`expiry-group-${g.state}`} className="rounded-2xl border border-border bg-surface">
              <summary className="flex min-h-12 cursor-pointer items-center justify-between gap-2 px-4 font-bold">
                <span>{g.title}</span>
                <span className="text-xs text-muted-foreground">{faNum(g.items.length)} بچ در این صفحه</span>
              </summary>
              <ul className="divide-y divide-border">
                {g.items.map((b) => (
                  <li key={b.id} data-testid={`batch-row-${b.id}`} className="grid gap-3 p-4 md:grid-cols-[1.6fr_1fr_auto_auto] md:items-center">
                    <div className="min-w-0">
                      <Link href={`/admin/products?q=${encodeURIComponent(b.productSku ?? b.productName)}`} className="block truncate font-bold text-primary hover:underline">
                        {b.productName}
                      </Link>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {b.productSku && <span className="ltr-nums">{b.productSku}</span>}
                        {b.batchNumber && <span> · بچ <span className="ltr-nums">{b.batchNumber}</span></span>}
                        {b.location && <span> · {b.location}</span>}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <ExpiryBadge state={b.state} daysLeft={b.daysLeft} />
                      {b.expiryDate && <span className="text-xs text-muted-foreground">{formatJalaliDate(b.expiryDate)}</span>}
                    </div>
                    <div className="text-sm">
                      <b>{faNum(b.quantity)}</b> عدد
                      {b.valueAtRisk != null && <p className="text-xs text-red-300">{toman(b.valueAtRisk)} در خطر</p>}
                    </div>
                    <BatchActions batch={b} canAdmin={canAdmin} onChanged={refresh} onAddFor={(x) => setDrawer({ key: Date.now(), product: x })} />
                  </li>
                ))}
              </ul>
            </details>
          ))}
        </div>
      )}

      <Pager page={page} pageSize={size} total={total} onPage={(p) => patch({ page: p })} onSize={(s) => patch({ size: s })} />

      {drawer && (
        <BatchDrawer
          key={drawer.key}
          open
          onOpenChange={(o) => !o && setDrawer(null)}
          initialProduct={drawer.product ? { id: drawer.product.productId, name: drawer.product.productName, sku: drawer.product.productSku } : null}
          onSaved={refresh}
        />
      )}
    </div>
  )
}
