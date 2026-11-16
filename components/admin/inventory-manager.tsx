'use client'

import { useMemo, useRef, useState, useTransition } from 'react'
import {
  addBatchAction,
  deleteBatchAction,
  setTracksExpiryAction,
  updateBatchQuantityAction,
} from '@/app/actions/inventory'
import type { ExpiryState } from '@/lib/shop/expiry'

export interface BatchRow {
  id: string
  productId: string
  productName: string
  productSku: string | null
  productSlug: string
  quantity: number
  batchNumber: string | null
  location: string | null
  expiry: string | null
  manufacture: string | null
  state: ExpiryState
  receivedAt: string
}

interface ProductOption {
  id: string
  nameFa: string
  sku: string | null
  tracksExpiry?: boolean
}

interface Props {
  expiring: BatchRow[]
  recent: BatchRow[]
  undated: ProductOption[]
  products: ProductOption[]
  today: string
}

const STATE_STYLE: Record<ExpiryState, { label: string; cls: string }> = {
  expired: { label: 'منقضی شده', cls: 'bg-red-500/15 text-red-400 border-red-500/30' },
  critical: { label: 'کمتر از ۳۰ روز', cls: 'bg-amber-500/15 text-amber-400 border-amber-500/30' },
  soon: { label: 'کمتر از ۹۰ روز', cls: 'bg-yellow-500/10 text-yellow-300 border-yellow-500/20' },
  ok: { label: 'معتبر', cls: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' },
  none: { label: 'بدون انقضا', cls: 'bg-surface text-muted-foreground border-border' },
}

const fa = (n: number) => n.toLocaleString('fa-IR')
const optionLabel = (p: ProductOption) => `${p.sku ?? p.id} — ${p.nameFa}`

export function InventoryManager({ expiring, recent, undated, products, today }: Props) {
  const [isPending, startTransition] = useTransition()
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [tab, setTab] = useState<'expiring' | 'recent' | 'undated'>('expiring')
  const [productInput, setProductInput] = useState('')
  const formRef = useRef<HTMLFormElement>(null)

  const counts = useMemo(
    () => ({
      expired: expiring.filter((b) => b.state === 'expired').length,
      critical: expiring.filter((b) => b.state === 'critical').length,
      soon: expiring.filter((b) => b.state === 'soon').length,
    }),
    [expiring]
  )

  const selected = products.find((p) => optionLabel(p) === productInput)

  const run = (fn: () => Promise<{ error?: string; message?: string }>, onOk?: () => void) =>
    startTransition(async () => {
      const res = await fn()
      if (res.error) setMessage({ type: 'error', text: res.error })
      else {
        setMessage({ type: 'success', text: res.message ?? 'ذخیره شد.' })
        onOk?.()
      }
    })

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    run(
      () => addBatchAction(fd),
      () => {
        formRef.current?.reset()
        setProductInput('')
      }
    )
  }

  const rows = tab === 'expiring' ? expiring : recent

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold">موجودی و تاریخ انقضا</h1>
        <p className="text-sm text-muted-foreground mt-1">
          هر محموله ورودی را به‌صورت یک «بچ» با تاریخ انقضا ثبت کنید. سایت همیشه نزدیک‌ترین تاریخ انقضای معتبر را به
          مشتری نشان می‌دهد و کالای منقضی‌شده را خودکار از فروش خارج می‌کند.
        </p>
      </div>

      {message && (
        <div
          role="status"
          className={`rounded-xl border px-4 py-3 text-sm ${
            message.type === 'success'
              ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
              : 'border-red-500/30 bg-red-500/10 text-red-300'
          }`}
        >
          {message.text}
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Stat label="بچ منقضی با موجودی" value={counts.expired} tone="red" />
        <Stat label="انقضا تا ۳۰ روز" value={counts.critical} tone="amber" />
        <Stat label="انقضا تا ۹۰ روز" value={counts.soon} tone="yellow" />
        <Stat label="کالای فاسدشدنی بدون تاریخ" value={undated.length} tone="muted" />
      </div>

      {/* Add batch */}
      <form ref={formRef} onSubmit={onSubmit} className="rounded-2xl border border-border bg-surface-card p-5 space-y-4">
        <h2 className="font-bold">ثبت محموله (بچ) جدید</h2>
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          <label className="lg:col-span-3 text-sm space-y-1.5 block">
            <span>محصول (نام یا کد کالا را تایپ کنید)</span>
            <input
              name="product"
              list="inventory-products"
              required
              value={productInput}
              onChange={(e) => setProductInput(e.target.value)}
              className="w-full rounded-xl border border-border bg-input px-3 py-2.5"
              autoComplete="off"
            />
            <datalist id="inventory-products">
              {products.map((p) => (
                <option key={p.id} value={optionLabel(p)} />
              ))}
            </datalist>
          </label>
          <Field name="quantity" label="تعداد" type="number" required min={0} defaultValue="1" />
          <Field
            name="expiryDate"
            label={`تاریخ انقضا (شمسی)${selected?.tracksExpiry ? ' *' : ''}`}
            placeholder="۱۴۰۵/۰۶/۱۵"
            required={!!selected?.tracksExpiry}
          />
          <Field name="manufactureDate" label="تاریخ تولید (اختیاری)" placeholder="۱۴۰۴/۰۶/۱۵" />
          <Field name="batchNumber" label="شماره بچ / سری ساخت" placeholder="LOT-2405" />
          <Field name="location" label="محل نگهداری" placeholder="قفسه A2" />
          <Field name="note" label="یادداشت" />
        </div>
        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={isPending}
            className="rounded-xl bg-gradient-gold text-charcoal-950 font-bold px-6 py-2.5 text-sm disabled:opacity-60"
          >
            {isPending ? 'در حال ذخیره…' : 'ثبت بچ'}
          </button>
          <span className="text-xs text-muted-foreground">امروز: {today}</span>
          {selected && (
            <label className="text-xs flex items-center gap-2 ms-auto">
              <input
                type="checkbox"
                checked={!!selected.tracksExpiry}
                onChange={(e) => run(() => setTracksExpiryAction(selected.id, e.target.checked))}
              />
              این کالا فاسدشدنی است (تاریخ انقضا اجباری)
            </label>
          )}
        </div>
      </form>

      {/* Lists */}
      <div className="rounded-2xl border border-border bg-surface-card">
        <div className="flex gap-1 p-2 border-b border-border text-sm">
          {(
            [
              ['expiring', `رو به انقضا (${fa(expiring.length)})`],
              ['recent', 'آخرین بچ‌های ثبت‌شده'],
              ['undated', `فاسدشدنی بدون تاریخ (${fa(undated.length)})`],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setTab(key)}
              className={`px-3 py-1.5 rounded-lg ${tab === key ? 'bg-primary text-charcoal-950 font-bold' : 'hover:bg-surface-hover'}`}
            >
              {label}
            </button>
          ))}
        </div>

        {tab === 'undated' ? (
          <ul className="divide-y divide-border text-sm">
            {undated.length === 0 && <li className="p-4 text-muted-foreground">همه کالاهای فاسدشدنی موجود، تاریخ انقضا دارند.</li>}
            {undated.map((p) => (
              <li key={p.id} className="p-3 flex items-center justify-between gap-3">
                <span>
                  {p.nameFa} <span className="text-xs text-muted-foreground" dir="ltr">{p.sku}</span>
                </span>
                <button
                  type="button"
                  className="text-xs text-primary hover:underline"
                  onClick={() => {
                    setProductInput(optionLabel(p))
                    formRef.current?.scrollIntoView({ behavior: 'smooth' })
                  }}
                >
                  ثبت بچ
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs text-muted-foreground">
                <tr className="border-b border-border">
                  <th className="p-3 text-start">محصول</th>
                  <th className="p-3 text-start">انقضا</th>
                  <th className="p-3 text-start">وضعیت</th>
                  <th className="p-3 text-start">بچ</th>
                  <th className="p-3 text-start">تعداد</th>
                  <th className="p-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {rows.length === 0 && (
                  <tr>
                    <td colSpan={6} className="p-4 text-muted-foreground">
                      موردی وجود ندارد.
                    </td>
                  </tr>
                )}
                {rows.map((b) => (
                  <BatchRowView key={b.id} b={b} disabled={isPending} run={run} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

function BatchRowView({
  b,
  disabled,
  run,
}: {
  b: BatchRow
  disabled: boolean
  run: (fn: () => Promise<{ error?: string; message?: string }>) => void
}) {
  const [qty, setQty] = useState(String(b.quantity))
  const st = STATE_STYLE[b.state]
  return (
    <tr>
      <td className="p-3">
        <a href={`/product/${encodeURIComponent(b.productSlug)}`} target="_blank" className="hover:text-primary">
          {b.productName}
        </a>
        <div className="text-xs text-muted-foreground" dir="ltr">{b.productSku}</div>
      </td>
      <td className="p-3 whitespace-nowrap" dir="ltr">{b.expiry ?? '—'}</td>
      <td className="p-3">
        <span className={`text-xs px-2 py-0.5 rounded-full border ${st.cls}`}>{st.label}</span>
      </td>
      <td className="p-3 text-xs">
        {b.batchNumber ?? '—'}
        {b.location && <div className="text-muted-foreground">{b.location}</div>}
      </td>
      <td className="p-3">
        <input
          type="number"
          min={0}
          value={qty}
          onChange={(e) => setQty(e.target.value)}
          className="w-20 rounded-lg border border-border bg-input px-2 py-1"
          aria-label="تعداد باقی‌مانده"
        />
      </td>
      <td className="p-3 whitespace-nowrap space-x-2 space-x-reverse">
        <button
          type="button"
          disabled={disabled || qty === String(b.quantity)}
          onClick={() => run(() => updateBatchQuantityAction(b.id, Number(qty)))}
          className="text-xs text-primary disabled:opacity-40"
        >
          ذخیره
        </button>
        <button
          type="button"
          disabled={disabled}
          onClick={() => {
            if (confirm('این بچ حذف شود؟')) run(() => deleteBatchAction(b.id))
          }}
          className="text-xs text-red-400"
        >
          حذف
        </button>
      </td>
    </tr>
  )
}

function Field({
  label,
  ...props
}: { label: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="text-sm space-y-1.5 block">
      <span>{label}</span>
      <input {...props} className="w-full rounded-xl border border-border bg-input px-3 py-2.5" />
    </label>
  )
}

function Stat({ label, value, tone }: { label: string; value: number; tone: 'red' | 'amber' | 'yellow' | 'muted' }) {
  const color = { red: 'text-red-400', amber: 'text-amber-400', yellow: 'text-yellow-300', muted: 'text-foreground' }[tone]
  return (
    <div className="rounded-2xl border border-border bg-surface-card p-4">
      <div className={`text-2xl font-black ${color}`}>{fa(value)}</div>
      <div className="text-xs text-muted-foreground mt-1">{label}</div>
    </div>
  )
}
