'use client'

import React, { useState, useTransition } from 'react'
import {
  updateHomepageSectionAction,
  toggleHomepageSectionVisibilityAction,
} from '@/app/actions/homepage'

export interface HomepageSectionItem {
  id: string
  key: string
  titleFa: string | null
  titleEn: string | null
  subtitleFa: string | null
  subtitleEn: string | null
  eyebrowFa: string | null
  eyebrowEn: string | null
  badgeFa: string | null
  badgeEn: string | null
  ctaLabelFa: string | null
  ctaLabelEn: string | null
  ctaHref: string | null
  isVisible: boolean
  sortOrder: number
}

interface Props {
  sections: HomepageSectionItem[]
  isEn: boolean
}

const SECTION_LABELS: Record<string, { nameFa: string; nameEn: string; icon: string }> = {
  hero: { nameFa: 'بخش هیرو و سردر اصلی', nameEn: 'Hero Header Banner', icon: '👑' },
  divisions: { nameFa: 'بخش‌های سه‌گانه کلینیک', nameEn: 'Three Main Divisions', icon: '🏥' },
  shop: { nameFa: 'ویترین اختصاصی پت‌شاپ و بوتیک', nameEn: 'Pet Shop Boutique Showcase', icon: '🛍️' },
  services: { nameFa: 'کاتالوگ خدمات تخصصی', nameEn: 'Specialized Services Catalog', icon: '💊' },
  staff: { nameFa: 'کادر درمانی و پزشکان', nameEn: 'Veterinary Doctors & Staff', icon: '👨‍⚕️' },
  testimonials: { nameFa: 'نظرات مراجعین و مراجعین تأیید شده', nameEn: 'Client Testimonials', icon: '⭐' },
  faq: { nameFa: 'سوالات متداول (FAQ)', nameEn: 'Frequently Asked Questions', icon: '❓' },
  contact: { nameFa: 'موقعیت مکانی، نقشه و دسترسی', nameEn: 'Location, Map & Access', icon: '📍' },
}

export function HomepageManager({ sections, isEn }: Props) {
  const [isPending, startTransition] = useTransition()
  const [editingKey, setEditingKey] = useState<string | null>(null)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  // Edit fields
  const [titleFa, setTitleFa] = useState('')
  const [titleEn, setTitleEn] = useState('')
  const [subtitleFa, setSubtitleFa] = useState('')
  const [subtitleEn, setSubtitleEn] = useState('')
  const [eyebrowFa, setEyebrowFa] = useState('')
  const [eyebrowEn, setEyebrowEn] = useState('')
  const [badgeFa, setBadgeFa] = useState('')
  const [badgeEn, setBadgeEn] = useState('')
  const [ctaLabelFa, setCtaLabelFa] = useState('')
  const [ctaLabelEn, setCtaLabelEn] = useState('')
  const [ctaHref, setCtaHref] = useState('')
  const [sortOrder, setSortOrder] = useState('0')
  const [isVisible, setIsVisible] = useState(true)

  const openEditModal = (sec: HomepageSectionItem) => {
    setEditingKey(sec.key)
    setTitleFa(sec.titleFa || '')
    setTitleEn(sec.titleEn || '')
    setSubtitleFa(sec.subtitleFa || '')
    setSubtitleEn(sec.subtitleEn || '')
    setEyebrowFa(sec.eyebrowFa || '')
    setEyebrowEn(sec.eyebrowEn || '')
    setBadgeFa(sec.badgeFa || '')
    setBadgeEn(sec.badgeEn || '')
    setCtaLabelFa(sec.ctaLabelFa || '')
    setCtaLabelEn(sec.ctaLabelEn || '')
    setCtaHref(sec.ctaHref || '')
    setSortOrder(sec.sortOrder.toString())
    setIsVisible(sec.isVisible)
    setMessage(null)
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingKey) return
    setMessage(null)

    const formData = new FormData()
    formData.append('titleFa', titleFa)
    formData.append('titleEn', titleEn)
    formData.append('subtitleFa', subtitleFa)
    formData.append('subtitleEn', subtitleEn)
    formData.append('eyebrowFa', eyebrowFa)
    formData.append('eyebrowEn', eyebrowEn)
    formData.append('badgeFa', badgeFa)
    formData.append('badgeEn', badgeEn)
    formData.append('ctaLabelFa', ctaLabelFa)
    formData.append('ctaLabelEn', ctaLabelEn)
    formData.append('ctaHref', ctaHref)
    formData.append('sortOrder', sortOrder)
    formData.append('isVisible', isVisible ? 'true' : 'false')

    startTransition(async () => {
      const res = await updateHomepageSectionAction(editingKey, formData)
      if (res.error) {
        setMessage({ type: 'error', text: res.error })
      } else {
        setMessage({ type: 'success', text: res.message || 'بخش با موفقیت به‌روزرسانی شد.' })
        setEditingKey(null)
      }
    })
  }

  const handleToggle = (key: string, current: boolean) => {
    startTransition(async () => {
      const res = await toggleHomepageSectionVisibilityAction(key, !current)
      if (res.error) setMessage({ type: 'error', text: res.error })
    })
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-foreground">
            {isEn ? 'Homepage Sections Control' : 'مدیریت و کنترل بخش‌های صفحه اصلی'}
          </h1>
          <p className="text-xs text-muted-foreground mt-1">
            {isEn
              ? 'Customize headings, subtitles, badges, and hide or show any section on the homepage without redeploying.'
              : 'شخصی‌سازی عناوین، زیرعنوان‌ها، نشان‌ها و قابلیت پنهان یا نمایان کردن بخش‌های مختلف صفحه اصلی بدون نیاز به بازنشر.'}
          </p>
        </div>
      </div>

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

      {/* Grid of Sections */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {sections.map((sec) => {
          const meta = SECTION_LABELS[sec.key] || { nameFa: sec.key, nameEn: sec.key, icon: '📄' }
          const label = isEn ? meta.nameEn : meta.nameFa

          return (
            <div
              key={sec.id}
              className={`p-5 rounded-2xl border transition-all ${
                sec.isVisible
                  ? 'bg-surface border-border hover:border-primary/50'
                  : 'bg-surface/50 border-border/50 opacity-60'
              }`}
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{meta.icon}</span>
                  <div>
                    <h3 className="font-bold text-sm text-foreground">{label}</h3>
                    <span className="text-[10px] text-muted-foreground font-mono">
                      sectionKey: {sec.key}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleToggle(sec.key, sec.isVisible)}
                    disabled={isPending}
                    className={`text-[11px] px-2.5 py-1 rounded-full font-medium transition-colors cursor-pointer ${
                      sec.isVisible
                        ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                        : 'bg-zinc-500/10 text-zinc-400 border border-zinc-500/20'
                    }`}
                  >
                    {sec.isVisible ? (isEn ? 'Visible' : 'نمایان') : (isEn ? 'Hidden' : 'مخفی')}
                  </button>
                  <button
                    onClick={() => openEditModal(sec)}
                    className="p-1.5 text-muted-foreground hover:text-primary transition-colors cursor-pointer rounded-lg hover:bg-surface-elevated"
                    title={isEn ? 'Edit Content' : 'ویرایش متون'}
                  >
                    ✏️
                  </button>
                </div>
              </div>

              {/* Preview of Content */}
              <div className="space-y-1.5 text-xs bg-surface-elevated/40 p-3 rounded-xl border border-border/50">
                {sec.titleFa && (
                  <div>
                    <span className="text-muted-foreground text-[11px]">عنوان: </span>
                    <span className="font-semibold text-foreground">{sec.titleFa}</span>
                  </div>
                )}
                {sec.subtitleFa && (
                  <div>
                    <span className="text-muted-foreground text-[11px]">توضیحات: </span>
                    <span className="text-muted-foreground line-clamp-1">{sec.subtitleFa}</span>
                  </div>
                )}
                {sec.eyebrowFa && (
                  <div>
                    <span className="text-muted-foreground text-[11px]">نشانک: </span>
                    <span className="text-primary font-medium">{sec.eyebrowFa}</span>
                  </div>
                )}
                {!sec.titleFa && !sec.subtitleFa && (
                  <span className="text-muted-foreground italic text-[11px]">
                    (متن‌های پیش‌فرض بارگذاری می‌شوند)
                  </span>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* Edit Modal */}
      {editingKey && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-2xl bg-surface border border-border rounded-2xl p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <h2 className="text-base font-bold text-foreground">
                {isEn ? `Edit Section: ${editingKey}` : `ویرایش محتوای بخش: ${SECTION_LABELS[editingKey]?.nameFa || editingKey}`}
              </h2>
              <button
                onClick={() => setEditingKey(null)}
                className="text-muted-foreground hover:text-foreground text-lg leading-none cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1">
                    {isEn ? 'Persian Title' : 'عنوان فارسی'}
                  </label>
                  <input
                    type="text"
                    value={titleFa}
                    onChange={(e) => setTitleFa(e.target.value)}
                    placeholder="عنوان اصلی بخش"
                    className="w-full px-3 py-2 rounded-xl bg-surface-elevated border border-border text-foreground text-xs focus:outline-none focus:border-primary"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1">
                    {isEn ? 'English Title' : 'عنوان انگلیسی'}
                  </label>
                  <input
                    type="text"
                    value={titleEn}
                    onChange={(e) => setTitleEn(e.target.value)}
                    placeholder="Section Title"
                    dir="ltr"
                    className="w-full px-3 py-2 rounded-xl bg-surface-elevated border border-border text-foreground text-xs focus:outline-none focus:border-primary"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1">
                    {isEn ? 'Persian Eyebrow / Tag' : 'نشانک بالا (فارسی)'}
                  </label>
                  <input
                    type="text"
                    value={eyebrowFa}
                    onChange={(e) => setEyebrowFa(e.target.value)}
                    placeholder="مثال: خدمات تخصصی"
                    className="w-full px-3 py-2 rounded-xl bg-surface-elevated border border-border text-foreground text-xs focus:outline-none focus:border-primary"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1">
                    {isEn ? 'English Eyebrow / Tag' : 'نشانک بالا (انگلیسی)'}
                  </label>
                  <input
                    type="text"
                    value={eyebrowEn}
                    onChange={(e) => setEyebrowEn(e.target.value)}
                    placeholder="e.g. Specialized Care"
                    dir="ltr"
                    className="w-full px-3 py-2 rounded-xl bg-surface-elevated border border-border text-foreground text-xs focus:outline-none focus:border-primary"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">
                  {isEn ? 'Persian Subtitle / Description' : 'زیرعنوان و توضیحات فارسی'}
                </label>
                <textarea
                  rows={2}
                  value={subtitleFa}
                  onChange={(e) => setSubtitleFa(e.target.value)}
                  placeholder="توضیح کامل زیر عنوان..."
                  className="w-full px-3 py-2 rounded-xl bg-surface-elevated border border-border text-foreground text-xs focus:outline-none focus:border-primary"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">
                  {isEn ? 'English Subtitle / Description' : 'زیرعنوان و توضیحات انگلیسی'}
                </label>
                <textarea
                  rows={2}
                  value={subtitleEn}
                  onChange={(e) => setSubtitleEn(e.target.value)}
                  placeholder="Section description..."
                  dir="ltr"
                  className="w-full px-3 py-2 rounded-xl bg-surface-elevated border border-border text-foreground text-xs focus:outline-none focus:border-primary"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1">
                    {isEn ? 'Persian CTA Label' : 'متن دکمه اکشن (فارسی)'}
                  </label>
                  <input
                    type="text"
                    value={ctaLabelFa}
                    onChange={(e) => setCtaLabelFa(e.target.value)}
                    placeholder="مشاهده همه"
                    className="w-full px-3 py-2 rounded-xl bg-surface-elevated border border-border text-foreground text-xs focus:outline-none focus:border-primary"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1">
                    {isEn ? 'CTA URL' : 'لینک دکمه اکشن'}
                  </label>
                  <input
                    type="text"
                    value={ctaHref}
                    onChange={(e) => setCtaHref(e.target.value)}
                    placeholder="/services"
                    dir="ltr"
                    className="w-full px-3 py-2 rounded-xl bg-surface-elevated border border-border text-foreground text-xs focus:outline-none focus:border-primary"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1">
                    {isEn ? 'Sort Order' : 'ترتیب نمایش'}
                  </label>
                  <input
                    type="number"
                    value={sortOrder}
                    onChange={(e) => setSortOrder(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-surface-elevated border border-border text-foreground text-xs focus:outline-none focus:border-primary"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <input
                  type="checkbox"
                  id="sectionVisible"
                  checked={isVisible}
                  onChange={(e) => setIsVisible(e.target.checked)}
                  className="rounded border-border text-primary focus:ring-primary w-4 h-4 cursor-pointer"
                />
                <label htmlFor="sectionVisible" className="text-xs font-semibold text-foreground cursor-pointer">
                  {isEn ? 'Visible on Homepage' : 'نمایش در صفحه اصلی'}
                </label>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-border">
                <button
                  type="button"
                  onClick={() => setEditingKey(null)}
                  className="px-4 py-2 rounded-xl border border-border text-xs text-muted-foreground hover:bg-surface-elevated cursor-pointer"
                >
                  {isEn ? 'Cancel' : 'انصراف'}
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="px-5 py-2 rounded-xl bg-primary text-charcoal-950 font-bold text-xs hover:bg-primary-hover shadow-gold cursor-pointer"
                >
                  {isPending ? (isEn ? 'Saving...' : 'در حال ذخیره...') : (isEn ? 'Save' : 'ذخیره')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
