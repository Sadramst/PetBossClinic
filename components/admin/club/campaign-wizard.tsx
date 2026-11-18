'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from '@/i18n/routing'
import { draftMessageAction, previewCampaignAction, saveCampaignAction } from '@/app/actions/admin-club'
import type { CampaignPreview } from '@/lib/club/campaigns'
import type { SegmentRules } from '@/lib/club/segments'
import { countSegments, UNSUBSCRIBE_FOOTER } from '@/lib/club/messaging/rules'
import { TEMPLATE_VAR_HELP } from '@/lib/club/messaging/render'
import { Alert } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Field } from '@/components/ui/field'
import { Input, Select, Textarea } from '@/components/ui/input'
import { confirmDialog } from '@/components/ui/confirm-dialog'
import { toast } from '@/components/ui/toaster'
import { faNum } from '@/components/admin/format'
import { Card } from '@/components/admin/club/kit'
import { RulesBuilder, SegmentPreviewBox } from '@/components/admin/club/rules-builder'

const STEPS = ['مخاطبان', 'متن پیام', 'کد تخفیف', 'زمان‌بندی و ارسال']
const GOALS: [string, string][] = [['promo', 'پیشنهاد ویژه'], ['winback', 'بازگرداندن مشتری'], ['vaccine', 'یادآوری واکسن'], ['birthday', 'تولد'], ['repeatPurchase', 'خرید مجدد'], ['abandonedCart', 'سبد رهاشده'], ['tierUp', 'ارتقای سطح'], ['welcome', 'خوش‌آمدگویی']]

export function CampaignWizard({
  segments,
  tiers,
  initialSegmentId,
  onClose,
}: {
  segments: { id: string; name: string }[]
  tiers: { key: string; label: string }[]
  initialSegmentId?: string
  onClose: () => void
}) {
  const router = useRouter()
  const [step, setStep] = useState(0)
  const [name, setName] = useState('')
  const [segmentId, setSegmentId] = useState(initialSegmentId ?? '')
  const [rules, setRules] = useState<SegmentRules>({})
  const [body, setBody] = useState('سلام {name} عزیز، ')
  const [useCoupon, setUseCoupon] = useState(false)
  const [cType, setCType] = useState('PERCENT')
  const [cValue, setCValue] = useState('10')
  const [cMax, setCMax] = useState('150000')
  const [cMin, setCMin] = useState('0')
  const [cDays, setCDays] = useState('14')
  const [petBrand, setPetBrand] = useState(false)
  const [when, setWhen] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [goal, setGoal] = useState('promo')
  const [options, setOptions] = useState<string[]>([])
  const [src, setSrc] = useState<'ai' | 'fallback' | null>(null)
  const [preview, setPreview] = useState<CampaignPreview | null>(null)
  const bodyRef = useRef<HTMLTextAreaElement>(null)

  const coupon = useCoupon ? { type: cType, value: Number(cValue) || 0, maxDiscount: cType === 'PERCENT' ? Number(cMax) || null : null, minSubtotal: Number(cMin) || 0, validDays: Number(cDays) || 14, restrictToPetBrand: petBrand } : null
  const couponKey = JSON.stringify(coupon)
  const rulesKey = JSON.stringify(rules)

  // Live per-recipient preview while on the message / coupon steps.
  useEffect(() => {
    if (step < 1) return
    const t = setTimeout(async () => {
      const r = await previewCampaignAction({ rules: JSON.parse(rulesKey), segmentId: segmentId || null, body, couponTemplate: JSON.parse(couponKey) }).catch(() => null)
      if (r?.ok && r.data) setPreview(r.data)
    }, 500)
    return () => clearTimeout(t)
  }, [step, rulesKey, segmentId, body, couponKey])

  const insertVar = (k: string) => {
    const el = bodyRef.current
    const token = `{${k}}`
    if (!el) return setBody((b) => b + token)
    const s = el.selectionStart ?? body.length
    const e = el.selectionEnd ?? body.length
    setBody(body.slice(0, s) + token + body.slice(e))
    requestAnimationFrame(() => {
      el.focus()
      el.setSelectionRange(s + token.length, s + token.length)
    })
  }

  const draft = async () => {
    setBusy(true)
    const r = await draftMessageAction(goal, 'friendly', null).catch(() => null)
    setBusy(false)
    if (!r?.ok || !r.data) return void toast.error(r?.error ?? 'پیشنهاد گرفته نشد')
    setOptions(r.data.options)
    setSrc(r.data.source)
  }

  const seg = countSegments(`${body}\n${UNSUBSCRIBE_FOOTER}`)
  const audienceOk = !!segmentId || Object.keys(rules).filter((k) => k !== 'smsConsentOnly').length > 0 || true

  const submit = async (launch: boolean) => {
    setError(null)
    if (!name.trim()) return void setError('برای کمپین یک نام بنویسید.')
    if (launch) {
      const n = preview?.count ?? 0
      const ok = await confirmDialog({
        title: when ? 'زمان‌بندی کمپین؟' : 'ارسال کمپین؟',
        description: `پیام برای ${faNum(n)} نفر ${when ? 'در زمان تعیین‌شده ' : ''}در صف ارسال قرار می‌گیرد.${preview && preview.consentExcluded > 0 ? ` ${faNum(preview.consentExcluded)} نفر به‌دلیل نداشتن رضایت پیامک کنار گذاشته شده‌اند.` : ''} ارسال بین ساعت ۹ تا ۲۱ انجام می‌شود و پس از شروع فقط می‌توان پیام‌های در صف را لغو کرد.`,
        confirmLabel: when ? 'زمان‌بندی' : 'شروع ارسال',
      })
      if (!ok) return
    }
    setBusy(true)
    const r = await saveCampaignAction({
      name,
      body,
      segmentId: segmentId || null,
      rules: segmentId ? undefined : rules,
      couponTemplate: coupon,
      scheduledFor: when ? new Date(when).toISOString() : null,
      launch,
    }).catch(() => null)
    setBusy(false)
    if (!r?.ok || !r.data) return void setError(r?.error ?? 'ذخیره انجام نشد.')
    toast.success(launch ? `${faNum(r.data.enqueued ?? 0)} پیام در صف قرار گرفت` : 'پیش‌نویس ذخیره شد')
    router.push(`/admin/campaigns/${r.data.id}`)
  }

  return (
    <Card title="کمپین پیامکی جدید" actions={<button type="button" className="text-xs text-muted-foreground" onClick={onClose}>بستن</button>}>
      <ol className="mb-5 flex flex-wrap gap-2 text-xs" aria-label="مراحل">
        {STEPS.map((s, i) => (
          <li key={s}>
            <button type="button" onClick={() => setStep(i)} aria-current={i === step ? 'step' : undefined} className={`min-h-9 rounded-full border px-3 font-bold ${i === step ? 'border-primary bg-primary text-charcoal-950' : 'border-border bg-surface-elevated'}`}>
              {faNum(i + 1)}. {s}
            </button>
          </li>
        ))}
      </ol>
      {error && <div className="mb-3"><Alert tone="error" data-testid="wizard-error">{error}</Alert></div>}

      {step === 0 && (
        <div className="space-y-4" data-testid="wizard-audience">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="نام کمپین (فقط برای شما)" required><Input value={name} onChange={(e) => setName(e.target.value)} maxLength={80} data-testid="campaign-name" /></Field>
            <Field label="گروه ذخیره‌شده" hint="یا خالی بگذارید و شرط‌ها را همین‌جا بسازید.">
              <Select value={segmentId} onChange={(e) => setSegmentId(e.target.value)} data-testid="campaign-segment">
                <option value="">شرط‌های دلخواه</option>
                {segments.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </Select>
            </Field>
          </div>
          {!segmentId && <RulesBuilder value={rules} onChange={setRules} tiers={tiers} />}
          {!segmentId && audienceOk && <SegmentPreviewBox rules={rules} />}
        </div>
      )}

      {step === 1 && (
        <div className="grid gap-4 lg:grid-cols-2" data-testid="wizard-message">
          <div className="space-y-3">
            <div className="flex flex-wrap items-end gap-2">
              <Field label="پیشنهاد متن با هوش مصنوعی" className="min-w-40 flex-1"><Select value={goal} onChange={(e) => setGoal(e.target.value)}>{GOALS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</Select></Field>
              <Button type="button" variant="outline" onClick={draft} disabled={busy} data-testid="wizard-ai">پیشنهاد بده</Button>
            </div>
            {options.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground">{src === 'ai' ? 'نوشته‌شده توسط هوش مصنوعی (هیچ نام یا شماره‌ای ارسال نشد):' : 'پیشنهادهای آماده:'}</p>
                {options.map((o, i) => <button key={i} type="button" onClick={() => setBody(o)} className="block w-full rounded-xl border border-border bg-surface p-3 text-start text-sm leading-7 hover:border-primary">{o}</button>)}
              </div>
            )}
            <Field label="متن پیامک" required>
              <Textarea ref={bodyRef} value={body} onChange={(e) => setBody(e.target.value)} rows={5} maxLength={640} data-testid="campaign-body" />
            </Field>
            <div className="flex flex-wrap gap-1.5" aria-label="متغیرها">
              {Object.entries(TEMPLATE_VAR_HELP).map(([k, l]) => (
                <button key={k} type="button" title={l} onClick={() => insertVar(k)} className="min-h-8 rounded-full border border-border bg-surface-elevated px-2.5 text-xs hover:border-primary">{`{${k}}`} <span className="text-muted-foreground">{l}</span></button>
              ))}
            </div>
            <p className="text-xs text-muted-foreground" data-testid="sms-counter">{faNum(seg.chars)} نویسه (با عبارت لغو) · {faNum(seg.segments)} پیامک · انتهای هر پیام «{UNSUBSCRIBE_FOOTER}» افزوده می‌شود.</p>
          </div>
          <PreviewPane preview={preview} />
        </div>
      )}

      {step === 2 && (
        <div className="space-y-3" data-testid="wizard-coupon">
          <label className="flex items-center gap-2 text-sm font-bold">
            <input type="checkbox" checked={useCoupon} onChange={(e) => setUseCoupon(e.target.checked)} className="h-4 w-4 accent-[var(--color-primary,#c9a45c)]" data-testid="coupon-toggle" /> برای هر مخاطب یک کد تخفیف شخصی و یک‌بارمصرف ساخته شود
          </label>
          {useCoupon && (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Field label="نوع"><Select value={cType} onChange={(e) => setCType(e.target.value)}><option value="PERCENT">درصدی</option><option value="FIXED">مبلغ ثابت</option><option value="FREE_SHIPPING">ارسال رایگان</option></Select></Field>
              {cType !== 'FREE_SHIPPING' && <Field label={cType === 'PERCENT' ? 'درصد' : 'مبلغ (تومان)'}><Input inputMode="numeric" value={cValue} onChange={(e) => setCValue(e.target.value)} /></Field>}
              {cType === 'PERCENT' && <Field label="سقف تخفیف"><Input inputMode="numeric" value={cMax} onChange={(e) => setCMax(e.target.value)} /></Field>}
              <Field label="حداقل خرید"><Input inputMode="numeric" value={cMin} onChange={(e) => setCMin(e.target.value)} /></Field>
              <Field label="اعتبار (روز)"><Input inputMode="numeric" value={cDays} onChange={(e) => setCDays(e.target.value)} /></Field>
              <label className="flex items-start gap-2 text-sm sm:col-span-2 lg:col-span-4">
                <input type="checkbox" checked={petBrand} onChange={(e) => setPetBrand(e.target.checked)} className="mt-1 h-4 w-4 accent-[var(--color-primary,#c9a45c)]" />
                <span>محدود به برند غذای حیوان هر مشتری <span className="block text-xs text-muted-foreground">مشتری‌هایی که برند غذای حیوانشان ثبت نشده یا در فروشگاه نیست، پیام نمی‌گیرند.</span></span>
              </label>
            </div>
          )}
          {useCoupon && !/\{code\}/.test(body) && <Alert tone="warning">کد تخفیف فعال است ولی متن پیام {'{code}'} ندارد؛ مشتری کد را نمی‌بیند.</Alert>}
          <PreviewPane preview={preview} />
        </div>
      )}

      {step === 3 && (
        <div className="space-y-4" data-testid="wizard-send">
          <Field label="زمان ارسال" hint="خالی = همین حالا. پیام‌ها بین ۹ تا ۲۱ ارسال می‌شوند و هر مشتری در روز بیش از یک پیام تبلیغاتی نمی‌گیرد."><Input type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} className="max-w-xs" /></Field>
          <div className="rounded-xl border border-border bg-surface p-3 text-sm leading-7">
            <p>مخاطبان: <b>{faNum(preview?.count ?? 0)}</b> نفر{preview && preview.consentExcluded > 0 ? ` (${faNum(preview.consentExcluded)} نفر بدون رضایت پیامک کنار گذاشته می‌شوند)` : ''}</p>
            <p>طول پیام: {faNum(seg.segments)} پیامک · کد تخفیف: {useCoupon ? 'دارد' : 'ندارد'}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="gold" loading={busy} onClick={() => submit(true)} data-testid="campaign-launch">{when ? 'زمان‌بندی ارسال' : 'ارسال کمپین'}</Button>
            <Button variant="secondary" disabled={busy} onClick={() => submit(false)} data-testid="campaign-draft">ذخیره پیش‌نویس</Button>
          </div>
        </div>
      )}

      <div className="mt-5 flex justify-between border-t border-border pt-4">
        <Button variant="ghost" disabled={step === 0} onClick={() => setStep((s) => s - 1)}>قبلی</Button>
        {step < STEPS.length - 1 && <Button variant="outline" onClick={() => setStep((s) => s + 1)} data-testid="wizard-next">بعدی</Button>}
      </div>
    </Card>
  )
}

function PreviewPane({ preview }: { preview: CampaignPreview | null }) {
  return (
    <div className="min-w-0 space-y-2" aria-live="polite" data-testid="wizard-preview">
      <p className="text-sm font-bold">پیش‌نمایش برای مخاطبان واقعی {preview ? `(${faNum(preview.count)} نفر)` : ''}</p>
      {!preview ? <p className="text-xs text-muted-foreground">در حال ساخت پیش‌نمایش…</p> : preview.sample.length === 0 ? <p className="text-xs text-muted-foreground">هنوز مخاطبی با این شرط‌ها و رضایت پیامک وجود ندارد.</p> : preview.sample.map((s) => (
        <div key={s.id} className="rounded-xl border border-border bg-surface p-3 text-sm">
          <p className="mb-1 text-xs text-muted-foreground">{s.name}{s.petNames.length ? ` · ${s.petNames.join('، ')}` : ''} · {faNum(s.chars)} نویسه</p>
          <p className="whitespace-pre-wrap break-words leading-7">{s.text}</p>
          {s.wouldSkip && <p className="mt-1 text-xs text-amber-400">این مشتری پیام نمی‌گیرد: برند غذای حیوانش مشخص یا در فروشگاه موجود نیست.</p>}
        </div>
      ))}
    </div>
  )
}
