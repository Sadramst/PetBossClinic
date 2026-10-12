'use client'

import React, { useState, useTransition } from 'react'
import {
  upsertSocialLinkAction,
  toggleSocialLinkAction,
  deleteSocialLinkAction,
} from '@/app/actions/social'
import { SocialIcon } from '@/components/shared/social-icon'

export interface SocialLinkItem {
  id: string
  platform: string
  url: string
  icon: string | null
  isActive: boolean
  sortOrder: number
}

interface Props {
  socialLinks: SocialLinkItem[]
  isEn: boolean
}

const SUPPORTED_PLATFORMS = [
  { value: 'INSTAGRAM', labelFa: 'اینستاگرام', labelEn: 'Instagram' },
  { value: 'TELEGRAM', labelFa: 'تلگرام', labelEn: 'Telegram' },
  { value: 'WHATSAPP', labelFa: 'واتساپ', labelEn: 'WhatsApp' },
  { value: 'APARAT', labelFa: 'آپارات', labelEn: 'Aparat' },
  { value: 'YOUTUBE', labelFa: 'یوتیوب', labelEn: 'YouTube' },
  { value: 'LINKEDIN', labelFa: 'لینکدین', labelEn: 'LinkedIn' },
  { value: 'X', labelFa: 'توییتر / ایکس (X)', labelEn: 'X / Twitter' },
  { value: 'FACEBOOK', labelFa: 'فیسبوک', labelEn: 'Facebook' },
]

export function SocialManager({ socialLinks, isEn }: Props) {
  const [isPending, startTransition] = useTransition()
  const [modalOpen, setModalOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<SocialLinkItem | null>(null)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  // Form fields
  const [platform, setPlatform] = useState('INSTAGRAM')
  const [url, setUrl] = useState('')
  const [sortOrder, setSortOrder] = useState('0')
  const [isActive, setIsActive] = useState(true)

  const openAddModal = () => {
    setEditingItem(null)
    setPlatform('INSTAGRAM')
    setUrl('')
    setSortOrder('0')
    setIsActive(true)
    setMessage(null)
    setModalOpen(true)
  }

  const openEditModal = (item: SocialLinkItem) => {
    setEditingItem(item)
    setPlatform(item.platform)
    setUrl(item.url)
    setSortOrder(item.sortOrder.toString())
    setIsActive(item.isActive)
    setMessage(null)
    setModalOpen(true)
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setMessage(null)

    const formData = new FormData()
    if (editingItem) formData.append('id', editingItem.id)
    formData.append('platform', platform)
    formData.append('url', url)
    formData.append('sortOrder', sortOrder)
    formData.append('isActive', isActive ? 'true' : 'false')

    startTransition(async () => {
      const res = await upsertSocialLinkAction(formData)
      if (res.error) {
        setMessage({ type: 'error', text: res.error })
      } else {
        setMessage({ type: 'success', text: res.message || 'ثبت شد.' })
        setModalOpen(false)
      }
    })
  }

  const handleToggle = (id: string, current: boolean) => {
    startTransition(async () => {
      const res = await toggleSocialLinkAction(id, !current)
      if (res.error) setMessage({ type: 'error', text: res.error })
    })
  }

  const handleDelete = (id: string, name: string) => {
    if (!confirm(`آیا از حذف لینک ${name} اطمینان دارید؟`)) return
    startTransition(async () => {
      const res = await deleteSocialLinkAction(id)
      if (res.error) setMessage({ type: 'error', text: res.error })
    })
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-foreground">
            {isEn ? 'Social Media Links' : 'مدیریت شبکه‌های اجتماعی'}
          </h1>
          <p className="text-xs text-muted-foreground mt-1">
            {isEn
              ? 'Only active links filled in admin will render in the footer and contact sections.'
              : 'تنها شبکه‌های اجتماعی ثبت‌شده و فعال در این بخش در فوتر و بخش‌های مختلف سایت نمایش داده می‌شوند.'}
          </p>
        </div>
        <button
          onClick={openAddModal}
          className="px-4 py-2.5 rounded-xl bg-primary text-charcoal-950 font-bold text-xs hover:bg-primary-hover shadow-gold transition-all cursor-pointer flex items-center gap-2 self-start"
        >
          <span>➕</span>
          <span>{isEn ? 'Add Social Link' : 'افزودن لینک جدید'}</span>
        </button>
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

      {/* Grid of Social Links */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {socialLinks.map((item) => {
          const platformMeta = SUPPORTED_PLATFORMS.find((p) => p.value === item.platform)
          const displayName = isEn ? (platformMeta?.labelEn || item.platform) : (platformMeta?.labelFa || item.platform)

          return (
            <div
              key={item.id}
              className={`p-5 rounded-2xl border transition-all ${
                item.isActive
                  ? 'bg-surface border-border hover:border-primary/50'
                  : 'bg-surface/50 border-border/50 opacity-60'
              }`}
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-surface-elevated border border-border flex items-center justify-center text-primary">
                    <SocialIcon platform={item.platform} className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-sm text-foreground">{displayName}</h3>
                    <span className="text-[10px] text-muted-foreground font-mono">
                      {item.platform}
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => handleToggle(item.id, item.isActive)}
                  disabled={isPending}
                  className={`text-[11px] px-2.5 py-1 rounded-full font-medium transition-colors cursor-pointer ${
                    item.isActive
                      ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                      : 'bg-zinc-500/10 text-zinc-400 border border-zinc-500/20'
                  }`}
                >
                  {item.isActive ? (isEn ? 'Active' : 'فعال') : (isEn ? 'Inactive' : 'غیرفعال')}
                </button>
              </div>

              <div className="text-xs text-muted-foreground truncate font-mono bg-surface-elevated/50 p-2 rounded-lg mb-4 ltr:text-left rtl:text-left">
                {item.url}
              </div>

              <div className="flex items-center justify-between text-xs pt-3 border-t border-border/50">
                <span className="text-muted-foreground text-[11px]">
                  {isEn ? `Order: ${item.sortOrder}` : `ترتیب: ${item.sortOrder}`}
                </span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => openEditModal(item)}
                    className="p-1.5 text-muted-foreground hover:text-primary transition-colors cursor-pointer rounded-lg hover:bg-surface-elevated"
                    title={isEn ? 'Edit' : 'ویرایش'}
                  >
                    ✏️
                  </button>
                  <button
                    onClick={() => handleDelete(item.id, displayName)}
                    className="p-1.5 text-muted-foreground hover:text-red-400 transition-colors cursor-pointer rounded-lg hover:bg-surface-elevated"
                    title={isEn ? 'Delete' : 'حذف'}
                  >
                    🗑️
                  </button>
                </div>
              </div>
            </div>
          )
        })}

        {socialLinks.length === 0 && (
          <div className="col-span-full p-12 text-center border border-dashed border-border rounded-2xl bg-surface/30">
            <span className="text-3xl block mb-2">🌐</span>
            <p className="text-sm text-muted-foreground">
              {isEn ? 'No social links defined yet.' : 'هنوز هیچ شبکه اجتماعی ثبت نشده است.'}
            </p>
          </div>
        )}
      </div>

      {/* Modal Dialog */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-lg bg-surface border border-border rounded-2xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <h2 className="text-base font-bold text-foreground">
                {editingItem
                  ? (isEn ? 'Edit Social Link' : 'ویرایش لینک شبکه اجتماعی')
                  : (isEn ? 'Add Social Link' : 'افزودن لینک شبکه اجتماعی')}
              </h2>
              <button
                onClick={() => setModalOpen(false)}
                className="text-muted-foreground hover:text-foreground text-lg leading-none cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">
                  {isEn ? 'Platform' : 'پلتفرم شبکه اجتماعی'}
                </label>
                <select
                  value={platform}
                  onChange={(e) => setPlatform(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-surface-elevated border border-border text-foreground text-xs focus:outline-none focus:border-primary"
                >
                  {SUPPORTED_PLATFORMS.map((p) => (
                    <option key={p.value} value={p.value}>
                      {isEn ? p.labelEn : p.labelFa} ({p.value})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">
                  {isEn ? 'Target URL' : 'آدرس اینترنتی کامل (URL)'}
                </label>
                <input
                  type="url"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  required
                  placeholder="https://instagram.com/petbossclinic"
                  dir="ltr"
                  className="w-full px-3 py-2 rounded-xl bg-surface-elevated border border-border text-foreground text-xs focus:outline-none focus:border-primary"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1">
                    {isEn ? 'Sort Order' : 'ترتیب نمایش (عدد)'}
                  </label>
                  <input
                    type="number"
                    value={sortOrder}
                    onChange={(e) => setSortOrder(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-surface-elevated border border-border text-foreground text-xs focus:outline-none focus:border-primary"
                  />
                </div>
                <div className="flex items-center gap-2 pt-6">
                  <input
                    type="checkbox"
                    id="socialActive"
                    checked={isActive}
                    onChange={(e) => setIsActive(e.target.checked)}
                    className="rounded border-border text-primary focus:ring-primary w-4 h-4 cursor-pointer"
                  />
                  <label htmlFor="socialActive" className="text-xs font-semibold text-foreground cursor-pointer">
                    {isEn ? 'Active & Visible' : 'فعال و قابل نمایش'}
                  </label>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-border">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
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
