'use client'

import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { toast } from '@/components/ui/toaster'
import { Drawer, FormSection } from '@/components/admin/kit'
import { saveExpiryConfigAction } from '@/app/actions/inventory'
import { validateExpiryConfig, type ExpiryConfigValues } from '@/lib/shop/expiry-rules'

const field = 'w-full min-h-11 rounded-xl border border-border bg-input px-3 py-2 text-sm'

const FIELDS: { key: keyof ExpiryConfigValues; label: string; hint: string }[] = [
  { key: 'soonDays', label: 'نزدیک به انقضا (روز)', hint: 'کمتر از این مقدار، بچ «نزدیک به انقضا» حساب می‌شود.' },
  { key: 'criticalDays', label: 'انقضای بحرانی (روز)', hint: 'باید کمتر از آستانه بالا باشد.' },
  { key: 'minShelfLifeDays', label: 'حداقل ماندگاری برای فروش (روز)', hint: 'بچ‌های کوتاه‌تر از این مقدار آنلاین فروخته نمی‌شوند.' },
  { key: 'discountStartDays', label: 'شروع تخفیف نزدیک انقضا (روز)', hint: 'مشمول تخفیف: مانده‌ی کمتر از این و بیشتر از حداقل ماندگاری.' },
  { key: 'discountPercent', label: 'درصد تخفیف', hint: 'عدد بین ۱ تا ۹۰.' },
]

export function ExpirySettings({ initial, phones, canEdit }: { initial: ExpiryConfigValues; phones: string[]; canEdit: boolean }) {
  const [open, setOpen] = useState(false)
  const [vals, setVals] = useState<Record<string, string>>(() => Object.fromEntries(Object.entries(initial).map(([k, v]) => [k, String(v)])))
  const [digest, setDigest] = useState(phones.join('\n'))
  const [pending, start] = useTransition()

  const numbers = (): ExpiryConfigValues => Object.fromEntries(FIELDS.map((f) => [f.key, Number(vals[f.key])])) as ExpiryConfigValues
  const problem = validateExpiryConfig(numbers())

  const save = () =>
    start(async () => {
      const res = await saveExpiryConfigAction({ ...numbers(), digestPhones: digest.split(/[\s,،]+/).filter(Boolean) })
      if (res.error) {
      toast.error(res.error)
      return
    }
      toast.success(res.message ?? 'ذخیره شد.')
      setOpen(false)
    })

  return (
    <>
      <Button variant="secondary" onClick={() => setOpen(true)} data-testid="expiry-settings-open">
        تنظیم آستانه‌ها
      </Button>
      <Drawer
        open={open}
        onOpenChange={setOpen}
        title="تنظیمات انقضا"
        footer={
          <Button variant="gold" onClick={save} disabled={!canEdit || pending || !!problem}>
            {canEdit ? 'ذخیره' : 'فقط مدیر می‌تواند تغییر دهد'}
          </Button>
        }
      >
        <FormSection title="آستانه‌ها" description="این مقدارها در برد موجودی، فروشگاه و هشدار روزانه یکسان به کار می‌روند.">
          <div className="space-y-4">
            {FIELDS.map((f) => (
              <label key={f.key} className="block text-sm font-bold">
                {f.label}
                <input className={field} dir="ltr" inputMode="numeric" disabled={!canEdit} value={vals[f.key]} onChange={(e) => setVals((v) => ({ ...v, [f.key]: e.target.value.replace(/[^\d]/g, '') }))} />
                <span className="mt-1 block text-xs font-normal text-muted-foreground">{f.hint}</span>
              </label>
            ))}
            {problem && (
              <p role="alert" className="text-sm font-bold text-red-400">
                {problem}
              </p>
            )}
          </div>
        </FormSection>
        <FormSection title="خلاصه‌ی روزانه" description="شماره موبایل کسانی که پیامک خلاصه‌ی انقضا را می‌گیرند؛ هر شماره در یک خط.">
          <textarea className={`${field} h-24`} dir="ltr" disabled={!canEdit} value={digest} onChange={(e) => setDigest(e.target.value)} />
        </FormSection>
      </Drawer>
    </>
  )
}
