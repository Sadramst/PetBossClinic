'use client'

import { useActionState, useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { createLeadAction, LeadActionState } from '@/app/actions/leads'
import { Alert } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Field } from '@/components/ui/field'
import { Input, Select, Textarea } from '@/components/ui/input'

export interface LeadFormProps {
  variant?: 'inline' | 'modal' | 'sticky'
  serviceInterest?: string
  source?: string
  title?: string
  subtitle?: string
  buttonText?: string
  className?: string
  phone?: string
  telLink?: string
  onSuccess?: () => void
}

const SERVICE_OPTIONS = [
  { value: 'vaccination', label: 'واکسیناسیون و پیشگیری' },
  { value: 'surgery', label: 'جراحی تخصصی و عقیم‌سازی' },
  { value: 'grooming', label: 'گرومینگ، اصلاح و شست‌وشو' },
  { value: 'internal-medicine', label: 'درمان بیماری‌های داخلی' },
  { value: 'dentistry', label: 'دندانپزشکی و جرم‌گیری' },
  { value: 'checkup', label: 'چکاپ دوره‌ای و سلامت' },
  { value: 'shop', label: 'پت‌شاپ و رژیم غذایی' },
]

export function LeadForm({
  variant = 'inline',
  serviceInterest,
  source = 'WEBSITE_CONTACT',
  title,
  subtitle,
  buttonText,
  className = '',
  phone,
  telLink,
  onSuccess,
}: LeadFormProps) {
  const t = useTranslations('Contact')

  const [utmParams, setUtmParams] = useState({
    utmSource: '',
    utmMedium: '',
    utmCamp: '',
    utmTerm: '',
    utmContent: '',
    referrer: '',
    landingPage: '',
  })

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search)
    setUtmParams({
      utmSource: urlParams.get('utm_source') || '',
      utmMedium: urlParams.get('utm_medium') || '',
      utmCamp: urlParams.get('utm_campaign') || '',
      utmTerm: urlParams.get('utm_term') || '',
      utmContent: urlParams.get('utm_content') || '',
      referrer: document.referrer || '',
      landingPage: window.location.pathname || '',
    })
  }, [])

  const initialState: LeadActionState = {}
  const [state, formAction, isPending] = useActionState(createLeadAction, initialState)

  useEffect(() => {
    if (state?.success && onSuccess) {
      onSuccess()
    }
  }, [state?.success, onSuccess])

  return (
    <div
      className={`relative rounded-2xl ${
        variant === 'sticky'
          ? 'p-4 bg-surface/95 backdrop-blur-md border border-border-gold shadow-gold-lg'
          : variant === 'modal'
          ? 'p-5 sm:p-6 bg-surface border border-border-gold'
          : 'p-4 sm:p-8 bg-surface-card border border-border/80 shadow-gold'
      } ${className}`}
    >
      {(title || subtitle) && (
        <div className="mb-5">
          {title && <h2 className="text-lg font-black text-foreground sm:text-xl">{title}</h2>}
          {subtitle && <p className="mt-1 text-sm leading-7 text-muted-foreground">{subtitle}</p>}
        </div>
      )}

      {state?.success ? (
        <div role="status" className="animate-fade-in space-y-3 px-2 py-8 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border border-emerald-500/30 bg-emerald-500/15 text-emerald-400">
            <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M20 6 9 17l-5-5" />
            </svg>
          </div>
          <h3 className="text-lg font-bold text-foreground">درخواست شما ثبت شد</h3>
          <p className="mx-auto max-w-sm text-sm leading-7 text-muted-foreground">{state.message}</p>
          <p className="pt-1 text-xs leading-6 text-muted-foreground">
            {phone && telLink ? (
              <>
                نیاز به مشاوره فوری دارید؟{' '}
                <a href={telLink} dir="ltr" className="ms-1 inline-block font-bold text-primary hover:underline">
                  {phone}
                </a>
              </>
            ) : (
              'همکاران ما به‌زودی با شما تماس می‌گیرند.'
            )}
          </p>
        </div>
      ) : (
        <form action={formAction} className="space-y-4">
          <input type="hidden" name="locale" value="fa" />
          <input type="hidden" name="source" value={source} />
          <input type="hidden" name="utmSource" value={utmParams.utmSource} />
          <input type="hidden" name="utmMedium" value={utmParams.utmMedium} />
          <input type="hidden" name="utmCamp" value={utmParams.utmCamp} />
          <input type="hidden" name="utmTerm" value={utmParams.utmTerm} />
          <input type="hidden" name="utmContent" value={utmParams.utmContent} />
          <input type="hidden" name="referrer" value={utmParams.referrer} />
          <input type="hidden" name="landingPage" value={utmParams.landingPage} />
          {serviceInterest && <input type="hidden" name="serviceInterest" value={serviceInterest} />}

          {/* Honeypot: hidden from people, filled by bots. */}
          <div style={{ display: 'none' }} aria-hidden="true">
            <label htmlFor="hp_website">این قسمت را خالی بگذارید</label>
            <input id="hp_website" type="text" name="website" tabIndex={-1} autoComplete="off" />
          </div>

          {state?.error && (
            <Alert tone="error">
              <p className="font-semibold">{state.error}</p>
              {state.fallbackPhone && (
                <p className="mt-1">
                  تماس مستقیم با پذیرش:{' '}
                  <a href={`tel:${state.fallbackPhone}`} dir="ltr" className="ms-1 inline-block font-bold text-primary underline">
                    {state.fallbackPhoneDisplay || state.fallbackPhone}
                  </a>
                </p>
              )}
            </Alert>
          )}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label={t('name')} error={state?.fieldErrors?.name?.[0]}>
              <Input type="text" name="name" autoComplete="name" disabled={isPending} placeholder={t('namePlaceholder')} />
            </Field>
            <Field label={t('phone')} required error={state?.fieldErrors?.phone?.[0]}>
              <Input
                type="tel"
                name="phone"
                required
                inputMode="tel"
                autoComplete="tel"
                disabled={isPending}
                placeholder="۰۹۱۲... یا ۰۲۱..."
                dir="ltr"
                className="text-end placeholder:text-end"
              />
            </Field>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label={t('email')} optional error={state?.fieldErrors?.email?.[0]}>
              <Input
                type="email"
                name="email"
                inputMode="email"
                autoComplete="email"
                disabled={isPending}
                placeholder={t('emailPlaceholder')}
                dir="ltr"
                className="text-end placeholder:text-end"
              />
            </Field>
            <Field label="نوع حیوان و نژاد" optional>
              <Input type="text" name="petType" disabled={isPending} placeholder="مثال: گربه پرشین، سگ گلدن" />
            </Field>
          </div>

          {!serviceInterest && (
            <Field label="خدمت مورد نظر" optional>
              <Select name="serviceInterest" disabled={isPending} defaultValue="">
                <option value="">انتخاب کنید</option>
                {SERVICE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </Select>
            </Field>
          )}

          <Field label={t('message')} error={state?.fieldErrors?.message?.[0]}>
            <Textarea name="message" rows={4} disabled={isPending} placeholder={t('messagePlaceholder')} />
          </Field>

          <Button type="submit" variant="gold" size="lg" block loading={isPending} loadingText="در حال ثبت درخواست…">
            {buttonText || t('send')}
          </Button>

          <p className="text-center text-xs leading-6 text-muted-foreground">
            اطلاعات شما محرمانه می‌ماند و فقط برای هماهنگی نوبت و مشاوره استفاده می‌شود.
          </p>
        </form>
      )}
    </div>
  )
}
