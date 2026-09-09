'use client'

import { useActionState, useEffect, useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { createLeadAction, LeadActionState } from '@/app/actions/leads'
import { Button } from '@/components/ui/button'

export interface LeadFormProps {
  variant?: 'inline' | 'modal' | 'sticky'
  serviceInterest?: string
  source?: string
  title?: string
  subtitle?: string
  buttonText?: string
  className?: string
  onSuccess?: () => void
}

export function LeadForm({
  variant = 'inline',
  serviceInterest,
  source = 'WEBSITE_CONTACT',
  title,
  subtitle,
  buttonText,
  className = '',
  onSuccess,
}: LeadFormProps) {
  const locale = useLocale()
  const isEn = locale === 'en'
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
    if (typeof window !== 'undefined') {
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
    }
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
          ? 'p-6 bg-surface border border-border-gold'
          : 'p-6 sm:p-8 bg-surface-card border border-border/80 shadow-gold'
      } ${className}`}
    >
      {/* Header if specified or inline */}
      {(title || subtitle) && (
        <div className="mb-6 text-center sm:text-start">
          {title && (
            <h3 className="text-xl font-bold text-foreground mb-1.5">{title}</h3>
          )}
          {subtitle && (
            <p className="text-sm text-muted-foreground">{subtitle}</p>
          )}
        </div>
      )}

      {/* Success State */}
      {state?.success ? (
        <div className="py-8 px-4 text-center space-y-4 animate-in fade-in-50 zoom-in-95 duration-300">
          <div className="w-14 h-14 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 flex items-center justify-center mx-auto text-2xl">
            ✓
          </div>
          <div className="space-y-1.5">
            <h4 className="text-lg font-bold text-foreground">
              {isEn ? 'Inquiry Received' : 'درخواست شما ثبت شد'}
            </h4>
            <p className="text-sm text-muted-foreground max-w-sm mx-auto leading-relaxed">
              {state.message}
            </p>
          </div>
          <div className="pt-2">
            <p className="text-xs text-muted-foreground">
              {isEn ? 'Need urgent consultation?' : 'نیاز به مشاوره فوری دارید؟'}{' '}
              <a
                href="tel:+982126429715"
                className="text-primary font-bold hover:underline dir-ltr inline-block ms-1"
              >
                {isEn ? '+98 21 2642 9715' : '۰۲۱-۲۶۴۲۹۷۱۵'}
              </a>
            </p>
          </div>
        </div>
      ) : (
        <form action={formAction} className="space-y-4">
          {/* Hidden metadata inputs */}
          <input type="hidden" name="locale" value={locale} />
          <input type="hidden" name="source" value={source} />
          <input type="hidden" name="utmSource" value={utmParams.utmSource} />
          <input type="hidden" name="utmMedium" value={utmParams.utmMedium} />
          <input type="hidden" name="utmCamp" value={utmParams.utmCamp} />
          <input type="hidden" name="utmTerm" value={utmParams.utmTerm} />
          <input type="hidden" name="utmContent" value={utmParams.utmContent} />
          <input type="hidden" name="referrer" value={utmParams.referrer} />
          <input type="hidden" name="landingPage" value={utmParams.landingPage} />
          {serviceInterest && (
            <input type="hidden" name="serviceInterest" value={serviceInterest} />
          )}

          {/* Honeypot field (hidden from legitimate users) */}
          <div style={{ display: 'none', opacity: 0, position: 'absolute', left: '-9999px' }} aria-hidden="true">
            <label htmlFor="hp_website">Leave this field empty</label>
            <input
              id="hp_website"
              type="text"
              name="website"
              tabIndex={-1}
              autoComplete="off"
            />
          </div>

          {/* Error Banner */}
          {state?.error && (
            <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 text-xs space-y-1 animate-in fade-in-50">
              <p className="font-semibold">{state.error}</p>
              {state.fallbackPhone && (
                <p className="text-foreground/90 pt-1">
                  {isEn ? 'Direct clinic line: ' : 'تماس مستقیم با پذیرش: '}
                  <a
                    href={`tel:${state.fallbackPhone}`}
                    className="text-primary font-bold underline dir-ltr inline-block ms-1"
                  >
                    {state.fallbackPhoneDisplay || state.fallbackPhone}
                  </a>
                </p>
              )}
            </div>
          )}

          {/* Name & Phone Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-foreground/90 mb-1.5">
                {t('name')}
              </label>
              <input
                type="text"
                name="name"
                disabled={isPending}
                placeholder={t('namePlaceholder')}
                className="w-full px-3.5 py-2.5 rounded-xl border border-border bg-surface text-foreground text-sm focus:ring-2 focus:ring-primary focus:border-primary outline-none transition placeholder:text-muted-foreground disabled:opacity-50"
              />
              {state?.fieldErrors?.name && (
                <p className="text-[11px] text-red-400 mt-1">{state.fieldErrors.name[0]}</p>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-foreground/90 mb-1.5">
                {t('phone')} <span className="text-primary">*</span>
              </label>
              <input
                type="tel"
                name="phone"
                required
                disabled={isPending}
                placeholder={isEn ? '0912... or 021...' : '۰۹۱۲... یا ۰۲۱...'}
                dir="ltr"
                className="w-full px-3.5 py-2.5 rounded-xl border border-border bg-surface text-foreground text-sm focus:ring-2 focus:ring-primary focus:border-primary outline-none transition placeholder:text-muted-foreground text-start disabled:opacity-50"
              />
              {state?.fieldErrors?.phone && (
                <p className="text-[11px] text-red-400 mt-1">{state.fieldErrors.phone[0]}</p>
              )}
            </div>
          </div>

          {/* Email & Pet Type Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-foreground/90 mb-1.5">
                {t('email')}
              </label>
              <input
                type="email"
                name="email"
                disabled={isPending}
                placeholder={t('emailPlaceholder')}
                dir="ltr"
                className="w-full px-3.5 py-2.5 rounded-xl border border-border bg-surface text-foreground text-sm focus:ring-2 focus:ring-primary focus:border-primary outline-none transition placeholder:text-muted-foreground disabled:opacity-50"
              />
              {state?.fieldErrors?.email && (
                <p className="text-[11px] text-red-400 mt-1">{state.fieldErrors.email[0]}</p>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-foreground/90 mb-1.5">
                {isEn ? 'Pet Type / Breed' : 'نوع پت / نژاد'}
              </label>
              <input
                type="text"
                name="petType"
                disabled={isPending}
                placeholder={isEn ? 'e.g. Persian Cat, Golden Retriever' : 'مثال: گربه پرشین، سگ گلدن'}
                className="w-full px-3.5 py-2.5 rounded-xl border border-border bg-surface text-foreground text-sm focus:ring-2 focus:ring-primary focus:border-primary outline-none transition placeholder:text-muted-foreground disabled:opacity-50"
              />
            </div>
          </div>

          {/* Service Interest (if not fixed) */}
          {!serviceInterest && (
            <div>
              <label className="block text-xs font-semibold text-foreground/90 mb-1.5">
                {isEn ? 'Service of Interest' : 'خدمت مورد نظر'}
              </label>
              <select
                name="serviceInterest"
                disabled={isPending}
                className="w-full px-3.5 py-2.5 rounded-xl border border-border bg-surface text-foreground text-sm focus:ring-2 focus:ring-primary focus:border-primary outline-none transition disabled:opacity-50"
              >
                <option value="">{isEn ? 'Select a service (optional)' : 'انتخاب خدمت (اختیاری)'}</option>
                <option value="vaccination">{isEn ? 'Vaccination & Prevention' : 'واکسیناسیون و پیشگیری'}</option>
                <option value="surgery">{isEn ? 'Specialized Surgery' : 'جراحی تخصصی و عقیم‌سازی'}</option>
                <option value="grooming">{isEn ? 'Grooming & Bathing' : 'گرومینگ، اصلاح و شست‌وشو'}</option>
                <option value="internal-medicine">{isEn ? 'Internal Medicine' : 'درمان بیماری‌های داخلی'}</option>
                <option value="dentistry">{isEn ? 'Veterinary Dentistry' : 'دندانپزشکی و جرم‌گیری'}</option>
                <option value="checkup">{isEn ? 'General Health Checkup' : 'چکاپ دوره‌ای و سلامت'}</option>
                <option value="shop">{isEn ? 'Pet Shop & Diet' : 'پت‌شاپ و رژیم غذایی'}</option>
              </select>
            </div>
          )}

          {/* Message Textarea */}
          <div>
            <label className="block text-xs font-semibold text-foreground/90 mb-1.5">
              {t('message')}
            </label>
            <textarea
              name="message"
              rows={3}
              disabled={isPending}
              placeholder={t('messagePlaceholder')}
              className="w-full px-3.5 py-2.5 rounded-xl border border-border bg-surface text-foreground text-sm focus:ring-2 focus:ring-primary focus:border-primary outline-none transition resize-none placeholder:text-muted-foreground disabled:opacity-50"
            />
            {state?.fieldErrors?.message && (
              <p className="text-[11px] text-red-400 mt-1">{state.fieldErrors.message[0]}</p>
            )}
          </div>

          {/* Submit Button */}
          <Button
            type="submit"
            disabled={isPending}
            className="w-full bg-gradient-gold hover:opacity-95 text-charcoal-950 font-bold rounded-xl py-3 shadow-gold text-sm cursor-pointer disabled:opacity-60 transition-all"
          >
            {isPending ? (
              <span className="flex items-center justify-center gap-2">
                <span className="w-4 h-4 border-2 border-charcoal-950 border-t-transparent rounded-full animate-spin" />
                <span>{isEn ? 'Submitting...' : 'در حال ثبت درخواست...'}</span>
              </span>
            ) : (
              buttonText || t('send')
            )}
          </Button>

          <p className="text-[11px] text-muted-foreground text-center">
            {isEn
              ? 'Your information is confidential and will only be used for appointment coordination.'
              : 'اطلاعات شما محرمانه بوده و صرفاً جهت هماهنگی نوبت و مشاوره درمانی استفاده می‌شود.'}
          </p>
        </form>
      )}
    </div>
  )
}
