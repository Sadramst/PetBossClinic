'use client'

import React, { useState, useTransition } from 'react'
import {
  createServiceAction,
  updateServiceAction,
  toggleServiceActiveAction,
  deleteServiceAction,
} from '@/app/actions/services'

interface DivisionItem {
  id: string
  nameFa: string
  nameEn: string | null
}

interface ServiceItem {
  id: string
  divisionId: string
  nameFa: string
  nameEn: string | null
  slugFa: string
  slugEn: string | null
  durationFa: string | null
  durationEn: string | null
  priceFrom: number | null
  priceTo: number | null
  descriptionFa: string | null
  descriptionEn: string | null
  isActive: boolean
  division: DivisionItem
}

interface Props {
  services: ServiceItem[]
  divisions: DivisionItem[]
  isEn: boolean
}

export function ServicesManager({ services, divisions, isEn }: Props) {
  const [isPending, startTransition] = useTransition()
  const [modalOpen, setModalOpen] = useState(false)
  const [editingService, setEditingService] = useState<ServiceItem | null>(null)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  // Form states
  const [divisionId, setDivisionId] = useState(divisions[0]?.id || '')
  const [nameFa, setNameFa] = useState('')
  const [nameEn, setNameEn] = useState('')
  const [durationFa, setDurationFa] = useState('')
  const [durationEn, setDurationEn] = useState('')
  const [priceFrom, setPriceFrom] = useState('')
  const [descriptionFa, setDescriptionFa] = useState('')
  const [descriptionEn, setDescriptionEn] = useState('')
  const [isActive, setIsActive] = useState(true)

  const openAddModal = () => {
    setEditingService(null)
    setDivisionId(divisions[0]?.id || '')
    setNameFa('')
    setNameEn('')
    setDurationFa('')
    setDurationEn('')
    setPriceFrom('')
    setDescriptionFa('')
    setDescriptionEn('')
    setIsActive(true)
    setMessage(null)
    setModalOpen(true)
  }

  const openEditModal = (s: ServiceItem) => {
    setEditingService(s)
    setDivisionId(s.divisionId)
    setNameFa(s.nameFa)
    setNameEn(s.nameEn || '')
    setDurationFa(s.durationFa || '')
    setDurationEn(s.durationEn || '')
    setPriceFrom(s.priceFrom ? s.priceFrom.toString() : '')
    setDescriptionFa(s.descriptionFa || '')
    setDescriptionEn(s.descriptionEn || '')
    setIsActive(s.isActive)
    setMessage(null)
    setModalOpen(true)
  }

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault()
    setMessage(null)

    const formData = new FormData()
    formData.append('divisionId', divisionId)
    formData.append('nameFa', nameFa)
    formData.append('nameEn', nameEn)
    formData.append('durationFa', durationFa)
    formData.append('durationEn', durationEn)
    formData.append('priceFrom', priceFrom)
    formData.append('descriptionFa', descriptionFa)
    formData.append('descriptionEn', descriptionEn)
    formData.append('isActive', isActive ? 'true' : 'false')

    startTransition(async () => {
      let res
      if (editingService) {
        res = await updateServiceAction(editingService.id, formData)
      } else {
        res = await createServiceAction(formData)
      }

      if (res.error) {
        setMessage({ type: 'error', text: res.error })
      } else {
        setMessage({ type: 'success', text: res.message || (isEn ? 'Operation successful' : 'عملیات با موفقیت انجام شد.') })
        setTimeout(() => setModalOpen(false), 800)
      }
    })
  }

  const handleToggle = (s: ServiceItem) => {
    startTransition(async () => {
      await toggleServiceActiveAction(s.id)
    })
  }

  const handleDelete = (s: ServiceItem) => {
    const confirmText = isEn
      ? `Are you sure you want to delete "${s.nameEn || s.nameFa}"?`
      : `آیا از حذف خدمت "${s.nameFa}" اطمینان دارید؟`
    if (!window.confirm(confirmText)) return

    startTransition(async () => {
      const res = await deleteServiceAction(s.id)
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
            {isEn ? 'Clinic Services Management' : 'مدیریت خدمات کلینیک'}
          </h1>
          <p className="text-sm text-muted-foreground">
            {isEn ? 'View, add, edit, and toggle clinical procedures & pricing' : 'مشاهده، افزودن، ویرایش و تنظیم وضعیت خدمات و تعرفه‌ها'}
          </p>
        </div>
        <button
          onClick={openAddModal}
          className="bg-gradient-to-r from-primary to-[#DFC07A] text-charcoal-950 font-bold px-4 py-2.5 rounded-xl text-xs shadow-gold hover:opacity-95 transition-all cursor-pointer flex items-center gap-1.5"
        >
          <span>➕</span>
          <span>{isEn ? 'Add New Service' : 'افزودن خدمت جدید'}</span>
        </button>
      </div>

      {/* Services Table Card */}
      <div className="bg-surface border border-border rounded-2xl overflow-hidden shadow-sm">
        <div className="p-4 border-b border-border bg-surface-elevated/40 flex items-center justify-between">
          <h2 className="text-xs font-bold text-foreground">
            {isEn ? `Services Directory (${services.length} services)` : `فهرست خدمات کلینیک (${services.length} خدمت)`}
          </h2>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-start">
            <thead className="bg-surface-elevated text-muted-foreground border-b border-border">
              <tr>
                <th className="px-5 py-3.5 text-start font-semibold">{isEn ? 'Service Title' : 'عنوان خدمت'}</th>
                <th className="px-5 py-3.5 text-start font-semibold">{isEn ? 'Division' : 'بخش'}</th>
                <th className="px-5 py-3.5 text-start font-semibold">{isEn ? 'Duration' : 'مدت زمان'}</th>
                <th className="px-5 py-3.5 text-start font-semibold">{isEn ? 'Base Price (Toman)' : 'قیمت پایه (تومان)'}</th>
                <th className="px-5 py-3.5 text-center font-semibold">{isEn ? 'Status' : 'وضعیت'}</th>
                <th className="px-5 py-3.5 text-center font-semibold">{isEn ? 'Actions' : 'عملیات'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {services.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-8 text-muted-foreground">
                    {isEn ? 'No services found. Click "+ Add New Service" to create one.' : 'هیچ خدمتی ثبت نشده است. با کلیک بر روی "افزودن خدمت جدید" اولین خدمت را ایجاد کنید.'}
                  </td>
                </tr>
              ) : (
                services.map((service) => {
                  const sName = isEn ? (service.nameEn || service.nameFa) : service.nameFa
                  const sDivName = isEn ? (service.division.nameEn || service.division.nameFa) : service.division.nameFa
                  const sDuration = isEn ? (service.durationEn || service.durationFa) : service.durationFa

                  return (
                    <tr key={service.id} className="hover:bg-surface-elevated/50 transition-colors">
                      <td className="px-5 py-4 font-semibold text-foreground">
                        <div>{sName}</div>
                        <div className="text-[11px] text-muted-foreground font-normal">
                          {isEn ? service.nameFa : (service.nameEn || '—')}
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <span className="text-xs bg-primary/10 text-primary px-2.5 py-0.5 rounded-full font-medium border border-primary/20">
                          {sDivName}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-muted-foreground">
                        {sDuration || '—'}
                      </td>
                      <td className="px-5 py-4 font-bold text-primary font-mono">
                        {service.priceFrom
                          ? (isEn ? service.priceFrom.toLocaleString('en-US') : service.priceFrom.toLocaleString('fa-IR'))
                          : (isEn ? 'Inquiry' : 'استعلامی')}
                      </td>
                      <td className="px-5 py-4 text-center">
                        <button
                          type="button"
                          onClick={() => handleToggle(service)}
                          disabled={isPending}
                          title={isEn ? 'Click to toggle status' : 'کلیک برای تغییر وضعیت فعال/غیرفعال'}
                          className={`text-[11px] px-2.5 py-1 rounded-full font-medium transition-all cursor-pointer ${
                            service.isActive
                              ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/25'
                              : 'bg-rose-500/15 text-rose-400 border border-rose-500/30 hover:bg-rose-500/25'
                          }`}
                        >
                          {service.isActive ? (isEn ? '✓ Active' : '✓ فعال') : (isEn ? '✕ Inactive' : '✕ غیرفعال')}
                        </button>
                      </td>
                      <td className="px-5 py-4 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            type="button"
                            onClick={() => openEditModal(service)}
                            className="px-2.5 py-1 rounded-lg bg-surface-elevated hover:bg-primary/20 text-primary border border-primary/30 transition-colors font-medium cursor-pointer"
                          >
                            ✏️ {isEn ? 'Edit' : 'ویرایش'}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(service)}
                            className="px-2.5 py-1 rounded-lg bg-surface-elevated hover:bg-red-500/20 text-red-400 border border-red-500/30 transition-colors cursor-pointer"
                            title={isEn ? 'Delete service' : 'حذف خدمت'}
                          >
                            🗑️
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Dialog */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#181A20] border border-primary/30 rounded-2xl w-full max-w-xl p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <h2 className="text-base font-bold text-foreground">
                {editingService
                  ? (isEn ? 'Edit Clinic Service' : 'ویرایش اطلاعات خدمت')
                  : (isEn ? 'Add New Clinic Service' : 'افزودن خدمت کلینیکی جدید')}
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
                  {isEn ? 'Division / Department *' : 'بخش درمانی مربوطه *'}
                </label>
                <select
                  value={divisionId}
                  onChange={(e) => setDivisionId(e.target.value)}
                  required
                  className="w-full px-3.5 py-2 rounded-xl bg-surface-elevated border border-border text-xs text-foreground focus:border-primary outline-none"
                >
                  {divisions.map((div) => (
                    <option key={div.id} value={div.id}>
                      {isEn ? (div.nameEn || div.nameFa) : div.nameFa}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-foreground/80 mb-1">
                    {isEn ? 'Name (Persian) *' : 'نام خدمت (فارسی) *'}
                  </label>
                  <input
                    type="text"
                    required
                    value={nameFa}
                    onChange={(e) => setNameFa(e.target.value)}
                    placeholder="مثال: واکسیناسیون جامع و صدور شناسنامه"
                    className="w-full px-3.5 py-2 rounded-xl bg-surface-elevated border border-border text-xs text-foreground focus:border-primary outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-foreground/80 mb-1">
                    {isEn ? 'Name (English)' : 'نام خدمت (انگلیسی)'}
                  </label>
                  <input
                    type="text"
                    value={nameEn}
                    onChange={(e) => setNameEn(e.target.value)}
                    placeholder="e.g. Comprehensive Vaccination"
                    className="w-full px-3.5 py-2 rounded-xl bg-surface-elevated border border-border text-xs text-foreground focus:border-primary outline-none dir-ltr"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-foreground/80 mb-1">
                    {isEn ? 'Duration (Persian)' : 'مدت زمان (فارسی)'}
                  </label>
                  <input
                    type="text"
                    value={durationFa}
                    onChange={(e) => setDurationFa(e.target.value)}
                    placeholder="مثال: ۳۰ تا ۴۵ دقیقه"
                    className="w-full px-3.5 py-2 rounded-xl bg-surface-elevated border border-border text-xs text-foreground focus:border-primary outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-foreground/80 mb-1">
                    {isEn ? 'Duration (English)' : 'مدت زمان (انگلیسی)'}
                  </label>
                  <input
                    type="text"
                    value={durationEn}
                    onChange={(e) => setDurationEn(e.target.value)}
                    placeholder="e.g. 30 - 45 min"
                    className="w-full px-3.5 py-2 rounded-xl bg-surface-elevated border border-border text-xs text-foreground focus:border-primary outline-none dir-ltr"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-foreground/80 mb-1">
                  {isEn ? 'Base Price in Tomans (optional)' : 'قیمت پایه به تومان (اختیاری)'}
                </label>
                <input
                  type="number"
                  value={priceFrom}
                  onChange={(e) => setPriceFrom(e.target.value)}
                  placeholder="350000"
                  className="w-full px-3.5 py-2 rounded-xl bg-surface-elevated border border-border text-xs text-foreground focus:border-primary outline-none font-mono dir-ltr"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-foreground/80 mb-1">
                  {isEn ? 'Description (Persian)' : 'توضیحات تکمیلی (فارسی)'}
                </label>
                <textarea
                  rows={3}
                  value={descriptionFa}
                  onChange={(e) => setDescriptionFa(e.target.value)}
                  placeholder="شرح کوتاه فرآیند انجام خدمت..."
                  className="w-full px-3.5 py-2 rounded-xl bg-surface-elevated border border-border text-xs text-foreground focus:border-primary outline-none"
                />
              </div>

              <div className="flex items-center gap-2 pt-2">
                <input
                  type="checkbox"
                  id="isActiveCheck"
                  checked={isActive}
                  onChange={(e) => setIsActive(e.target.checked)}
                  className="rounded border-border text-primary focus:ring-primary w-4 h-4 cursor-pointer"
                />
                <label htmlFor="isActiveCheck" className="text-xs text-foreground cursor-pointer select-none">
                  {isEn ? 'Active & visible on public site' : 'فعال و قابل مشاهده در وب‌سایت'}
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
                  {isPending ? (isEn ? 'Saving...' : 'در حال ذخیره...') : (isEn ? 'Save Service' : 'ذخیره خدمت')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
