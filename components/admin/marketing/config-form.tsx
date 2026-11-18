'use client'

import { useState, useTransition } from 'react'
import { useRouter } from '@/i18n/routing'
import { Button } from '@/components/ui/button'
import { Field } from '@/components/ui/field'
import { Input, Select, Textarea } from '@/components/ui/input'
import { Alert } from '@/components/ui/alert'
import { toast } from '@/components/ui/toaster'
import { saveMarketingConfigAction } from '@/app/actions/admin-marketing'
import { describeOffer } from '@/lib/marketing/coupon-rules'
import { faNum } from '@/components/admin/format'
import { Check } from './offer-fields'

export interface ConfigState {
  popupEnabled: boolean
  popupTitle: string
  popupText: string
  popupDelaySeconds: number
  welcomeEnabled: boolean
  welcomeType: 'PERCENT' | 'FIXED' | 'FREE_SHIPPING'
  welcomeValue: number
  welcomeMaxDiscount: number | null
  welcomeMinSubtotal: number
  welcomeValidDays: number
  bannerEnabled: boolean
  bannerText: string
  bannerLink: string
  /** datetime-local value in Tehran time */
  bannerEndsAt: string
  bannerCouponCode: string
}

const num = (v: string) => (v.trim() === '' ? 0 : Number(v))

export function ConfigForm({ initial }: { initial: ConfigState }) {
  const router = useRouter()
  const [s, setS] = useState(initial)
  const [error, setError] = useState<string | null>(null)
  const [pending, start] = useTransition()
  const set = (p: Partial<ConfigState>) => setS((x) => ({ ...x, ...p }))

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    start(async () => {
      const res = await saveMarketingConfigAction({ ...s, welcomeMaxDiscount: s.welcomeType === 'PERCENT' ? s.welcomeMaxDiscount : null })
      if (!res.ok) return void setError(res.error ?? 'ذخیره انجام نشد.')
      toast.success('تنظیمات کمپین ذخیره شد')
      router.refresh()
    })
  }

  const offer = s.welcomeEnabled ? describeOffer({ type: s.welcomeType, value: s.welcomeValue, maxDiscount: s.welcomeMaxDiscount }) : null

  return (
    <form onSubmit={submit} className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_20rem]" noValidate data-testid="config-form">
      <div className="min-w-0 space-y-5">
        {error && <Alert tone="error" data-testid="config-error">{error}</Alert>}

        <section className="space-y-4 rounded-2xl border border-border bg-surface-card p-4">
          <h2 className="text-sm font-extrabold">پنجره خوش‌آمد (جمع‌آوری مخاطب)</h2>
          <Check label="نمایش پنجره به بازدیدکنندگان" checked={s.popupEnabled} onChange={(v) => set({ popupEnabled: v })} testId="config-popup-enabled" />
          <Field label="عنوان" required>
            <Input value={s.popupTitle} onChange={(e) => set({ popupTitle: e.target.value })} maxLength={80} data-testid="config-popup-title" />
          </Field>
          <Field label="متن" required>
            <Textarea rows={3} value={s.popupText} onChange={(e) => set({ popupText: e.target.value })} maxLength={240} />
          </Field>
          <Field label="تأخیر نمایش (ثانیه)" hint="۰ یعنی بلافاصله.">
            <Input type="number" inputMode="numeric" min={0} max={300} value={s.popupDelaySeconds} onChange={(e) => set({ popupDelaySeconds: num(e.target.value) })} />
          </Field>
        </section>

        <section className="space-y-4 rounded-2xl border border-border bg-surface-card p-4">
          <h2 className="text-sm font-extrabold">هدیه خوش‌آمد (کد شخصی یک‌بارمصرف)</h2>
          <Check label="برای هر مخاطب جدید یک کد شخصی بساز" checked={s.welcomeEnabled} onChange={(v) => set({ welcomeEnabled: v })} hint="هر شماره یا ایمیل فقط یک کد می‌گیرد؛ ثبت دوباره همان کد را برمی‌گرداند." testId="config-welcome-enabled" />
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="نوع تخفیف">
              <Select value={s.welcomeType} onChange={(e) => set({ welcomeType: e.target.value as ConfigState['welcomeType'] })} data-testid="config-welcome-type">
                <option value="PERCENT">درصدی</option>
                <option value="FIXED">مبلغ ثابت (تومان)</option>
                <option value="FREE_SHIPPING">ارسال رایگان</option>
              </Select>
            </Field>
            {s.welcomeType !== 'FREE_SHIPPING' && (
              <Field label={s.welcomeType === 'PERCENT' ? 'درصد تخفیف' : 'مبلغ تخفیف (تومان)'}>
                <Input type="number" inputMode="numeric" min={1} value={s.welcomeValue} onChange={(e) => set({ welcomeValue: num(e.target.value) })} data-testid="config-welcome-value" />
              </Field>
            )}
            {s.welcomeType === 'PERCENT' && (
              <Field label="سقف تخفیف (تومان)" optional>
                <Input type="number" inputMode="numeric" min={1} value={s.welcomeMaxDiscount ?? ''} onChange={(e) => set({ welcomeMaxDiscount: e.target.value.trim() ? Number(e.target.value) : null })} />
              </Field>
            )}
            <Field label="حداقل مبلغ خرید (تومان)" optional>
              <Input type="number" inputMode="numeric" min={0} value={s.welcomeMinSubtotal} onChange={(e) => set({ welcomeMinSubtotal: num(e.target.value) })} />
            </Field>
            <Field label="اعتبار کد (روز)" hint="از لحظه ساخته شدن کد.">
              <Input type="number" inputMode="numeric" min={1} max={365} value={s.welcomeValidDays} onChange={(e) => set({ welcomeValidDays: num(e.target.value) })} />
            </Field>
          </div>
        </section>

        <section className="space-y-4 rounded-2xl border border-border bg-surface-card p-4">
          <h2 className="text-sm font-extrabold">بنر اعلان بالای سایت</h2>
          <Check label="نمایش بنر" checked={s.bannerEnabled} onChange={(v) => set({ bannerEnabled: v })} testId="config-banner-enabled" />
          <Field label="متن بنر" hint="کوتاه و گویا؛ مثلاً «ارسال رایگان تا پایان هفته».">
            <Input value={s.bannerText} onChange={(e) => set({ bannerText: e.target.value })} maxLength={160} data-testid="config-banner-text" />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="پیوند" optional hint="مثلاً /shop یا https://…">
              <Input value={s.bannerLink} onChange={(e) => set({ bannerLink: e.target.value })} dir="ltr" className="text-end" maxLength={300} />
            </Field>
            <Field label="کد قابل کپی روی بنر" optional hint="باید قبلاً ساخته شده باشد.">
              <Input value={s.bannerCouponCode} onChange={(e) => set({ bannerCouponCode: e.target.value.toUpperCase() })} dir="ltr" className="text-end font-mono" maxLength={40} />
            </Field>
          </div>
          <Field label="پایان نمایش (شمارش معکوس)" optional hint="به وقت تهران؛ بعد از این زمان بنر خودکار پنهان می‌شود.">
            <Input type="datetime-local" value={s.bannerEndsAt} onChange={(e) => set({ bannerEndsAt: e.target.value })} dir="ltr" className="text-end" />
          </Field>
        </section>

        <Button type="submit" variant="gold" loading={pending} data-testid="config-save">
          ذخیره تنظیمات
        </Button>
      </div>

      <aside className="lg:sticky lg:top-4 lg:self-start" aria-label="پیش‌نمایش پنجره خوش‌آمد">
        <p className="mb-2 text-xs font-bold text-muted-foreground">پیش‌نمایش زنده</p>
        <div className="rounded-2xl border border-border-gold bg-surface-card p-5 text-center shadow-lg" data-testid="config-preview">
          {s.popupEnabled ? (
            <>
              <h3 className="text-base font-extrabold text-primary">{s.popupTitle || 'عنوان پنجره'}</h3>
              <p className="mt-2 text-sm leading-7 text-muted-foreground">{s.popupText || 'متن پنجره'}</p>
              <div className="mt-4 rounded-xl border border-border bg-input px-3 py-2.5 text-sm text-muted-foreground">موبایل یا ایمیل شما</div>
              <div className="mt-3 rounded-xl bg-gradient-gold px-4 py-2.5 text-sm font-extrabold text-charcoal-950">دریافت کد تخفیف</div>
              {offer && <p className="mt-3 text-xs text-muted-foreground">هدیه: {offer}{s.welcomeMinSubtotal > 0 ? ` (حداقل خرید ${faNum(s.welcomeMinSubtotal)} تومان)` : ''}، {faNum(s.welcomeValidDays)} روز اعتبار</p>}
            </>
          ) : (
            <p className="text-sm text-muted-foreground">پنجره خوش‌آمد خاموش است و به بازدیدکنندگان نمایش داده نمی‌شود.</p>
          )}
        </div>
        {s.bannerEnabled && s.bannerText && (
          <div className="mt-3 rounded-xl bg-primary/15 px-3 py-2 text-center text-xs font-bold text-primary" data-testid="config-banner-preview">
            {s.bannerText}
            {s.bannerCouponCode && <span className="ms-2 font-mono" dir="ltr">{s.bannerCouponCode}</span>}
          </div>
        )}
      </aside>
    </form>
  )
}
