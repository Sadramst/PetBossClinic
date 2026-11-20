'use client'

import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { toast } from '@/components/ui/toaster'
import { Drawer, JalaliDateField, ProductCombobox, type ProductOption } from '@/components/admin/kit'
import { addBatchesAction, resolveSkusAction, searchProductsAction } from '@/app/actions/inventory'
import { parseBatchPaste } from '@/lib/shop/expiry-rules'
import { addMonths } from '@/components/admin/kit/jalali-date-field'
import { cn } from '@/lib/utils'

type Line = {
  key: number
  product: (ProductOption & { tracksExpiry?: boolean; shelfLifeDays?: number | null }) | null
  quantity: string
  manufactureDate: string | null
  expiryDate: string | null
  batchNumber: string
  location: string
  costPrice: string
}

const field = 'w-full min-h-11 rounded-xl border border-border bg-input px-3 py-2 text-sm'
let seq = 0
const blank = (): Line => ({ key: ++seq, product: null, quantity: '', manufactureDate: null, expiryDate: null, batchNumber: '', location: '', costPrice: '' })

const EXPIRY_PRESETS = [
  { label: '+۶ ماه', months: 6 },
  { label: '+۱۲ ماه', months: 12 },
  { label: '+۲۴ ماه', months: 24 },
]

/** Per-line problem, shown inline under the row (never a bare asterisk). */
export function lineProblem(l: Line): string | null {
  if (!l.product) return 'محصول را انتخاب کنید.'
  const q = Number(l.quantity)
  if (!Number.isInteger(q) || q < 1) return 'تعداد باید حداقل ۱ باشد.'
  if (l.product.tracksExpiry && !l.expiryDate) return 'این کالا تاریخ انقضا دارد؛ تاریخ را وارد کنید.'
  if (l.expiryDate && l.manufactureDate && new Date(l.manufactureDate) >= new Date(l.expiryDate)) return 'تاریخ تولید باید پیش از انقضا باشد.'
  return null
}

export function BatchDrawer({
  open,
  onOpenChange,
  initialProduct,
  onSaved,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  initialProduct?: ProductOption | null
  onSaved: () => void
}) {
  const [lines, setLines] = useState<Line[]>(() => [{ ...blank(), product: initialProduct ?? null }])
  const [showErrors, setShowErrors] = useState(false)
  const [paste, setPaste] = useState('')
  const [pending, start] = useTransition()
  const [result, setResult] = useState<string | null>(null)

  const patch = (key: number, p: Partial<Line>) => setLines((ls) => ls.map((l) => (l.key === key ? { ...l, ...p } : l)))
  const search = async (q: string): Promise<(ProductOption & { tracksExpiry?: boolean; shelfLifeDays?: number | null })[]> =>
    searchProductsAction(q)

  const pickProduct = (key: number, p: Line['product']) => {
    const line = lines.find((l) => l.key === key)
    const next: Partial<Line> = { product: p }
    if (p?.shelfLifeDays && line?.manufactureDate && !line.expiryDate) {
      next.expiryDate = new Date(new Date(line.manufactureDate).getTime() + p.shelfLifeDays * 86_400_000).toISOString()
    }
    patch(key, next)
  }

  const applyPaste = () => {
    const rows = parseBatchPaste(paste)
    if (!rows.length) {
      toast.error('سطری برای افزودن پیدا نشد', 'قالب هر سطر: کد کالا، تعداد، تاریخ انقضا')
      return
    }
    start(async () => {
      const found = await resolveSkusAction(rows.map((r) => r.sku))
      const bySku = new Map(found.map((f) => [f.sku, f]))
      const missing = rows.filter((r) => !bySku.has(r.sku)).map((r) => r.sku)
      const added: Line[] = rows
        .filter((r) => bySku.has(r.sku))
        .map((r) => {
          const f = bySku.get(r.sku)!
          return { ...blank(), product: { id: f.id, name: f.name, sku: f.sku, tracksExpiry: f.tracksExpiry }, quantity: String(r.quantity), expiryDate: null, batchNumber: '' }
        })
      // Dates typed in Jalali text are applied through the same parser the field uses.
      const { parseJalaliInput } = await import('@/lib/date/jalali')
      added.forEach((l, i) => {
        const d = rows.filter((r) => bySku.has(r.sku))[i].expiryDate
        const parsed = d ? parseJalaliInput(d) : null
        if (parsed) l.expiryDate = new Date(Date.UTC(parsed.getUTCFullYear(), parsed.getUTCMonth(), parsed.getUTCDate(), 12)).toISOString()
      })
      setLines((ls) => [...ls.filter((l) => l.product || l.quantity), ...added])
      setPaste('')
      if (missing.length) toast.error(`${missing.length.toLocaleString('fa-IR')} کد پیدا نشد`, missing.slice(0, 5).join('، '))
    })
  }

  const save = () => {
    setShowErrors(true)
    if (lines.some((l) => lineProblem(l))) {
      toast.error('ردیف‌های دارای خطا را اصلاح کنید.')
      return
    }
    start(async () => {
      const res = await addBatchesAction(
        lines.map((l) => ({
          productId: l.product!.id,
          quantity: Number(l.quantity),
          manufactureDate: l.manufactureDate,
          expiryDate: l.expiryDate,
          batchNumber: l.batchNumber || null,
          location: l.location || null,
          costPrice: l.costPrice ? Number(l.costPrice) : null,
        }))
      )
      if (res.error) {
      toast.error(res.error)
      return
    }
      setResult(res.message ?? 'ثبت شد.')
      toast.success(res.message ?? 'ثبت شد.')
      setLines([blank()])
      setShowErrors(false)
      onSaved()
    })
  }

  return (
    <Drawer
      open={open}
      onOpenChange={onOpenChange}
      title="ثبت محموله"
      description="هر ردیف یک بچ است. اگر یک ردیف خطا داشته باشد هیچ ردیفی ذخیره نمی‌شود."
      footer={
        <div className="flex flex-wrap items-center gap-2">
          <Button data-testid="batch-save" variant="gold" onClick={save} disabled={pending}>
            {pending ? 'در حال ذخیره…' : `ذخیره ${lines.length.toLocaleString('fa-IR')} ردیف`}
          </Button>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            بستن
          </Button>
        </div>
      }
    >
      <div data-testid="batch-drawer" className="space-y-4">
        {result && (
          <p role="status" className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-300">
            {result}
          </p>
        )}
        {lines.map((l, i) => {
          const problem = showErrors ? lineProblem(l) : null
          return (
            <fieldset key={l.key} data-testid={`batch-line-${i}`} className={cn('space-y-3 rounded-2xl border p-3', problem ? 'border-red-500/50' : 'border-border')}>
              <legend className="px-1 text-xs font-bold text-muted-foreground">ردیف {(i + 1).toLocaleString('fa-IR')}</legend>
              <ProductCombobox value={l.product} onChange={(p) => pickProduct(l.key, p as Line['product'])} search={search} />
              <div className="grid grid-cols-2 gap-3">
                <label className="block text-xs font-bold">
                  تعداد
                  <input data-testid={`batch-qty-${i}`} className={field} inputMode="numeric" dir="ltr" value={l.quantity} onChange={(e) => patch(l.key, { quantity: e.target.value.replace(/[^\d]/g, '') })} />
                </label>
                <label className="block text-xs font-bold">
                  شماره بچ
                  <input className={field} dir="ltr" value={l.batchNumber} onChange={(e) => patch(l.key, { batchNumber: e.target.value })} />
                </label>
                <JalaliDateField
                  label="تاریخ تولید"
                  value={l.manufactureDate}
                  onChange={(v) => {
                    const sl = l.product?.shelfLifeDays
                    patch(l.key, { manufactureDate: v, ...(v && sl && !l.expiryDate ? { expiryDate: new Date(new Date(v).getTime() + sl * 86_400_000).toISOString() } : {}) })
                  }}
                />
                <JalaliDateField
                  label="تاریخ انقضا"
                  data-testid={`batch-expiry-${i}`}
                  value={l.expiryDate}
                  onChange={(v) => patch(l.key, { expiryDate: v })}
                  presets={EXPIRY_PRESETS}
                />
                <label className="block text-xs font-bold">
                  محل نگهداری
                  <input className={field} value={l.location} onChange={(e) => patch(l.key, { location: e.target.value })} />
                </label>
                <label className="block text-xs font-bold">
                  قیمت تمام‌شده (تومان)
                  <input className={field} inputMode="numeric" dir="ltr" value={l.costPrice} onChange={(e) => patch(l.key, { costPrice: e.target.value.replace(/[^\d]/g, '') })} />
                </label>
              </div>
              {l.manufactureDate && !l.expiryDate && (
                <button type="button" className="text-xs font-bold text-primary" onClick={() => patch(l.key, { expiryDate: addMonths(new Date(l.manufactureDate!), 12).toISOString() })}>
                  انقضا را ۱۲ ماه پس از تولید بگذار
                </button>
              )}
              {problem && (
                <p role="alert" className="text-xs font-bold text-red-400">
                  {problem}
                </p>
              )}
              <div className="flex gap-2">
                <Button type="button" size="sm" variant="secondary" onClick={() => setLines((ls) => [...ls.slice(0, i + 1), { ...l, key: ++seq }, ...ls.slice(i + 1)])}>
                  کپی این ردیف
                </Button>
                {lines.length > 1 && (
                  <Button type="button" size="sm" variant="dangerOutline" onClick={() => setLines((ls) => ls.filter((x) => x.key !== l.key))}>
                    حذف ردیف
                  </Button>
                )}
              </div>
            </fieldset>
          )
        })}
        <Button data-testid="batch-add-line" type="button" variant="outline" onClick={() => setLines((ls) => [...ls, blank()])}>
          افزودن ردیف
        </Button>

        <details className="rounded-2xl border border-border p-3">
          <summary className="cursor-pointer text-sm font-bold">چسباندن از اکسل یا CSV</summary>
          <p className="mt-2 text-xs leading-6 text-muted-foreground">هر سطر: کد کالا، تعداد، تاریخ انقضا (مثلاً ۱۴۰۶/۱۲/۱۲). جداکننده ویرگول، تب یا نقطه‌ویرگول است.</p>
          <textarea className={cn(field, 'mt-2 h-28 font-mono')} dir="ltr" value={paste} onChange={(e) => setPaste(e.target.value)} />
          <Button type="button" size="sm" variant="secondary" className="mt-2" onClick={applyPaste} disabled={pending || !paste.trim()}>
            افزودن سطرها
          </Button>
        </details>
      </div>
    </Drawer>
  )
}
