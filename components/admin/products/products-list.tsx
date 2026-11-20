'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { toast } from '@/components/ui/toaster'
import { BulkBar, DataTable, Drawer, EmptyState, ExpiryBadge, FilterBar, Pager, StatCard, confirmDialog, useUrlState } from '@/components/admin/kit'
import { faNum, toman } from '@/components/admin/format'
import { bulkAdjustPricesAction, bulkSetProductsActiveAction, bulkSetProductsCategoryAction, quickUpdateProductAction, type PriceAdjustResult } from '@/app/actions/products'
import { validatePriceAdjust, type PriceAdjust } from '@/lib/shop/price-adjust'
import type { ExpiryState } from '@/lib/shop/expiry'

export interface ProductRow {
  id: string
  nameFa: string
  sku: string | null
  price: number
  stockStatus: 'IN_STOCK' | 'LOW_STOCK' | 'OUT_OF_STOCK' | 'ON_BACKORDER'
  isActive: boolean
  isFeatured: boolean
  tracksExpiry: boolean
  categoryName: string | null
  imageId: string | null
  expiry: { state: ExpiryState; date: string | null; daysLeft: number | null } | null
}

export interface ProductsListProps {
  rows: ProductRow[]
  categories: { id: string; nameFa: string }[]
  total: number
  filteredTotal: number
  stats: { active: number; inactive: number; inStock: number; outOfStock: number }
  canAdmin: boolean
  onAdd: () => void
  onEdit: (id: string) => void
  onDelete: (id: string, name: string) => void
  onToggleActive: (id: string, next: boolean) => void
}

const STOCK_FA = { IN_STOCK: 'موجود', LOW_STOCK: 'محدود', OUT_OF_STOCK: 'ناموجود', ON_BACKORDER: 'پیش‌سفارش' } as const
const field = 'min-h-11 rounded-xl border border-border bg-input px-3 py-2 text-sm'

function InlinePrice({ row, onSaved }: { row: ProductRow; onSaved: () => void }) {
  const [v, setV] = useState(String(row.price))
  const [pending, start] = useTransition()
  const commit = () => {
    const n = Number(v)
    if (!v || n === row.price) return setV(String(row.price))
    start(async () => {
      const res = await quickUpdateProductAction(row.id, { price: n })
      if (res.error) {
        toast.error(res.error)
        setV(String(row.price))
        return
      }
      toast.success('قیمت ذخیره شد.')
      onSaved()
    })
  }
  return (
    <label className="flex items-center gap-1.5">
      <span className="sr-only">قیمت {row.nameFa}</span>
      <input
        data-testid={`inline-price-${row.id}`}
        className={`${field} w-28 text-start`}
        dir="ltr"
        inputMode="numeric"
        value={v}
        disabled={pending}
        onChange={(e) => setV(e.target.value.replace(/[^\d]/g, ''))}
        onBlur={commit}
        onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
      />
      <span className="text-xs text-muted-foreground">تومان</span>
    </label>
  )
}

function InlineStock({ row, onSaved }: { row: ProductRow; onSaved: () => void }) {
  const [pending, start] = useTransition()
  return (
    <select
      aria-label={`موجودی ${row.nameFa}`}
      data-testid={`inline-stock-${row.id}`}
      className={`${field} min-h-9 py-1 text-xs`}
      value={row.stockStatus}
      disabled={pending}
      onChange={(e) =>
        start(async () => {
          const res = await quickUpdateProductAction(row.id, { stockStatus: e.target.value })
          if (res.error) toast.error(res.error)
          else {
            toast.success('وضعیت موجودی ذخیره شد.')
            onSaved()
          }
        })
      }
    >
      {Object.entries(STOCK_FA).map(([k, label]) => (
        <option key={k} value={k}>
          {label}
        </option>
      ))}
    </select>
  )
}

export function ProductsList({ rows, categories, total, filteredTotal, stats, canAdmin, onAdd, onEdit, onDelete, onToggleActive }: ProductsListProps) {
  const router = useRouter()
  const [url, patch] = useUrlState({ q: '', cat: '', status: '', expiry: '', page: 1, size: 50 })
  const [selected, setSelected] = useState<string[]>([])
  const [priceOpen, setPriceOpen] = useState(false)
  const [mode, setMode] = useState<PriceAdjust['mode']>('percent')
  const [value, setValue] = useState('')
  const [rounding, setRounding] = useState('1000')
  const [preview, setPreview] = useState<PriceAdjustResult['preview'] | null>(null)
  const [catOpen, setCatOpen] = useState(false)
  const [pending, start] = useTransition()
  const refresh = () => router.refresh()
  const dirty = !!(url.q || url.cat || url.status || url.expiry)

  const run = (fn: () => Promise<{ error?: string; message?: string }>, after?: () => void) =>
    start(async () => {
      const res = await fn()
      if (res.error) {
        toast.error(res.error)
        return
      }
      toast.success(res.message ?? 'انجام شد.')
      setSelected([])
      after?.()
      refresh()
    })

  const adjust = (): PriceAdjust => ({ mode, value: Number(value), round: Number(rounding) || 1 })
  const doPreview = () => {
    const bad = validatePriceAdjust(adjust())
    if (bad) {
      toast.error(bad)
      return
    }
    start(async () => {
      const res = await bulkAdjustPricesAction(selected, adjust(), true)
      if (res.error) toast.error(res.error)
      else setPreview(res.preview ?? [])
    })
  }
  const applyPrices = async () => {
    const ok = await confirmDialog({ title: `قیمت ${faNum(selected.length)} محصول تغییر کند؟`, description: 'تغییر در سایت اعمال و در گزارش تغییرات ثبت می‌شود.', confirmLabel: 'اعمال تغییر' })
    if (!ok) return
    run(() => bulkAdjustPricesAction(selected, adjust(), false), () => {
      setPriceOpen(false)
      setPreview(null)
      setValue('')
    })
  }

  return (
    <div className="space-y-4" data-testid="products-list">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard statKey="all" label="کل محصولات" value={faNum(total)} active={!dirty} href="/admin/products" />
        <StatCard statKey="active" label="فعال در فروشگاه" value={faNum(stats.active)} tone="ok" />
        <StatCard statKey="hidden" label="مخفی" value={faNum(stats.inactive)} />
        <StatCard statKey="out" label="ناموجود" value={faNum(stats.outOfStock)} tone={stats.outOfStock ? 'warn' : 'neutral'} href="/admin/products?status=OUT_OF_STOCK" />
      </div>

      <FilterBar
        search={{ value: url.q, placeholder: 'نام، کد کالا یا توضیح' }}
        filters={[
          { key: 'cat', label: 'دسته', type: 'select', value: url.cat, options: [{ value: '', label: 'همه دسته‌ها' }, ...categories.map((c) => ({ value: c.id, label: c.nameFa }))] },
          {
            key: 'status',
            label: 'وضعیت',
            type: 'select',
            value: url.status,
            options: [
              { value: '', label: 'همه وضعیت‌ها' },
              { value: 'ACTIVE', label: 'فعال' },
              { value: 'INACTIVE', label: 'مخفی' },
              { value: 'IN_STOCK', label: 'موجود' },
              { value: 'LOW_STOCK', label: 'موجودی محدود' },
              { value: 'OUT_OF_STOCK', label: 'ناموجود' },
              { value: 'FEATURED', label: 'ویژه' },
            ],
          },
          {
            key: 'expiry',
            label: 'انقضا',
            type: 'select',
            value: url.expiry,
            testId: 'product-expiry-filter',
            options: [
              { value: '', label: 'همه' },
              { value: 'expired', label: 'منقضی‌شده' },
              { value: 'critical', label: 'انقضای بحرانی' },
              { value: 'soon', label: 'نزدیک به انقضا' },
              { value: 'none', label: 'بدون تاریخ' },
            ],
          },
        ]}
        onChange={(p) => patch(p as Record<string, string>)}
        onReset={() => patch({ q: null, cat: null, status: null, expiry: null })}
        dirty={dirty}
      />

      <div className="flex justify-end">
        <Button variant="gold" onClick={onAdd} data-testid="product-new">
          افزودن محصول
        </Button>
      </div>

      <DataTable<ProductRow>
        caption="فهرست محصولات"
        rows={rows}
        rowKey={(r) => r.id}
        selectable
        selected={selected}
        onSelectedChange={setSelected}
        empty={<EmptyState title="محصولی پیدا نشد" description={dirty ? 'فیلترها را تغییر دهید یا پاک کنید.' : 'با «افزودن محصول» شروع کنید.'} />}
        columns={[
          {
            key: 'name',
            header: 'محصول',
            cell: (r) => (
              <div className="min-w-0">
                <button type="button" onClick={() => onEdit(r.id)} className="block max-w-xs truncate text-start font-bold text-primary hover:underline">
                  {r.nameFa}
                </button>
                <p className="text-xs text-muted-foreground">
                  {r.categoryName ?? 'بدون دسته'}
                  {r.sku && <span className="ltr-nums"> · {r.sku}</span>}
                </p>
              </div>
            ),
          },
          { key: 'price', header: 'قیمت', cell: (r) => <InlinePrice key={`${r.id}-${r.price}`} row={r} onSaved={refresh} /> },
          { key: 'stock', header: 'موجودی', align: 'center', cell: (r) => <InlineStock row={r} onSaved={refresh} /> },
          {
            key: 'expiry',
            header: 'انقضا',
            cell: (r) => (r.tracksExpiry && r.expiry ? <ExpiryBadge state={r.expiry.state} daysLeft={r.expiry.daysLeft} date={r.expiry.date ? new Date(r.expiry.date) : null} showDate /> : <span className="text-xs text-muted-foreground">—</span>),
          },
          {
            key: 'active',
            header: 'نمایش',
            align: 'center',
            cell: (r) => (
              <button
                type="button"
                role="switch"
                aria-checked={r.isActive}
                aria-label={`نمایش ${r.nameFa} در فروشگاه`}
                onClick={() => onToggleActive(r.id, !r.isActive)}
                className={`min-h-9 rounded-full border px-3 text-xs font-bold ${r.isActive ? 'border-emerald-500/40 text-emerald-400' : 'border-border text-muted-foreground'}`}
              >
                {r.isActive ? 'فعال' : 'مخفی'}
              </button>
            ),
          },
          {
            key: 'actions',
            header: 'عملیات',
            align: 'end',
            cell: (r) => (
              <div className="flex justify-end gap-1.5">
                <Button size="sm" variant="secondary" onClick={() => onEdit(r.id)}>
                  ویرایش
                </Button>
                <Button size="sm" variant="dangerOutline" onClick={() => onDelete(r.id, r.nameFa)}>
                  حذف
                </Button>
              </div>
            ),
          },
        ]}
        mobileCard={(r) => (
          <div className="space-y-2 p-3">
            <div className="flex items-start justify-between gap-2">
              <button type="button" onClick={() => onEdit(r.id)} className="text-start font-bold text-primary">
                {r.nameFa}
              </button>
              <span className="text-xs text-muted-foreground">{STOCK_FA[r.stockStatus]}</span>
            </div>
            <p className="text-sm">{toman(r.price)}</p>
            {r.tracksExpiry && r.expiry && <ExpiryBadge state={r.expiry.state} daysLeft={r.expiry.daysLeft} />}
            <div className="flex gap-2 pt-1">
              <Button size="sm" variant="secondary" onClick={() => onEdit(r.id)}>
                ویرایش
              </Button>
              <Button size="sm" variant="dangerOutline" onClick={() => onDelete(r.id, r.nameFa)}>
                حذف
              </Button>
            </div>
          </div>
        )}
      />

      <BulkBar
        count={selected.length}
        onClear={() => setSelected([])}
        actions={[
          { label: 'فعال کردن', onClick: () => run(() => bulkSetProductsActiveAction(selected, true)), disabled: pending },
          { label: 'مخفی کردن', onClick: () => run(() => bulkSetProductsActiveAction(selected, false)), disabled: pending },
          { label: 'تغییر دسته', onClick: () => setCatOpen(true) },
          { label: 'تغییر قیمت', onClick: () => setPriceOpen(true), disabled: !canAdmin },
        ]}
      />

      <Pager page={url.page} pageSize={url.size} total={filteredTotal} onPage={(p) => patch({ page: p })} onSize={(s) => patch({ size: s })} />

      <Drawer open={catOpen} onOpenChange={setCatOpen} title="تغییر دسته" description={`${faNum(selected.length)} محصول انتخاب شده است.`}>
        <ul className="space-y-2">
          {categories.map((c) => (
            <li key={c.id}>
              <Button variant="secondary" block disabled={pending} onClick={() => run(() => bulkSetProductsCategoryAction(selected, c.id), () => setCatOpen(false))}>
                {c.nameFa}
              </Button>
            </li>
          ))}
        </ul>
      </Drawer>

      <Drawer
        open={priceOpen}
        onOpenChange={(o) => {
          setPriceOpen(o)
          if (!o) setPreview(null)
        }}
        title="تغییر گروهی قیمت"
        description={`${faNum(selected.length)} محصول انتخاب شده است. ابتدا پیش‌نمایش را ببینید.`}
        footer={
          <div className="flex gap-2">
            <Button variant="secondary" onClick={doPreview} disabled={pending || !value}>
              پیش‌نمایش
            </Button>
            <Button variant="gold" onClick={applyPrices} disabled={pending || !preview || preview.some((p) => p.after == null)} data-testid="price-apply">
              اعمال
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <label className="block text-sm font-bold">
              نوع تغییر
              <select className={`${field} w-full`} value={mode} onChange={(e) => { setMode(e.target.value as PriceAdjust['mode']); setPreview(null) }}>
                <option value="percent">درصدی</option>
                <option value="amount">مبلغ ثابت (تومان)</option>
              </select>
            </label>
            <label className="block text-sm font-bold">
              مقدار (برای کاهش منفی)
              <input className={`${field} w-full`} dir="ltr" inputMode="numeric" value={value} onChange={(e) => { setValue(e.target.value.replace(/[^\d-]/g, '')); setPreview(null) }} />
            </label>
          </div>
          <label className="block text-sm font-bold">
            گرد کردن به
            <select className={`${field} w-full`} value={rounding} onChange={(e) => { setRounding(e.target.value); setPreview(null) }}>
              <option value="1">بدون گرد کردن</option>
              <option value="1000">نزدیک‌ترین ۱٬۰۰۰ تومان</option>
              <option value="10000">نزدیک‌ترین ۱۰٬۰۰۰ تومان</option>
            </select>
          </label>
          {preview && (
            <table className="w-full text-sm" data-testid="price-preview">
              <thead>
                <tr className="text-xs text-muted-foreground">
                  <th className="p-2 text-start">محصول</th>
                  <th className="p-2 text-start">قبل</th>
                  <th className="p-2 text-start">بعد</th>
                </tr>
              </thead>
              <tbody>
                {preview.map((p) => (
                  <tr key={p.id} className="border-t border-border">
                    <td className="p-2">{p.name}</td>
                    <td className="p-2">{faNum(p.before)}</td>
                    <td className={`p-2 font-bold ${p.after == null ? 'text-red-400' : ''}`}>{p.after == null ? 'نامعتبر' : faNum(p.after)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </Drawer>
    </div>
  )
}
