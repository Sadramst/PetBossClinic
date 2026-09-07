'use client'

import React, { useState, useTransition } from 'react'
import {
  createDivisionAction,
  updateDivisionAction,
  toggleDivisionActiveAction,
  deleteDivisionAction,
} from '@/app/actions/divisions'

interface DivisionWithCount {
  id: string
  nameFa: string
  nameEn: string | null
  slugFa: string
  slugEn: string | null
  descriptionFa: string | null
  descriptionEn: string | null
  isActive: boolean
  _count: {
    services: number
  }
}

interface Props {
  divisions: DivisionWithCount[]
  isEn: boolean
}

export function DivisionsManager({ divisions, isEn }: Props) {
  const [isPending, startTransition] = useTransition()
  const [modalOpen, setModalOpen] = useState(false)
  const [editingDiv, setEditingDiv] = useState<DivisionWithCount | null>(null)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  // Form states
  const [nameFa, setNameFa] = useState('')
  const [nameEn, setNameEn] = useState('')
  const [slugFa, setSlugFa] = useState('')
  const [slugEn, setSlugEn] = useState('')
  const [descriptionFa, setDescriptionFa] = useState('')
  const [descriptionEn, setDescriptionEn] = useState('')
  const [isActive, setIsActive] = useState(true)

  const openAddModal = () => {
    setEditingDiv(null)
    setNameFa('')
    setNameEn('')
    setSlugFa('')
    setSlugEn('')
    setDescriptionFa('')
    setDescriptionEn('')
    setIsActive(true)
    setMessage(null)
    setModalOpen(true)
  }

  const openEditModal = (d: DivisionWithCount) => {
    setEditingDiv(d)
    setNameFa(d.nameFa)
    setNameEn(d.nameEn || '')
    setSlugFa(d.slugFa)
    setSlugEn(d.slugEn || '')
    setDescriptionFa(d.descriptionFa || '')
    setDescriptionEn(d.descriptionEn || '')
    setIsActive(d.isActive)
    setMessage(null)
    setModalOpen(true)
  }

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault()
    setMessage(null)

    const formData = new FormData()
    formData.append('nameFa', nameFa)
    formData.append('nameEn', nameEn)
    formData.append('slugFa', slugFa)
    formData.append('slugEn', slugEn)
    formData.append('descriptionFa', descriptionFa)
    formData.append('descriptionEn', descriptionEn)
    formData.append('isActive', isActive ? 'true' : 'false')

    startTransition(async () => {
      let res
      if (editingDiv) {
        res = await updateDivisionAction(editingDiv.id, formData)
      } else {
        res = await createDivisionAction(formData)
      }

      if (res.error) {
        setMessage({ type: 'error', text: res.error })
      } else {
        setMessage({ type: 'success', text: res.message || (isEn ? 'Saved successfully' : 'با موفقیت ذخیره شد.') })
        setTimeout(() => setModalOpen(false), 800)
      }
    })
  }

  const handleToggle = (d: DivisionWithCount) => {
    startTransition(async () => {
      await toggleDivisionActiveAction(d.id)
    })
  }

  const handleDelete = (d: DivisionWithCount) => {
    const confirmText = isEn
      ? `Are you sure you want to delete "${d.nameEn || d.nameFa}"?`
      : `آیا از حذف بخش "${d.nameFa}" اطمینان دارید؟`
    if (!window.confirm(confirmText)) return

    startTransition(async () => {
      const res = await deleteDivisionAction(d.id)
      if (res.error) {
        alert(res.error)
      }
    })
  }

  return (
    <div className="space-y-6">
      {/* Top Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            {isEn ? 'Core Clinic Departments' : 'بخش‌های اصلی کلینیک'}
          </h1>
          <p className="text-sm text-muted-foreground">
            {isEn
              ? 'Manage clinical divisions, services grouping, and descriptions'
              : 'مدیریت بخش‌های درمانی، گرومینگ و پت‌شاپ کلینیک پت‌باس'}
          </p>
        </div>
        <button
          onClick={openAddModal}
          className="bg-gradient-to-r from-primary to-[#DFC07A] text-charcoal-950 font-bold px-4 py-2.5 rounded-xl text-xs shadow-gold hover:opacity-95 transition-all cursor-pointer flex items-center gap-1.5"
        >
          <span>➕</span>
          <span>{isEn ? 'Add New Division' : 'افزودن بخش جدید'}</span>
        </button>
      </div>

      {/* Grid of Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {divisions.map((div) => {
          const divName = isEn ? (div.nameEn || div.nameFa) : div.nameFa
          const divDesc = isEn ? (div.descriptionEn || div.descriptionFa) : div.descriptionFa

          return (
            <div key={div.id} className="bg-surface border border-border rounded-2xl p-6 space-y-4 shadow-sm flex flex-col justify-between">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-primary bg-primary/10 border border-primary/20 px-2.5 py-0.5 rounded-full">
                    {div._count.services} {isEn ? 'services registered' : 'خدمت ثبت شده'}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleToggle(div)}
                    disabled={isPending}
                    title={isEn ? 'Toggle status' : 'تغییر وضعیت'}
                    className={`text-[11px] px-2 py-0.5 rounded-full font-medium transition-all cursor-pointer ${
                      div.isActive
                        ? 'text-emerald-400 bg-emerald-500/15 border border-emerald-500/30'
                        : 'text-rose-400 bg-rose-500/15 border border-rose-500/30'
                    }`}
                  >
                    {div.isActive ? (isEn ? 'Active' : 'فعال') : (isEn ? 'Inactive' : 'غیرفعال')}
                  </button>
                </div>
                <div>
                  <h3 className="text-lg font-bold text-foreground">{divName}</h3>
                  <p className="text-[11px] text-muted-foreground font-mono">{div.slugFa}</p>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {divDesc || (isEn ? 'No description provided' : 'بدون توضیحات ثبت شده')}
                </p>
              </div>

              <div className="pt-3 border-t border-border flex items-center justify-between">
                <button
                  onClick={() => openEditModal(div)}
                  className="text-xs text-primary font-bold hover:underline cursor-pointer flex items-center gap-1"
                >
                  ✏️ {isEn ? 'Edit Division' : 'ویرایش بخش'}
                </button>
                <button
                  onClick={() => handleDelete(div)}
                  className="text-xs text-red-400 hover:text-red-300 transition-colors p-1"
                  title={isEn ? 'Delete division' : 'حذف بخش'}
                >
                  🗑️
                </button>
              </div>
            </div>
          )
        })}
      </div>

      {/* Modal Dialog */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#181A20] border border-primary/30 rounded-2xl w-full max-w-lg p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <h2 className="text-base font-bold text-foreground">
                {editingDiv
                  ? (isEn ? 'Edit Division' : 'ویرایش بخش کلینیک')
                  : (isEn ? 'Add New Division' : 'افزودن بخش جدید')}
              </h2>
              <button
                onClick={() => setModalOpen(false)}
                className="text-muted-foreground hover:text-foreground text-sm p-1"
              >
                ✕
              </button>
            </div>

            {message && (
              <div
                className={`p-3 rounded-xl text-xs font-medium ${
                  message.type === 'success'
                    ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-400'
                    : 'bg-red-500/10 border border-red-500/30 text-red-400'
                }`}
              >
                {message.text}
              </div>
            )}

            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-foreground/80 mb-1">
                  {isEn ? 'Name (Persian) *' : 'نام بخش (فارسی) *'}
                </label>
                <input
                  type="text"
                  required
                  value={nameFa}
                  onChange={(e) => setNameFa(e.target.value)}
                  placeholder="مثال: بخش جراحی و بیهوشی تخصصی"
                  className="w-full px-3.5 py-2 rounded-xl bg-surface-elevated border border-border text-xs text-foreground focus:border-primary outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-foreground/80 mb-1">
                  {isEn ? 'Name (English)' : 'نام بخش (انگلیسی)'}
                </label>
                <input
                  type="text"
                  value={nameEn}
                  onChange={(e) => setNameEn(e.target.value)}
                  placeholder="e.g. Surgery & Anesthesiology"
                  className="w-full px-3.5 py-2 rounded-xl bg-surface-elevated border border-border text-xs text-foreground focus:border-primary outline-none dir-ltr"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-foreground/80 mb-1">
                  {isEn ? 'Slug (URL identifier)' : 'نامک (شناسه URL - اختیاری)'}
                </label>
                <input
                  type="text"
                  value={slugFa}
                  onChange={(e) => setSlugFa(e.target.value)}
                  placeholder="surgery"
                  className="w-full px-3.5 py-2 rounded-xl bg-surface-elevated border border-border text-xs text-foreground focus:border-primary outline-none dir-ltr"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-foreground/80 mb-1">
                  {isEn ? 'Description (Persian)' : 'توضیحات معرفی بخش (فارسی)'}
                </label>
                <textarea
                  rows={3}
                  value={descriptionFa}
                  onChange={(e) => setDescriptionFa(e.target.value)}
                  placeholder="شرح امکانات و خدمات این بخش..."
                  className="w-full px-3.5 py-2 rounded-xl bg-surface-elevated border border-border text-xs text-foreground focus:border-primary outline-none"
                />
              </div>

              <div className="flex items-center gap-2 pt-2">
                <input
                  type="checkbox"
                  id="divActiveCheck"
                  checked={isActive}
                  onChange={(e) => setIsActive(e.target.checked)}
                  className="rounded border-border text-primary focus:ring-primary w-4 h-4 cursor-pointer"
                />
                <label htmlFor="divActiveCheck" className="text-xs text-foreground cursor-pointer select-none">
                  {isEn ? 'Active & operational' : 'فعال و در حال خدمت‌رسانی'}
                </label>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-border">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-border text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  {isEn ? 'Cancel' : 'انصراف'}
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="px-5 py-2 rounded-xl bg-primary text-charcoal-950 font-bold text-xs hover:opacity-90 active:scale-[0.99] transition-all shadow-gold disabled:opacity-50 cursor-pointer"
                >
                  {isPending ? (isEn ? 'Saving...' : 'در حال ذخیره...') : (isEn ? 'Save Division' : 'ذخیره بخش')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
