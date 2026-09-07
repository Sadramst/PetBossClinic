'use client'

import React, { useState, useTransition } from 'react'
import {
  updateSitePictureAction,
  resetSitePictureAction,
  uploadMediaAction,
  deleteMediaAction,
} from '@/app/actions/media'
import { SitePictures } from '@/lib/media'

interface MediaItem {
  id: string
  key: string
  url: string
  size: number
  mime: string
  altFa: string
  createdAt: Date | string
}

interface Props {
  currentPictures: SitePictures
  mediaLibrary: MediaItem[]
  isEn: boolean
}

export function MediaManager({ currentPictures, mediaLibrary, isEn }: Props) {
  const [isPending, startTransition] = useTransition()
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null)

  // Quick edit modal
  const [editingKey, setEditingKey] = useState<keyof SitePictures | null>(null)
  const [customUrl, setCustomUrl] = useState('')
  const [selectedFileForSlot, setSelectedFileForSlot] = useState<File | null>(null)

  // Direct upload state
  const [uploadFile, setUploadFile] = useState<File | null>(null)
  const [uploadAlt, setUploadAlt] = useState('')
  const [uploadAssignKey, setUploadAssignKey] = useState<string>('')

  const showNotification = (type: 'success' | 'error', message: string) => {
    setNotification({ type, message })
    setTimeout(() => setNotification(null), 5000)
  }

  const slotLabels: Record<keyof SitePictures, { fa: string; en: string; descFa: string; descEn: string }> = {
    site_logo: {
      fa: 'لوگوی اصلی کلینیک (نشان شیر و تاج زرین)',
      en: 'Primary Clinic Logo (Golden Crown & Lion Emblem)',
      descFa: 'در نوار بالای سایت (Header)، فوتر، صفحه ورود مدیریت و آیکون‌ها نمایش داده می‌شود.',
      descEn: 'Displayed in site header, footer, admin login, and branding assets.',
    },
    site_signboard: {
      fa: 'تابلوی رسمی و سردرب کلینیک (عکس تابلوی مشکی و طلایی)',
      en: 'Official Clinic Signboard Photo (3D Black & Gold)',
      descFa: 'تصویر تابلوی حقیقی سردر کلینیک با شماره تلفن ۰۲۱۲۶۴۲۹۷۱۵.',
      descEn: 'Authentic 3D luxury facade signboard with phone number 02126429715.',
    },
    hero_reception: {
      fa: 'تصویر اصلی هیرو و سالن پذیرش لوکس',
      en: 'Homepage Hero & Luxury Reception Showcase',
      descFa: 'تصویر بزرگ در بالای صفحه نخست و ویترین فضای مجلل کلینیک.',
      descEn: 'Prominent showcase image in the homepage hero section.',
    },
    division_veterinary: {
      fa: 'تصویر بخش درمان و جراحی‌های تخصصی',
      en: 'Veterinary Medicine & Surgery Division Image',
      descFa: 'تصویر بخش کلینیک و پزشکان جراح دامپزشک.',
      descEn: 'Showcase picture for specialized veterinary surgery & clinic.',
    },
    division_grooming: {
      fa: 'تصویر بخش آرایشگاه و اسپا (گرومینگ)',
      en: 'Pet Spa & Luxury Grooming Division Image',
      descFa: 'تصویر خدمات شستشو، آرایش و بهداشت تخصصی حیوانات خانگی.',
      descEn: 'Showcase picture for pet spa, grooming, and hygiene.',
    },
    division_petshop: {
      fa: 'تصویر بخش پت‌شاپ و بوتیک مجلل',
      en: 'Luxury Pet Boutique & Shop Division Image',
      descFa: 'تصویر محصولات تغذیه اورجینال، اکسسوری و مکمل‌های معتبر.',
      descEn: 'Showcase picture for premium nutrition, accessories, and pet shop.',
    },
    about_clinic: {
      fa: 'تصویر معرفی کلینیک (صفحه درباره ما)',
      en: 'About Clinic Showcase Image',
      descFa: 'تصویر سالن و امکانات بیمارستانی در صفحه درباره پت‌باس.',
      descEn: 'Clinic facilities showcase picture on the About page.',
    },
    about_veterinarian: {
      fa: 'تصویر کادر درمان (صفحه درباره ما)',
      en: 'Veterinary Medical Team Image',
      descFa: 'تصویر پزشکان و کادر مراقبت در صفحه درباره پت‌باس.',
      descEn: 'Veterinary medical staff picture on the About page.',
    },
  }

  // Handle slot update
  const handleSaveSlot = (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingKey) return

    startTransition(async () => {
      if (selectedFileForSlot) {
        const formData = new FormData()
        formData.append('file', selectedFileForSlot)
        formData.append('assignToKey', editingKey)
        formData.append('altFa', slotLabels[editingKey].fa)

        const res = await uploadMediaAction(formData)
        if (res.error) {
          showNotification('error', res.error)
        } else {
          showNotification('success', isEn ? 'Image uploaded and assigned!' : 'تصویر آپلود و تنظیم شد!')
          setEditingKey(null)
          setSelectedFileForSlot(null)
          setCustomUrl('')
        }
      } else if (customUrl.trim()) {
        const res = await updateSitePictureAction(editingKey, customUrl.trim(), slotLabels[editingKey].fa)
        if (res.error) {
          showNotification('error', res.error)
        } else {
          showNotification('success', isEn ? 'Image updated!' : 'تصویر با موفقیت به‌روزرسانی شد!')
          setEditingKey(null)
          setCustomUrl('')
        }
      }
    })
  }

  // Reset to default
  const handleResetSlot = (key: keyof SitePictures) => {
    if (!confirm(isEn ? 'Reset this image to default?' : 'آیا مایل به بازگردانی تصویر به حالت پیش‌فرض هستید؟')) return

    startTransition(async () => {
      const res = await resetSitePictureAction(key)
      if (res.error) {
        showNotification('error', res.error)
      } else {
        showNotification('success', isEn ? 'Image reset to default' : 'تصویر به حالت پیش‌فرض بازگشت.')
      }
    })
  }

  // Handle general upload
  const handleGeneralUpload = (e: React.FormEvent) => {
    e.preventDefault()
    if (!uploadFile) return

    startTransition(async () => {
      const formData = new FormData()
      formData.append('file', uploadFile)
      formData.append('altFa', uploadAlt || 'تصویر آپلود شده')
      if (uploadAssignKey) {
        formData.append('assignToKey', uploadAssignKey)
      }

      const res = await uploadMediaAction(formData)
      if (res.error) {
        showNotification('error', res.error)
      } else {
        showNotification('success', isEn ? 'Image uploaded to library!' : 'فایل با موفقیت در کتابخانه رسانه ذخیره شد!')
        setUploadFile(null)
        setUploadAlt('')
        setUploadAssignKey('')
      }
    })
  }

  // Handle assigning an existing library item to a slot
  const handleAssignLibraryItem = (key: keyof SitePictures, url: string) => {
    startTransition(async () => {
      const res = await updateSitePictureAction(key, url, slotLabels[key].fa)
      if (res.error) {
        showNotification('error', res.error)
      } else {
        showNotification('success', isEn ? 'Assigned successfully!' : 'تصویر با موفقیت برای این بخش تنظیم شد!')
      }
    })
  }

  // Delete from library
  const handleDeleteMedia = (id: string) => {
    if (!confirm(isEn ? 'Delete this image from library?' : 'آیا از حذف این تصویر از کتابخانه رسانه مطمئن هستید؟')) return

    startTransition(async () => {
      const res = await deleteMediaAction(id)
      if (res.error) {
        showNotification('error', res.error)
      } else {
        showNotification('success', isEn ? 'Image deleted' : 'تصویر حذف شد.')
      }
    })
  }

  return (
    <div className="space-y-10">
      {/* Notifications */}
      {notification && (
        <div
          className={`p-4 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all ${
            notification.type === 'success'
              ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-400'
              : 'bg-red-500/10 border border-red-500/30 text-red-400'
          }`}
        >
          <span>{notification.type === 'success' ? '✓' : '⚠️'}</span>
          <span>{notification.message}</span>
        </div>
      )}

      {/* SECTION 1: CORE SITE PICTURES (LIVE PREVIEWS & SLOTS) */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-border">
          <div>
            <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
              <span>🖼️</span>
              <span>{isEn ? 'Core Website Pictures & Signage' : 'تصاویر اصلی و تابلوی وبسایت'}</span>
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              {isEn
                ? 'All primary pictures displayed on the website. Click "Change Image" on any card to update.'
                : 'تمامی تصاویر اصلی سایت. با کلیک روی «تغییر تصویر» می‌توانید تصویر جدید آپلود یا لینک دلخواه ثبت کنید.'}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {(Object.keys(slotLabels) as Array<keyof SitePictures>).map((key) => {
            const slot = slotLabels[key]
            const currentUrl = currentPictures[key]

            return (
              <div
                key={key}
                className="bg-surface border border-border hover:border-primary/40 rounded-2xl p-5 flex flex-col justify-between shadow-sm transition-all group"
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <h3 className="text-xs font-bold text-foreground">
                      {isEn ? slot.en : slot.fa}
                    </h3>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-primary/10 text-primary border border-primary/20">
                      {key}
                    </span>
                  </div>

                  <p className="text-[11px] text-muted-foreground mb-4 line-clamp-2">
                    {isEn ? slot.descEn : slot.descFa}
                  </p>

                  {/* Image Preview Box */}
                  <div className="w-full h-44 rounded-xl overflow-hidden bg-charcoal-950/80 border border-border/80 flex items-center justify-center relative p-2 mb-4 group-hover:border-primary/30 transition-all">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={currentUrl}
                      alt={isEn ? slot.en : slot.fa}
                      className="max-h-full max-w-full object-contain rounded-lg drop-shadow-md transition-transform duration-300 group-hover:scale-105"
                    />
                    <div className="absolute bottom-2 start-2 end-2 bg-charcoal-950/80 backdrop-blur-md px-2.5 py-1 rounded-md text-[10px] text-muted-foreground font-mono truncate border border-border/40">
                      {currentUrl}
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 pt-2 border-t border-border/60">
                  <button
                    type="button"
                    onClick={() => {
                      setEditingKey(key)
                      setCustomUrl(currentUrl)
                      setSelectedFileForSlot(null)
                    }}
                    className="flex-1 px-3 py-2 rounded-xl bg-primary text-charcoal-950 font-bold text-xs hover:opacity-90 transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-gold"
                  >
                    <span>✏️</span>
                    <span>{isEn ? 'Change Image' : 'تغییر تصویر'}</span>
                  </button>
                  <button
                    type="button"
                    disabled={isPending}
                    onClick={() => handleResetSlot(key)}
                    className="px-3 py-2 rounded-xl bg-surface-elevated hover:bg-surface-hover text-muted-foreground hover:text-foreground text-xs border border-border transition-all cursor-pointer"
                    title={isEn ? 'Reset to Default Asset' : 'بازنشانی به تصویر پیش‌فرض'}
                  >
                    ↺
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* SECTION 2: QUICK EDIT MODAL */}
      {editingKey && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-surface border border-primary/30 rounded-2xl w-full max-w-lg p-6 shadow-2xl space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <div>
                <h3 className="text-sm font-bold text-foreground">
                  {isEn ? 'Change Image for Slot' : 'تغییر تصویر بخش'}: {isEn ? slotLabels[editingKey].en : slotLabels[editingKey].fa}
                </h3>
                <p className="text-[11px] text-muted-foreground font-mono mt-0.5">
                  key: {editingKey}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setEditingKey(null)}
                className="text-muted-foreground hover:text-foreground text-sm p-1"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveSlot} className="space-y-4">
              {/* Option A: Upload a new file directly */}
              <div className="p-4 rounded-xl bg-surface-card border border-border/80 space-y-2">
                <label className="block text-xs font-bold text-foreground">
                  {isEn ? 'Option A: Upload New File' : 'روش اول: آپلود فایل جدید از کامپیوتر'}
                </label>
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif,image/svg+xml"
                  onChange={(e) => {
                    if (e.target.files?.[0]) {
                      setSelectedFileForSlot(e.target.files[0])
                    }
                  }}
                  className="w-full text-xs text-muted-foreground file:me-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-primary file:text-charcoal-950 hover:file:opacity-90 cursor-pointer"
                />
                {selectedFileForSlot && (
                  <p className="text-[11px] text-primary font-medium">
                    ✓ {selectedFileForSlot.name} ({(selectedFileForSlot.size / 1024).toFixed(1)} KB)
                  </p>
                )}
              </div>

              {/* Option B: Enter Direct URL */}
              <div className="p-4 rounded-xl bg-surface-card border border-border/80 space-y-2">
                <label className="block text-xs font-bold text-foreground">
                  {isEn ? 'Option B: Enter Image URL or Relative Path' : 'روش دوم: درج لینک مستقیم یا مسیر تصویر'}
                </label>
                <input
                  type="text"
                  value={customUrl}
                  onChange={(e) => setCustomUrl(e.target.value)}
                  placeholder="/images/petboss-signboard.jpg or https://..."
                  className="w-full px-3 py-2 rounded-xl bg-surface-elevated border border-border text-xs text-foreground outline-none focus:border-primary font-mono"
                  dir="ltr"
                />
              </div>

              {/* Option C: Select from Library */}
              {mediaLibrary.length > 0 && (
                <div className="space-y-2">
                  <label className="block text-xs font-bold text-foreground">
                    {isEn ? 'Option C: Pick from Media Library' : 'روش سوم: انتخاب از کتابخانه رسانه'}
                  </label>
                  <div className="grid grid-cols-4 gap-2 max-h-32 overflow-y-auto p-2 bg-surface-card rounded-xl border border-border">
                    {mediaLibrary.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => {
                          setCustomUrl(item.url)
                          setSelectedFileForSlot(null)
                        }}
                        className={`p-1 rounded-lg border aspect-square overflow-hidden flex items-center justify-center bg-charcoal-900 transition-all ${
                          customUrl === item.url ? 'border-primary ring-2 ring-primary/30' : 'border-border hover:border-primary/50'
                        }`}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={item.url} alt={item.altFa} className="w-full h-full object-cover" />
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-border">
                <button
                  type="button"
                  onClick={() => setEditingKey(null)}
                  className="px-4 py-2 rounded-xl text-xs font-medium text-muted-foreground hover:text-foreground transition-all"
                >
                  {isEn ? 'Cancel' : 'انصراف'}
                </button>
                <button
                  type="submit"
                  disabled={isPending || (!selectedFileForSlot && !customUrl.trim())}
                  className="px-5 py-2 rounded-xl bg-gradient-gold text-charcoal-950 font-bold text-xs hover:opacity-90 transition-all shadow-gold disabled:opacity-50 cursor-pointer"
                >
                  {isPending ? (isEn ? 'Saving...' : 'در حال ذخیره...') : (isEn ? 'Apply & Save' : 'اعمال و ذخیره تغییرات')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* SECTION 3: UPLOAD NEW MEDIA FILE */}
      <div className="bg-surface border border-border rounded-2xl p-6 shadow-sm space-y-4">
        <h2 className="text-base font-bold text-foreground flex items-center gap-2 pb-2 border-b border-border">
          <span>📤</span>
          <span>{isEn ? 'Upload New Image to Library' : 'آپلود تصویر جدید در کتابخانه رسانه'}</span>
        </h2>

        <form onSubmit={handleGeneralUpload} className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
          <div>
            <label className="block text-xs font-semibold text-foreground/80 mb-1.5">
              {isEn ? 'Select Image File (JPG, PNG, WEBP, SVG) *' : 'فایل تصویر (JPG, PNG, WEBP, SVG) *'}
            </label>
            <input
              type="file"
              required
              accept="image/jpeg,image/png,image/webp,image/gif,image/svg+xml"
              onChange={(e) => {
                if (e.target.files?.[0]) setUploadFile(e.target.files[0])
              }}
              className="w-full text-xs text-muted-foreground file:me-3 file:py-2 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-surface-elevated file:text-foreground hover:file:bg-primary hover:file:text-charcoal-950 cursor-pointer"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-foreground/80 mb-1.5">
              {isEn ? 'Assign Directly To Slot (Optional)' : 'تنظیم مستقیم برای بخش خاص (اختیاری)'}
            </label>
            <select
              value={uploadAssignKey}
              onChange={(e) => setUploadAssignKey(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-surface-elevated border border-border text-xs text-foreground outline-none focus:border-primary"
            >
              <option value="">{isEn ? '-- Just add to library --' : '-- فقط به کتابخانه اضافه شود --'}</option>
              <option value="site_logo">{isEn ? '👑 Primary Site Logo' : '👑 لوگوی اصلی سایت'}</option>
              <option value="site_signboard">{isEn ? '🏨 Clinic Signboard' : '🏨 تابلوی سردر کلینیک'}</option>
              <option value="hero_reception">{isEn ? '✨ Hero Lounge Showcase' : '✨ سالن پذیرش (هیرو اصلی)'}</option>
              <option value="division_veterinary">{isEn ? '🩺 Veterinary Division' : '🩺 بخش درمان و جراحی'}</option>
              <option value="division_grooming">{isEn ? '✂️ Spa & Grooming Division' : '✂️ بخش آرایشگاه و اسپا'}</option>
              <option value="division_petshop">{isEn ? '🛍️ Pet Boutique Division' : '🛍️ بخش پت‌شاپ'}</option>
            </select>
          </div>

          <div>
            <button
              type="submit"
              disabled={isPending || !uploadFile}
              className="w-full px-4 py-2.5 rounded-xl bg-gradient-gold text-charcoal-950 font-bold text-xs hover:opacity-90 transition-all shadow-gold disabled:opacity-50 cursor-pointer"
            >
              {isPending ? (isEn ? 'Uploading...' : 'در حال بارگذاری...') : (isEn ? 'Upload File' : 'آپلود فایل')}
            </button>
          </div>
        </form>
      </div>

      {/* SECTION 4: MEDIA LIBRARY GRID */}
      <div className="space-y-4">
        <div className="flex items-center justify-between pb-2 border-b border-border">
          <h2 className="text-base font-bold text-foreground flex items-center gap-2">
            <span>📚</span>
            <span>{isEn ? 'Media Library' : 'کتابخانه رسانه‌ها'}</span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-surface-elevated text-primary font-mono">
              {mediaLibrary.length}
            </span>
          </h2>
        </div>

        {mediaLibrary.length === 0 ? (
          <div className="p-12 text-center rounded-2xl bg-surface border border-border border-dashed text-muted-foreground">
            <p className="text-sm">{isEn ? 'No uploaded media in library yet.' : 'هنوز فایلی در کتابخانه رسانه آپلود نشده است.'}</p>
            <p className="text-xs mt-1">{isEn ? 'Upload images using the form above.' : 'با استفاده از فرم بالا می‌توانید تصاویر جدید را بارگذاری کنید.'}</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {mediaLibrary.map((item) => (
              <div
                key={item.id}
                className="bg-surface border border-border hover:border-primary/40 rounded-xl overflow-hidden shadow-sm flex flex-col justify-between group transition-all"
              >
                <div className="aspect-square bg-charcoal-950 relative overflow-hidden flex items-center justify-center p-2">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={item.url}
                    alt={item.altFa}
                    className="max-h-full max-w-full object-contain group-hover:scale-105 transition-transform"
                  />
                  <div className="absolute top-1 end-1">
                    <button
                      type="button"
                      onClick={() => handleDeleteMedia(item.id)}
                      className="p-1.5 rounded-lg bg-red-500/80 hover:bg-red-600 text-white text-xs opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer shadow"
                      title={isEn ? 'Delete' : 'حذف'}
                    >
                      🗑️
                    </button>
                  </div>
                </div>

                <div className="p-2.5 space-y-2 text-[11px]">
                  <p className="truncate font-mono text-muted-foreground" title={item.url}>
                    {item.url}
                  </p>

                  <div className="grid grid-cols-2 gap-1 pt-1 border-t border-border">
                    <button
                      type="button"
                      onClick={() => handleAssignLibraryItem('site_logo', item.url)}
                      className="px-1.5 py-1 rounded bg-surface-elevated hover:bg-primary/20 hover:text-primary text-[10px] text-foreground transition-colors text-center truncate"
                      title={isEn ? 'Set as Logo' : 'تنظیم به عنوان لوگو'}
                    >
                      👑 {isEn ? 'Logo' : 'لوگو'}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleAssignLibraryItem('hero_reception', item.url)}
                      className="px-1.5 py-1 rounded bg-surface-elevated hover:bg-primary/20 hover:text-primary text-[10px] text-foreground transition-colors text-center truncate"
                      title={isEn ? 'Set as Hero' : 'تنظیم به عنوان هیرو'}
                    >
                      ✨ {isEn ? 'Hero' : 'هیرو'}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleAssignLibraryItem('site_signboard', item.url)}
                      className="px-1.5 py-1 rounded bg-surface-elevated hover:bg-primary/20 hover:text-primary text-[10px] text-foreground transition-colors text-center truncate"
                      title={isEn ? 'Set as Signboard' : 'تنظیم به عنوان تابلو'}
                    >
                      🏨 {isEn ? 'Sign' : 'تابلو'}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(item.url)
                        showNotification('success', isEn ? 'URL copied!' : 'آدرس تصویر کپی شد!')
                      }}
                      className="px-1.5 py-1 rounded bg-surface-elevated hover:bg-surface-hover text-[10px] text-muted-foreground hover:text-foreground transition-colors text-center truncate"
                      title={isEn ? 'Copy URL' : 'کپی آدرس'}
                    >
                      📋 {isEn ? 'Copy' : 'کپی'}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
