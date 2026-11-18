'use client'

import { useEffect, useRef, useState } from 'react'
import { Field } from '@/components/ui/field'
import { Input, Select } from '@/components/ui/input'
import { searchProductsAction } from '@/app/actions/admin-marketing'

export interface OfferState {
  title: string
  description: string
  type: 'PERCENT' | 'FIXED' | 'FREE_SHIPPING'
  value: string
  maxDiscount: string
  minSubtotal: string
  startsAt: string
  endsAt: string
  isActive: boolean
  firstOrderOnly: boolean
  groupId: string
  categoryIds: string[]
  brandIds: string[]
  productIds: string[]
  productLabels: { id: string; name: string }[]
}

export const EMPTY_OFFER: OfferState = {
  title: '',
  description: '',
  type: 'PERCENT',
  value: '10',
  maxDiscount: '',
  minSubtotal: '0',
  startsAt: '',
  endsAt: '',
  isActive: true,
  firstOrderOnly: false,
  groupId: '',
  categoryIds: [],
  brandIds: [],
  productIds: [],
  productLabels: [],
}

export interface Option {
  id: string
  name: string
}

const toggle = (list: string[], id: string) => (list.includes(id) ? list.filter((x) => x !== id) : [...list, id])

export function Check({ label, checked, onChange, hint, testId }: { label: string; checked: boolean; onChange: (v: boolean) => void; hint?: string; testId?: string }) {
  return (
    <label className="flex min-h-11 cursor-pointer items-start gap-3 rounded-xl border border-border bg-surface-elevated/40 px-3 py-2.5">
      <input type="checkbox" className="mt-1 h-4 w-4 shrink-0 accent-[var(--color-primary,#c9a45c)]" checked={checked} onChange={(e) => onChange(e.target.checked)} data-testid={testId} />
      <span className="min-w-0">
        <span className="block text-sm font-bold">{label}</span>
        {hint && <span className="mt-0.5 block text-xs leading-6 text-muted-foreground">{hint}</span>}
      </span>
    </label>
  )
}

function Chips({ title, options, selected, onToggle }: { title: string; options: Option[]; selected: string[]; onToggle: (id: string) => void }) {
  if (options.length === 0) return null
  return (
    <fieldset className="min-w-0">
      <legend className="mb-1.5 text-sm font-bold">{title}</legend>
      <div className="flex max-h-36 flex-wrap gap-1.5 overflow-y-auto rounded-xl border border-border bg-surface-elevated/40 p-2">
        {options.map((o) => {
          const on = selected.includes(o.id)
          return (
            <button
              key={o.id}
              type="button"
              aria-pressed={on}
              onClick={() => onToggle(o.id)}
              className={`min-h-9 rounded-full border px-3 text-xs font-bold transition-colors ${on ? 'border-primary bg-primary/15 text-primary' : 'border-border text-muted-foreground hover:border-border-gold'}`}
            >
              {o.name}
            </button>
          )
        })}
      </div>
    </fieldset>
  )
}

function ProductPicker({ value, labels, onChange }: { value: string[]; labels: { id: string; name: string }[]; onChange: (ids: string[], labels: { id: string; name: string }[]) => void }) {
  const [q, setQ] = useState('')
  const [results, setResults] = useState<{ id: string; name: string; sku: string | null }[]>([])
  const seq = useRef(0)

  useEffect(() => {
    const term = q.trim()
    if (term.length < 2) {
      setResults([])
      return
    }
    const mine = ++seq.current
    const t = setTimeout(async () => {
      const r = await searchProductsAction(term)
      if (mine === seq.current) setResults(r)
    }, 250)
    return () => clearTimeout(t)
  }, [q])

  const add = (p: { id: string; name: string }) => {
    if (value.includes(p.id)) return
    onChange([...value, p.id], [...labels.filter((l) => value.includes(l.id)), { id: p.id, name: p.name }])
    setQ('')
  }

  return (
    <div className="min-w-0">
      <Field label="محصولات مشخص" optional hint="نام یا کد کالا را جستجو کنید.">
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="جستجوی محصول…" autoComplete="off" />
      </Field>
      {results.length > 0 && (
        <ul className="mt-2 max-h-40 overflow-y-auto rounded-xl border border-border bg-surface-card" role="listbox" aria-label="نتایج جستجوی محصول">
          {results.map((r) => (
            <li key={r.id}>
              <button type="button" onClick={() => add(r)} className="flex min-h-11 w-full items-center justify-between gap-2 px-3 text-start text-sm hover:bg-surface-elevated">
                <span className="truncate">{r.name}</span>
                {r.sku && <span className="shrink-0 text-xs text-muted-foreground" dir="ltr">{r.sku}</span>}
              </button>
            </li>
          ))}
        </ul>
      )}
      {value.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {value.map((id) => (
            <span key={id} className="inline-flex min-h-8 max-w-full items-center gap-1 rounded-full border border-primary/40 bg-primary/10 ps-3 pe-1 text-xs font-bold text-primary">
              <span className="truncate">{labels.find((l) => l.id === id)?.name ?? 'محصول'}</span>
              <button
                type="button"
                aria-label="حذف محصول"
                onClick={() => onChange(value.filter((x) => x !== id), labels.filter((l) => l.id !== id && value.includes(l.id)))}
                className="flex h-7 w-7 items-center justify-center rounded-full hover:bg-primary/20"
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

interface Props {
  state: OfferState
  set: (patch: Partial<OfferState>) => void
  categories: Option[]
  brands: Option[]
  groups: Option[]
  errorField?: string
}

/** Shared by the single-coupon form and the bulk generator. */
export function OfferFields({ state, set, categories, brands, groups }: Props) {
  const isPercent = state.type === 'PERCENT'
  const isFree = state.type === 'FREE_SHIPPING'
  return (
    <div className="space-y-4">
      <Field label="عنوان کمپین" required hint="این عنوان به مشتری نمایش داده می‌شود؛ مثلاً «جشنواره پاییزی».">
        <Input value={state.title} onChange={(e) => set({ title: e.target.value })} maxLength={80} data-testid="coupon-form-title" />
      </Field>
      <Field label="توضیح داخلی" optional>
        <Input value={state.description} onChange={(e) => set({ description: e.target.value })} maxLength={300} />
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="نوع تخفیف" required>
          <Select value={state.type} onChange={(e) => set({ type: e.target.value as OfferState['type'] })} data-testid="coupon-form-type">
            <option value="PERCENT">درصدی</option>
            <option value="FIXED">مبلغ ثابت (تومان)</option>
            <option value="FREE_SHIPPING">ارسال رایگان</option>
          </Select>
        </Field>
        {!isFree && (
          <Field label={isPercent ? 'درصد تخفیف' : 'مبلغ تخفیف (تومان)'} required>
            <Input type="number" inputMode="numeric" min={isPercent ? 1 : 1} max={isPercent ? 100 : undefined} value={state.value} onChange={(e) => set({ value: e.target.value })} data-testid="coupon-form-value" />
          </Field>
        )}
        {isPercent && (
          <Field label="سقف تخفیف (تومان)" optional hint="بیشترین مبلغی که این درصد می‌تواند کم کند.">
            <Input type="number" inputMode="numeric" min={1} value={state.maxDiscount} onChange={(e) => set({ maxDiscount: e.target.value })} />
          </Field>
        )}
        <Field label="حداقل مبلغ سبد (تومان)" optional>
          <Input type="number" inputMode="numeric" min={0} value={state.minSubtotal} onChange={(e) => set({ minSubtotal: e.target.value })} />
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="شروع اعتبار" optional hint="به وقت تهران">
          <Input type="datetime-local" value={state.startsAt} onChange={(e) => set({ startsAt: e.target.value })} dir="ltr" className="text-end" />
        </Field>
        <Field label="پایان اعتبار" optional hint="خالی یعنی بدون محدودیت زمانی.">
          <Input type="datetime-local" value={state.endsAt} onChange={(e) => set({ endsAt: e.target.value })} dir="ltr" className="text-end" />
        </Field>
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        <Check label="فقط اولین خرید" checked={state.firstOrderOnly} onChange={(v) => set({ firstOrderOnly: v })} hint="مشتری باید سفارش موفقی نداشته باشد." />
        <Check label="فعال" checked={state.isActive} onChange={(v) => set({ isActive: v })} />
      </div>

      <Field label="مخصوص یک گروه مشتری" optional>
        <Select value={state.groupId} onChange={(e) => set({ groupId: e.target.value })}>
          <option value="">همه مشتریان</option>
          {groups.map((g) => (
            <option key={g.id} value={g.id}>
              {g.name}
            </option>
          ))}
        </Select>
      </Field>

      <div className="space-y-3 rounded-xl border border-border p-3">
        <p className="text-sm font-extrabold">محدود به محصولات خاص</p>
        <p className="text-xs leading-6 text-muted-foreground">اگر چیزی انتخاب نشود، تخفیف روی کل سبد اعمال می‌شود. با انتخاب چند مورد، کالایی که با هرکدام بخواند مشمول می‌شود.</p>
        <Chips title="دسته‌بندی‌ها" options={categories} selected={state.categoryIds} onToggle={(id) => set({ categoryIds: toggle(state.categoryIds, id) })} />
        <Chips title="برندها" options={brands} selected={state.brandIds} onToggle={(id) => set({ brandIds: toggle(state.brandIds, id) })} />
        <ProductPicker value={state.productIds} labels={state.productLabels} onChange={(ids, labels) => set({ productIds: ids, productLabels: labels })} />
      </div>
    </div>
  )
}

/** Converts the string-based form state to the payload the server validates. */
export function offerPayload(s: OfferState) {
  return {
    title: s.title,
    description: s.description,
    type: s.type,
    value: s.type === 'FREE_SHIPPING' ? 0 : Number(s.value || 0),
    maxDiscount: s.type === 'PERCENT' && s.maxDiscount.trim() ? Number(s.maxDiscount) : null,
    minSubtotal: Number(s.minSubtotal || 0),
    startsAt: s.startsAt,
    endsAt: s.endsAt,
    isActive: s.isActive,
    firstOrderOnly: s.firstOrderOnly,
    groupId: s.groupId || null,
    categoryIds: s.categoryIds,
    brandIds: s.brandIds,
    productIds: s.productIds,
  }
}
