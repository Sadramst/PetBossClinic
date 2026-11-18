'use client'

import { useEffect, useRef, useState } from 'react'
import { previewSegmentAction } from '@/app/actions/admin-club'
import type { SegmentRules } from '@/lib/club/segments'
import type { SegmentPreview } from '@/lib/club/segments'
import { Field } from '@/components/ui/field'
import { Input, Select } from '@/components/ui/input'
import { SPECIES_LABEL } from '@/lib/club/pet-math'
import { faNum } from '@/components/admin/format'

type Tier = { key: string; label: string }

const numOrUndef = (s: string): number | undefined => {
  const n = Number(s.replace(/[^\d]/g, ''))
  return s.trim() === '' || !Number.isFinite(n) ? undefined : n
}
const toggle = <T,>(list: T[] | undefined, x: T): T[] | undefined => {
  const cur = list ?? []
  const next = cur.includes(x) ? cur.filter((y) => y !== x) : [...cur, x]
  return next.length ? next : undefined
}

function Range({ label, value, onChange }: { label: string; value?: { min?: number; max?: number }; onChange: (v?: { min?: number; max?: number }) => void }) {
  const set = (k: 'min' | 'max', s: string) => {
    const n = numOrUndef(s)
    const next = { ...(value ?? {}), [k]: n }
    if (next.min === undefined) delete next.min
    if (next.max === undefined) delete next.max
    onChange(Object.keys(next).length ? next : undefined)
  }
  return (
    <fieldset className="min-w-0">
      <legend className="mb-1.5 text-sm font-bold">{label}</legend>
      <div className="grid grid-cols-2 gap-2">
        <Input aria-label={`${label}، از`} placeholder="از" inputMode="numeric" value={value?.min ?? ''} onChange={(e) => set('min', e.target.value)} />
        <Input aria-label={`${label}، تا`} placeholder="تا" inputMode="numeric" value={value?.max ?? ''} onChange={(e) => set('max', e.target.value)} />
      </div>
    </fieldset>
  )
}

function Tri({ label, value, onChange }: { label: string; value?: boolean; onChange: (v?: boolean) => void }) {
  return (
    <Field label={label}>
      <Select value={value === undefined ? '' : String(value)} onChange={(e) => onChange(e.target.value === '' ? undefined : e.target.value === 'true')}>
        <option value="">فرقی نمی‌کند</option>
        <option value="true">بله</option>
        <option value="false">خیر</option>
      </Select>
    </Field>
  )
}

export function RulesBuilder({ value, onChange, tiers }: { value: SegmentRules; onChange: (r: SegmentRules) => void; tiers: Tier[] }) {
  const set = (patch: Partial<SegmentRules>) => {
    const next: Record<string, unknown> = { ...value, ...patch }
    for (const k of Object.keys(next)) if (next[k] === undefined || next[k] === '') delete next[k]
    onChange(next as SegmentRules)
  }
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" data-testid="rules-builder">
      <fieldset className="sm:col-span-2 lg:col-span-3">
        <legend className="mb-1.5 text-sm font-bold">نوع حیوان خانگی</legend>
        <div className="flex flex-wrap gap-1.5">
          {Object.entries(SPECIES_LABEL).map(([k, l]) => {
            const on = value.species?.includes(k as never)
            return (
              <button key={k} type="button" aria-pressed={!!on} onClick={() => set({ species: toggle(value.species, k as never) })} className={`min-h-9 rounded-full border px-3 text-xs font-bold ${on ? 'border-primary bg-primary text-charcoal-950' : 'border-border bg-surface-elevated'}`}>
                {l}
              </button>
            )
          })}
        </div>
      </fieldset>
      <fieldset className="sm:col-span-2 lg:col-span-3">
        <legend className="mb-1.5 text-sm font-bold">سطح باشگاه</legend>
        <div className="flex flex-wrap gap-1.5">
          {tiers.map((t) => {
            const on = value.tier?.includes(t.key)
            return (
              <button key={t.key} type="button" aria-pressed={!!on} onClick={() => set({ tier: toggle(value.tier, t.key) })} className={`min-h-9 rounded-full border px-3 text-xs font-bold ${on ? 'border-primary bg-primary text-charcoal-950' : 'border-border bg-surface-elevated'}`}>
                {t.label}
              </button>
            )
          })}
        </div>
      </fieldset>
      <Field label="نژاد شامل"><Input value={value.breedContains ?? ''} onChange={(e) => set({ breedContains: e.target.value })} maxLength={40} /></Field>
      <Field label="برند غذای حیوان شامل"><Input value={value.foodBrandContains ?? ''} onChange={(e) => set({ foodBrandContains: e.target.value })} maxLength={60} /></Field>
      <Field label="شهر"><Input value={value.city ?? ''} onChange={(e) => set({ city: e.target.value })} maxLength={40} /></Field>
      <Range label="سن حیوان (ماه)" value={value.petAgeMonths} onChange={(v) => set({ petAgeMonths: v })} />
      <Range label="روز از آخرین سفارش" value={value.lastOrderDaysAgo} onChange={(v) => set({ lastOrderDaysAgo: v })} />
      <Range label="امتیاز فعلی" value={{ min: value.pointsMin, max: value.pointsMax }} onChange={(v) => set({ pointsMin: v?.min, pointsMax: v?.max })} />
      <Range label="مجموع خرید (تومان)" value={{ min: value.totalSpentMin, max: value.totalSpentMax }} onChange={(v) => set({ totalSpentMin: v?.min, totalSpentMax: v?.max })} />
      <Field label="حداقل تعداد سفارش"><Input inputMode="numeric" value={value.ordersCountMin ?? ''} onChange={(e) => set({ ordersCountMin: numOrUndef(e.target.value) })} /></Field>
      <Field label="ماه تولد مشتری">
        <Select value={value.birthdayMonth ?? ''} onChange={(e) => set({ birthdayMonth: e.target.value ? Number(e.target.value) : undefined })}>
          <option value="">فرقی نمی‌کند</option>
          {['فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور', 'مهر', 'آبان', 'آذر', 'دی', 'بهمن', 'اسفند'].map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
        </Select>
      </Field>
      <Field label="واکسن یا معاینه سررسید تا (روز)"><Input inputMode="numeric" value={value.vaccineDueWithinDays ?? ''} onChange={(e) => set({ vaccineDueWithinDays: numOrUndef(e.target.value) })} /></Field>
      <Field label="عضویت در ... روز اخیر"><Input inputMode="numeric" value={value.joinedWithinDays ?? ''} onChange={(e) => set({ joinedWithinDays: numOrUndef(e.target.value) })} /></Field>
      <Field label="برچسب (هرکدام)" hint="با ویرگول جدا کنید"><Input value={(value.tagsAny ?? []).join('، ')} onChange={(e) => set({ tagsAny: e.target.value.split(/[,،]/).map((s) => s.trim()).filter(Boolean).slice(0, 10) || undefined })} /></Field>
      <Tri label="حیوان ثبت کرده" value={value.hasPet} onChange={(v) => set({ hasPet: v })} />
      <Tri label="هرگز سفارش نداده" value={value.neverOrdered} onChange={(v) => set({ neverOrdered: v })} />
      <Tri label="کد تخفیف استفاده‌نشده دارد" value={value.hasUnusedCoupon} onChange={(v) => set({ hasUnusedCoupon: v })} />
      <Tri label="سبد رهاشده دارد" value={value.hasAbandonedCart} onChange={(v) => set({ hasAbandonedCart: v })} />
    </div>
  )
}

/** Live audience size and a sample; debounced so typing does not hammer the server. */
export function SegmentPreviewBox({ rules }: { rules: SegmentRules }) {
  const [data, setData] = useState<SegmentPreview | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const seq = useRef(0)
  const key = JSON.stringify(rules)

  useEffect(() => {
    const id = ++seq.current
    setLoading(true)
    const t = setTimeout(async () => {
      try {
        const r = await previewSegmentAction(JSON.parse(key))
        if (id !== seq.current) return
        if (r.ok && r.data) {
          setData(r.data)
          setError(null)
        } else setError(r.error ?? 'پیش‌نمایش انجام نشد.')
      } catch {
        if (id === seq.current) setError('پیش‌نمایش انجام نشد.')
      } finally {
        if (id === seq.current) setLoading(false)
      }
    }, 450)
    return () => clearTimeout(t)
  }, [key])

  return (
    <div className="rounded-2xl border border-border-gold bg-surface p-4" aria-live="polite" data-testid="segment-preview">
      {error ? (
        <p className="text-sm text-red-400">{error}</p>
      ) : !data ? (
        <p className="text-sm text-muted-foreground">در حال محاسبه…</p>
      ) : (
        <>
          <p className={`text-sm ${loading ? 'opacity-60' : ''}`}>
            <b className="text-2xl text-primary" data-testid="segment-count">{faNum(data.count)}</b> مشتری با این شرط‌ها
            {data.consentExcluded > 0 && <span className="text-xs text-muted-foreground"> ({faNum(data.consentExcluded)} نفر به‌دلیل نداشتن رضایت پیامک کنار گذاشته شدند)</span>}
          </p>
          {data.sample.length > 0 && (
            <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
              {data.sample.map((s) => <li key={s.id}>{s.name}{s.petNames.length ? ` · ${s.petNames.join('، ')}` : ''}</li>)}
            </ul>
          )}
        </>
      )}
    </div>
  )
}
