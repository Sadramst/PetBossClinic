'use client'

import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog } from '@/components/ui/dialog'
import { Field } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Alert } from '@/components/ui/alert'
import { toast } from '@/components/ui/toaster'
import { bulkGenerateCouponsAction, saveCouponAction } from '@/app/actions/admin-marketing'
import { toTehranLocalInput } from '@/lib/marketing/admin-validators'
import type { CouponRow } from '@/lib/marketing/admin-queries'
import { Check, EMPTY_OFFER, OfferFields, offerPayload, type Option, type OfferState } from './offer-fields'
import { downloadText } from './download'

export interface FormOptions {
  categories: Option[]
  brands: Option[]
  groups: Option[]
}

function fromRow(c: CouponRow): OfferState & { code: string; autoApply: boolean; usageLimit: string; perCustomerLimit: string; customerPhone: string } {
  return {
    code: c.code,
    title: c.title,
    description: c.description ?? '',
    type: c.type,
    value: String(c.value),
    maxDiscount: c.maxDiscount != null ? String(c.maxDiscount) : '',
    minSubtotal: String(c.minSubtotal),
    startsAt: toTehranLocalInput(c.startsAt),
    endsAt: toTehranLocalInput(c.endsAt),
    isActive: c.isActive,
    firstOrderOnly: c.firstOrderOnly,
    groupId: c.groupId ?? '',
    categoryIds: c.categoryIds,
    brandIds: c.brandIds,
    productIds: c.productIds,
    productLabels: c.productLabels,
    autoApply: c.autoApply,
    usageLimit: c.usageLimit != null ? String(c.usageLimit) : '',
    perCustomerLimit: c.perCustomerLimit != null ? String(c.perCustomerLimit) : '',
    customerPhone: c.customerPhone ?? '',
  }
}

const BLANK = { ...EMPTY_OFFER, code: '', autoApply: false, usageLimit: '', perCustomerLimit: '1', customerPhone: '' }

export function CouponDialog({ open, editing, options, onClose, onSaved }: { open: boolean; editing: CouponRow | null; options: FormOptions; onClose: () => void; onSaved: () => void }) {
  // The parent remounts this component per open (key), so initial state is enough.
  const [s, setS] = useState(() => (editing ? fromRow(editing) : BLANK))
  const [error, setError] = useState<string | null>(null)
  const [pending, start] = useTransition()
  const set = (patch: Partial<typeof s>) => setS((p) => ({ ...p, ...patch }))

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    start(async () => {
      const res = await saveCouponAction(editing?.id ?? null, {
        ...offerPayload(s),
        code: s.code,
        autoApply: s.autoApply,
        usageLimit: s.usageLimit.trim() ? Number(s.usageLimit) : null,
        perCustomerLimit: s.perCustomerLimit.trim() ? Number(s.perCustomerLimit) : null,
        customerPhone: s.customerPhone,
      })
      if (!res.ok) {
        setError(res.error ?? 'ذخیره انجام نشد.')
        return
      }
      toast.success(editing ? 'کد تخفیف به‌روز شد' : 'کد تخفیف ساخته شد', res.data?.code)
      onSaved()
    })
  }

  return (
    <Dialog open={open} onClose={onClose} dismissible={!pending} size="lg" title={editing ? 'ویرایش کد تخفیف' : 'کد تخفیف جدید'} description="همه شرط‌ها هنگام ثبت سفارش دوباره روی سرور بررسی می‌شوند.">
      <form onSubmit={submit} className="space-y-4" data-testid="coupon-form" noValidate>
        {error && <Alert tone="error" data-testid="coupon-form-error">{error}</Alert>}
        <Field label="کد" optional hint="حروف انگلیسی، عدد و خط تیره. خالی بگذارید تا کد تصادفی ساخته شود. کد پس از اولین استفاده تغییر نمی‌کند.">
          <Input value={s.code} onChange={(e) => set({ code: e.target.value.toUpperCase() })} dir="ltr" className="text-end font-mono" maxLength={40} data-testid="coupon-form-code" />
        </Field>

        <OfferFields state={s} set={(p) => set(p)} categories={options.categories} brands={options.brands} groups={options.groups} />

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="سقف کل استفاده" optional hint="مثلاً ۱۰۰ برای «۱۰۰ خریدار اول». خالی یعنی نامحدود.">
            <Input type="number" inputMode="numeric" min={1} value={s.usageLimit} onChange={(e) => set({ usageLimit: e.target.value })} data-testid="coupon-form-usage-limit" />
          </Field>
          <Field label="سقف استفاده هر مشتری" optional>
            <Input type="number" inputMode="numeric" min={1} value={s.perCustomerLimit} onChange={(e) => set({ perCustomerLimit: e.target.value })} />
          </Field>
        </div>

        <Field label="مخصوص یک مشتری (کد شخصی)" optional hint="موبایل مشتری ثبت‌نام‌شده. فقط خود او می‌تواند از این کد استفاده کند.">
          <Input value={s.customerPhone} onChange={(e) => set({ customerPhone: e.target.value })} inputMode="tel" dir="ltr" className="text-end" placeholder="09123456789" />
        </Field>

        <Check label="اعمال خودکار" checked={s.autoApply} onChange={(v) => set({ autoApply: v })} hint="بدون وارد کردن کد، بهترین تخفیف خودکار مجاز روی سبد اعمال می‌شود." />

        <div className="flex flex-col-reverse gap-2 border-t border-border pt-4 sm:flex-row sm:justify-end">
          <Button type="button" variant="secondary" onClick={onClose} disabled={pending}>
            انصراف
          </Button>
          <Button type="submit" variant="gold" loading={pending} data-testid="coupon-form-submit">
            {editing ? 'ذخیره تغییرات' : 'ساخت کد'}
          </Button>
        </div>
      </form>
    </Dialog>
  )
}

export function BulkDialog({ open, options, onClose, onDone }: { open: boolean; options: FormOptions; onClose: () => void; onDone: () => void }) {
  const [s, setS] = useState<OfferState>({ ...EMPTY_OFFER, firstOrderOnly: false })
  const [count, setCount] = useState('50')
  const [prefix, setPrefix] = useState('PB')
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState<{ count: number; csv: string } | null>(null)
  const [pending, start] = useTransition()

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    start(async () => {
      const res = await bulkGenerateCouponsAction({ count: Number(count), prefix, template: offerPayload(s) })
      if (!res.ok || !res.data) {
        setError(res.error ?? 'ساخت کدها انجام نشد.')
        return
      }
      setDone({ count: res.data.count, csv: res.data.csv })
      downloadText(`coupons-${res.data.batchId.slice(0, 8)}.csv`, res.data.csv)
      onDone()
    })
  }

  return (
    <Dialog open={open} onClose={onClose} dismissible={!pending} size="lg" title="ساخت گروهی کد یک‌بارمصرف" description="هر کد فقط یک بار و فقط برای یک نفر قابل استفاده است؛ مناسب هدیه، پیامک و کارت‌های تبلیغاتی.">
      {done ? (
        <div className="space-y-4" data-testid="bulk-done">
          <Alert tone="success" title={`${done.count.toLocaleString('fa-IR')} کد ساخته شد`}>
            فایل CSV کدها دانلود شد. اگر دانلود شروع نشد، دکمه زیر را بزنید. بعداً هم از بخش «دسته‌های ساخته‌شده» می‌توانید دوباره بگیرید.
          </Alert>
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button variant="secondary" onClick={onClose}>
              بستن
            </Button>
            <Button variant="gold" onClick={() => downloadText('coupons.csv', done.csv)}>
              دانلود دوباره CSV
            </Button>
          </div>
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-4" noValidate data-testid="bulk-form">
          {error && <Alert tone="error">{error}</Alert>}
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="تعداد کد" required hint="حداکثر ۱٬۰۰۰ کد در هر بار.">
              <Input type="number" inputMode="numeric" min={1} max={1000} value={count} onChange={(e) => setCount(e.target.value)} data-testid="bulk-count" />
            </Field>
            <Field label="پیشوند کد" optional hint="مثلاً GIFT ← GIFT-7KQ2-M9XD">
              <Input value={prefix} onChange={(e) => setPrefix(e.target.value.toUpperCase())} dir="ltr" className="text-end font-mono" maxLength={10} />
            </Field>
          </div>
          <OfferFields state={s} set={(p) => setS((x) => ({ ...x, ...p }))} categories={options.categories} brands={options.brands} groups={options.groups} />
          <div className="flex flex-col-reverse gap-2 border-t border-border pt-4 sm:flex-row sm:justify-end">
            <Button type="button" variant="secondary" onClick={onClose} disabled={pending}>
              انصراف
            </Button>
            <Button type="submit" variant="gold" loading={pending} data-testid="bulk-submit">
              ساخت و دانلود CSV
            </Button>
          </div>
        </form>
      )}
    </Dialog>
  )
}
