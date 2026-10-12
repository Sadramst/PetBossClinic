'use client'

import React, { useState, useTransition } from 'react'
import {
  upsertTestimonialAction,
  toggleTestimonialAction,
  deleteTestimonialAction,
} from '@/app/actions/testimonials'

export interface TestimonialItem {
  id: string
  nameFa: string
  nameEn: string | null
  contentFa: string
  contentEn: string | null
  rating: number
  isActive: boolean
  sortOrder: number
}

interface Props {
  testimonials: TestimonialItem[]
  isEn: boolean
}

export function TestimonialsManager({ testimonials, isEn }: Props) {
  const [isPending, startTransition] = useTransition()
  const [modalOpen, setModalOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<TestimonialItem | null>(null)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  // Form fields
  const [nameFa, setNameFa] = useState('')
  const [nameEn, setNameEn] = useState('')
  const [contentFa, setContentFa] = useState('')
  const [contentEn, setContentEn] = useState('')
  const [rating, setRating] = useState('5')
  const [sortOrder, setSortOrder] = useState('0')
  const [isActive, setIsActive] = useState(true)

  const openAddModal = () => {
    setEditingItem(null)
    setNameFa('')
    setNameEn('')
    setContentFa('')
    setContentEn('')
    setRating('5')
    setSortOrder((testimonials.length * 10).toString())
    setIsActive(true)
    setMessage(null)
    setModalOpen(true)
  }

  const openEditModal = (item: TestimonialItem) => {
    setEditingItem(item)
    setNameFa(item.nameFa)
    setNameEn(item.nameEn || '')
    setContentFa(item.contentFa)
    setContentEn(item.contentEn || '')
    setRating(item.rating.toString())
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
    formData.append('nameFa', nameFa)
    formData.append('nameEn', nameEn)
    formData.append('contentFa', contentFa)
    formData.append('contentEn', contentEn)
    formData.append('rating', rating)
    formData.append('sortOrder', sortOrder)
    formData.append('isActive', isActive ? 'true' : 'false')

    startTransition(async () => {
      const res = await upsertTestimonialAction(formData)
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
      const res = await toggleTestimonialAction(id, !current)
      if (res.error) setMessage({ type: 'error', text: res.error })
    })
  }

  const handleDelete = (id: string, name: string) => {
    if (!confirm(`آیا از حذف نظر «${name}» اطمینان دارید؟`)) return
    startTransition(async () => {
      const res = await deleteTestimonialAction(id)
      if (res.error) setMessage({ type: 'error', text: res.error })
    })
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-foreground">
            {isEn ? 'Client Testimonials' : 'مدیریت نظرات مراجعین کلینیک'}
          </h1>
          <p className="text-xs text-muted-foreground mt-1">
            {isEn
              ? 'Display verified, genuine client reviews and experiences on the homepage.'
              : 'ثبت و مدیریت نظرات واقعی و مستند مراجعین بخش‌های درمانی و پت‌شاپ.'}
          </p>
        </div>
        <button
          onClick={openAddModal}
          className="px-4 py-2.5 rounded-xl bg-primary text-charcoal-950 font-bold text-xs hover:bg-primary-hover shadow-gold transition-all cursor-pointer flex items-center gap-2 self-start"
        >
          <span>➕</span>
          <span>{isEn ? 'Add Testimonial' : 'افزودن نظر جدید'}</span>
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

      {/* Grid of Testimonials */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {testimonials.map((item) => (
          <div
            key={item.id}
            className={`p-5 rounded-2xl border transition-all flex flex-col justify-between ${
              item.isActive
                ? 'bg-surface border-border hover:border-primary/50'
                : 'bg-surface/50 border-border/50 opacity-60'
            }`}
          >
            <div>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-1 text-primary">
                  {[...Array(item.rating || 5)].map((_, i) => (
                    <span key={i} className="text-sm">⭐</span>
                  ))}
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

              <p className="text-xs text-foreground/90 leading-relaxed mb-4 italic">
                «{item.contentFa}»
              </p>
            </div>

            <div className="pt-3 border-t border-border flex items-center justify-between text-xs">
              <div>
                <span className="font-bold text-foreground block">{item.nameFa}</span>
                {item.nameEn && (
                  <span className="text-[11px] text-muted-foreground">({item.nameEn})</span>
                )}
              </div>

              <div className="flex items-center gap-1">
                <button
                  onClick={() => openEditModal(item)}
                  className="p-1.5 text-muted-foreground hover:text-primary transition-colors cursor-pointer rounded-lg hover:bg-surface-elevated"
                  title={isEn ? 'Edit' : 'ویرایش'}
                >
                  ✏️
                </button>
                <button
                  onClick={() => handleDelete(item.id, item.nameFa)}
                  className="p-1.5 text-muted-foreground hover:text-red-400 transition-colors cursor-pointer rounded-lg hover:bg-surface-elevated"
                  title={isEn ? 'Delete' : 'حذف'}
                >
                  🗑️
                </button>
              </div>
            </div>
          </div>
        ))}

        {testimonials.length === 0 && (
          <div className="col-span-full p-12 text-center border border-dashed border-border rounded-2xl bg-surface/30">
            <span className="text-3xl block mb-2">💬</span>
            <p className="text-sm text-muted-foreground">
              {isEn ? 'No testimonials yet.' : 'هنوز نظری ثبت نشده است.'}
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
                  ? (isEn ? 'Edit Testimonial' : 'ویرایش نظر مراجع')
                  : (isEn ? 'Add Testimonial' : 'افزودن نظر مراجع جدید')}
              </h2>
              <button
                onClick={() => setModalOpen(false)}
                className="text-muted-foreground hover:text-foreground text-lg leading-none cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1">
                    {isEn ? 'Client Name (Persian)' : 'نام مراجع (فارسی)'}
                  </label>
                  <input
                    type="text"
                    value={nameFa}
                    onChange={(e) => setNameFa(e.target.value)}
                    required
                    placeholder="مثال: سارا محمدی"
                    className="w-full px-3 py-2 rounded-xl bg-surface-elevated border border-border text-foreground text-xs focus:outline-none focus:border-primary"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1">
                    {isEn ? 'Client Name (English)' : 'نام مراجع (انگلیسی)'}
                  </label>
                  <input
                    type="text"
                    value={nameEn}
                    onChange={(e) => setNameEn(e.target.value)}
                    placeholder="Sara Mohammadi"
                    dir="ltr"
                    className="w-full px-3 py-2 rounded-xl bg-surface-elevated border border-border text-foreground text-xs focus:outline-none focus:border-primary"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">
                  {isEn ? 'Testimonial Content (Persian)' : 'متن نظر (فارسی)'}
                </label>
                <textarea
                  rows={3}
                  value={contentFa}
                  onChange={(e) => setContentFa(e.target.value)}
                  required
                  placeholder="تجربه مراجعه‌کننده به کلینیک..."
                  className="w-full px-3 py-2 rounded-xl bg-surface-elevated border border-border text-foreground text-xs focus:outline-none focus:border-primary"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">
                  {isEn ? 'Testimonial Content (English)' : 'متن نظر (انگلیسی اختیاری)'}
                </label>
                <textarea
                  rows={2}
                  value={contentEn}
                  onChange={(e) => setContentEn(e.target.value)}
                  placeholder="Client experience review..."
                  dir="ltr"
                  className="w-full px-3 py-2 rounded-xl bg-surface-elevated border border-border text-foreground text-xs focus:outline-none focus:border-primary"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1">
                    {isEn ? 'Rating (1 to 5)' : 'امتیاز (۱ تا ۵ ستاره)'}
                  </label>
                  <select
                    value={rating}
                    onChange={(e) => setRating(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-surface-elevated border border-border text-foreground text-xs focus:outline-none focus:border-primary"
                  >
                    <option value="5">⭐⭐⭐⭐⭐ (۵ ستاره - عالی)</option>
                    <option value="4">⭐⭐⭐⭐ (۴ ستاره - بسیار خوب)</option>
                    <option value="3">⭐⭐⭐ (۳ ستاره - خوب)</option>
                    <option value="2">⭐⭐ (۲ ستاره - متوسط)</option>
                    <option value="1">⭐ (۱ ستاره)</option>
                  </select>
                </div>
                <div className="flex items-center gap-2 pt-6">
                  <input
                    type="checkbox"
                    id="testimonialActive"
                    checked={isActive}
                    onChange={(e) => setIsActive(e.target.checked)}
                    className="rounded border-border text-primary focus:ring-primary w-4 h-4 cursor-pointer"
                  />
                  <label htmlFor="testimonialActive" className="text-xs font-semibold text-foreground cursor-pointer">
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
