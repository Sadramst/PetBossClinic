'use client'

import React, { useState, useTransition } from 'react'
import { updateSiteSettingsAction } from '@/app/actions/settings'

interface SiteSettingData {
  nameFa: string
  nameEn: string | null
  taglineFa: string | null
  taglineEn: string | null
  phones: unknown
  addresses: unknown
  geo: unknown
  workingHours: unknown
  heroTitleFa?: string | null
  heroTitleEn?: string | null
  heroSubtitleFa?: string | null
  heroSubtitleEn?: string | null
}

interface Props {
  initialSettings: SiteSettingData | null
  isEn: boolean
}

export function SettingsForm({ initialSettings, isEn }: Props) {
  const [isPending, startTransition] = useTransition()
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const defaultPhone = Array.isArray(initialSettings?.phones)
    ? initialSettings.phones[0]
    : '۰۲۱-۲۶۴۲۹۷۱۵'

  const addresses = initialSettings?.addresses as { fa?: string; en?: string } | null
  const geoObj = initialSettings?.geo as { coordinates?: string } | null
  const workingHoursObj = initialSettings?.workingHours as { fa?: string; en?: string } | null

  const [nameFa, setNameFa] = useState(initialSettings?.nameFa || 'کلینیک دامپزشکی و پت شاپ پت باس')
  const [nameEn, setNameEn] = useState(initialSettings?.nameEn || 'Pet Boss Veterinary Clinic & Pet Shop')
  const [taglineFa, setTaglineFa] = useState(initialSettings?.taglineFa || 'مراقبت با عشق')
  const [taglineEn, setTaglineEn] = useState(initialSettings?.taglineEn || 'Care with love')
  const [phone, setPhone] = useState(defaultPhone || '۰۲۱-۲۶۴۲۹۷۱۵')
  const [addressFa, setAddressFa] = useState(addresses?.fa || 'تهران، خیابان شریعتی، بالاتر از پل صدر، نرسیده به ایستگاه مترو قیطریه، پلاک ۱۷۳۳')
  const [addressEn, setAddressEn] = useState(addresses?.en || 'Shariati St., north of Sadr Bridge, near Gheytarieh Metro Station, No. 1733, Tehran, Iran')
  const [geo, setGeo] = useState(geoObj?.coordinates || '35.790937, 51.4350853')
  const [workingHoursFa, setWorkingHoursFa] = useState(workingHoursObj?.fa || '۱۰:۰۰ صبح الی ۲۲:۰۰ شب (همه روزه)')
  const [workingHoursEn, setWorkingHoursEn] = useState(workingHoursObj?.en || '10:00 AM to 10:00 PM (Every day including holidays)')
  const [heroTitleFa, setHeroTitleFa] = useState(initialSettings?.heroTitleFa || '')
  const [heroTitleEn, setHeroTitleEn] = useState(initialSettings?.heroTitleEn || '')
  const [heroSubtitleFa, setHeroSubtitleFa] = useState(initialSettings?.heroSubtitleFa || '')
  const [heroSubtitleEn, setHeroSubtitleEn] = useState(initialSettings?.heroSubtitleEn || '')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setMessage(null)

    const formData = new FormData()
    formData.append('nameFa', nameFa)
    formData.append('nameEn', nameEn)
    formData.append('taglineFa', taglineFa)
    formData.append('taglineEn', taglineEn)
    formData.append('phone', phone)
    formData.append('addressFa', addressFa)
    formData.append('addressEn', addressEn)
    formData.append('geo', geo)
    formData.append('workingHoursFa', workingHoursFa)
    formData.append('workingHoursEn', workingHoursEn)
    formData.append('heroTitleFa', heroTitleFa)
    formData.append('heroTitleEn', heroTitleEn)
    formData.append('heroSubtitleFa', heroSubtitleFa)
    formData.append('heroSubtitleEn', heroSubtitleEn)

    startTransition(async () => {
      const res = await updateSiteSettingsAction(formData)
      if (res.error) {
        setMessage({ type: 'error', text: res.error })
      } else {
        setMessage({ type: 'success', text: res.message || (isEn ? 'Settings updated successfully' : 'تنظیمات با موفقیت ذخیره شد.') })
      }
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {message && (
        <div
          className={`p-4 rounded-xl text-xs font-semibold flex items-center gap-2 ${
            message.type === 'success'
              ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-400'
              : 'bg-red-500/10 border border-red-500/30 text-red-400'
          }`}
        >
          <span>{message.type === 'success' ? '✓' : '⚠️'}</span>
          <span>{message.text}</span>
        </div>
      )}

      {/* Brand Identity Card */}
      <div className="bg-surface border border-border rounded-2xl p-6 space-y-4 shadow-sm">
        <h2 className="text-base font-bold text-foreground pb-2 border-b border-border">
          {isEn ? 'Core Brand & Identity Information' : 'اطلاعات پایه و هویتی کلینیک'}
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-foreground/80 mb-1.5">
              {isEn ? 'Clinic Name (Persian) *' : 'نام کلینیک (فارسی) *'}
            </label>
            <input
              type="text"
              required
              value={nameFa}
              onChange={(e) => setNameFa(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-border bg-surface-elevated text-foreground text-xs outline-none focus:border-primary"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-foreground/80 mb-1.5">
              {isEn ? 'Clinic Name (English)' : 'نام کلینیک (انگلیسی)'}
            </label>
            <input
              type="text"
              value={nameEn}
              onChange={(e) => setNameEn(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-border bg-surface-elevated text-foreground text-xs outline-none focus:border-primary dir-ltr"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-foreground/80 mb-1.5">
              {isEn ? 'Brand Tagline (Persian)' : 'شعار برند (فارسی)'}
            </label>
            <input
              type="text"
              value={taglineFa}
              onChange={(e) => setTaglineFa(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-border bg-surface-elevated text-foreground text-xs outline-none focus:border-primary"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-foreground/80 mb-1.5">
              {isEn ? 'Brand Tagline (English)' : 'شعار برند (انگلیسی)'}
            </label>
            <input
              type="text"
              value={taglineEn}
              onChange={(e) => setTaglineEn(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-border bg-surface-elevated text-foreground text-xs outline-none focus:border-primary dir-ltr"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-xs font-semibold text-foreground/80 mb-1.5">
              {isEn ? 'Primary / Emergency Phone Number *' : 'شماره تماس اصلی و اضطراری کلینیک *'}
            </label>
            <input
              type="text"
              required
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-border bg-surface-elevated text-foreground text-xs outline-none focus:border-primary font-mono dir-ltr"
            />
          </div>
        </div>
      </div>

      {/* Homepage Hero Section Content Card */}
      <div className="bg-surface border border-border rounded-2xl p-6 space-y-4 shadow-sm">
        <div className="flex items-center justify-between pb-2 border-b border-border">
          <h2 className="text-base font-bold text-foreground flex items-center gap-2">
            <span>✨</span>
            <span>{isEn ? 'Homepage Hero Section Copy' : 'متن و تیترهای بخش اصلی صفحه نخست (Hero)'}</span>
          </h2>
          <span className="text-xs text-muted-foreground">
            {isEn ? 'Editable Public Copy' : 'متن‌های قابل ویرایش عمومی'}
          </span>
        </div>
        <p className="text-xs text-muted-foreground">
          {isEn
            ? 'Customize the main title and introduction shown at the top of the homepage. Leave empty to use default localized copy.'
            : 'تیتر اصلی و توضیحات بالای صفحه نخست را در این بخش سفارشی‌سازی کنید. در صورت خالی ماندن، متن‌های پیش‌فرض نمایش داده می‌شوند.'}
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-foreground/80 mb-1.5">
              {isEn ? 'Hero Title (Persian)' : 'تیتر اصلی هیرو (فارسی)'}
            </label>
            <input
              type="text"
              placeholder="مثال: کلینیک تخصصی دامپزشکی و پت شاپ پت باس"
              value={heroTitleFa}
              onChange={(e) => setHeroTitleFa(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-border bg-surface-elevated text-foreground text-xs outline-none focus:border-primary"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-foreground/80 mb-1.5">
              {isEn ? 'Hero Title (English)' : 'تیتر اصلی هیرو (انگلیسی)'}
            </label>
            <input
              type="text"
              placeholder="e.g. Premier Veterinary & Pet Boutique"
              value={heroTitleEn}
              onChange={(e) => setHeroTitleEn(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-border bg-surface-elevated text-foreground text-xs outline-none focus:border-primary dir-ltr"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-xs font-semibold text-foreground/80 mb-1.5">
              {isEn ? 'Hero Subtitle (Persian)' : 'زیرتیتر و توضیحات هیرو (فارسی)'}
            </label>
            <textarea
              rows={3}
              placeholder="توضیحات معرفی کلینیک در بالای صفحه نخست..."
              value={heroSubtitleFa}
              onChange={(e) => setHeroSubtitleFa(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-border bg-surface-elevated text-foreground text-xs outline-none focus:border-primary leading-relaxed"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-xs font-semibold text-foreground/80 mb-1.5">
              {isEn ? 'Hero Subtitle (English)' : 'زیرتیتر و توضیحات هیرو (انگلیسی)'}
            </label>
            <textarea
              rows={3}
              placeholder="Introduction copy for the homepage top section..."
              value={heroSubtitleEn}
              onChange={(e) => setHeroSubtitleEn(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-border bg-surface-elevated text-foreground text-xs outline-none focus:border-primary leading-relaxed dir-ltr"
            />
          </div>
        </div>
      </div>

      {/* Location & Hours Card */}
      <div className="bg-surface border border-border rounded-2xl p-6 space-y-4 shadow-sm">
        <h2 className="text-base font-bold text-foreground pb-2 border-b border-border">
          {isEn ? 'Location & Operating Hours' : 'موقعیت مکانی و ساعات کار'}
        </h2>
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-foreground/80 mb-1.5">
              {isEn ? 'Full Street Address (Persian) *' : 'نشانی کامل و دقیق پستی (فارسی) *'}
            </label>
            <input
              type="text"
              required
              value={addressFa}
              onChange={(e) => setAddressFa(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-border bg-surface-elevated text-foreground text-xs outline-none focus:border-primary"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-foreground/80 mb-1.5">
              {isEn ? 'Full Street Address (English)' : 'نشانی کامل و دقیق پستی (انگلیسی)'}
            </label>
            <input
              type="text"
              value={addressEn}
              onChange={(e) => setAddressEn(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-border bg-surface-elevated text-foreground text-xs outline-none focus:border-primary dir-ltr"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-foreground/80 mb-1.5">
              {isEn ? 'Geolocation Coordinates (Latitude, Longitude)' : 'مختصات جغرافیایی (Latitude, Longitude)'}
            </label>
            <input
              type="text"
              value={geo}
              onChange={(e) => setGeo(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-border bg-surface-elevated text-foreground text-xs outline-none focus:border-primary font-mono dir-ltr"
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-foreground/80 mb-1.5">
                {isEn ? 'Daily Working Hours (Persian)' : 'ساعات کاری روزانه (فارسی)'}
              </label>
              <input
                type="text"
                value={workingHoursFa}
                onChange={(e) => setWorkingHoursFa(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-border bg-surface-elevated text-foreground text-xs outline-none focus:border-primary"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-foreground/80 mb-1.5">
                {isEn ? 'Daily Working Hours (English)' : 'ساعات کاری روزانه (انگلیسی)'}
              </label>
              <input
                type="text"
                value={workingHoursEn}
                onChange={(e) => setWorkingHoursEn(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-border bg-surface-elevated text-foreground text-xs outline-none focus:border-primary dir-ltr"
              />
            </div>
          </div>
        </div>

        <div className="pt-4 border-t border-border flex justify-end">
          <button
            type="submit"
            disabled={isPending}
            className="bg-gradient-to-r from-primary to-[#DFC07A] text-charcoal-950 font-bold px-6 py-2.5 rounded-xl text-xs shadow-gold hover:opacity-95 active:scale-[0.99] transition-all disabled:opacity-50 cursor-pointer"
          >
            {isPending ? (isEn ? 'Saving Changes...' : 'در حال ذخیره‌سازی...') : (isEn ? 'Save Changes' : 'ذخیره تغییرات')}
          </button>
        </div>
      </div>
    </form>
  )
}
