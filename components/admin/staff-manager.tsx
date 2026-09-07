'use client'

import React, { useState, useTransition } from 'react'
import {
  createStaffAction,
  updateStaffAction,
  toggleStaffActiveAction,
  deleteStaffAction,
} from '@/app/actions/staff'

interface StaffItem {
  id: string
  nameFa: string
  nameEn: string | null
  titleFa: string | null
  titleEn: string | null
  specialtyFa: string | null
  specialtyEn: string | null
  bioFa: string | null
  bioEn: string | null
  licenseNo: string | null
  isActive: boolean
}

interface Props {
  staff: StaffItem[]
  isEn: boolean
}

export function StaffManager({ staff, isEn }: Props) {
  const [isPending, startTransition] = useTransition()
  const [modalOpen, setModalOpen] = useState(false)
  const [editingStaff, setEditingStaff] = useState<StaffItem | null>(null)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  // Form fields
  const [nameFa, setNameFa] = useState('')
  const [nameEn, setNameEn] = useState('')
  const [titleFa, setTitleFa] = useState('')
  const [titleEn, setTitleEn] = useState('')
  const [specialtyFa, setSpecialtyFa] = useState('')
  const [specialtyEn, setSpecialtyEn] = useState('')
  const [licenseNo, setLicenseNo] = useState('')
  const [bioFa, setBioFa] = useState('')
  const [bioEn, setBioEn] = useState('')
  const [isActive, setIsActive] = useState(true)

  const openAddModal = () => {
    setEditingStaff(null)
    setNameFa('')
    setNameEn('')
    setTitleFa('')
    setTitleEn('')
    setSpecialtyFa('')
    setSpecialtyEn('')
    setLicenseNo('')
    setBioFa('')
    setBioEn('')
    setIsActive(true)
    setMessage(null)
    setModalOpen(true)
  }

  const openEditModal = (s: StaffItem) => {
    setEditingStaff(s)
    setNameFa(s.nameFa)
    setNameEn(s.nameEn || '')
    setTitleFa(s.titleFa || '')
    setTitleEn(s.titleEn || '')
    setSpecialtyFa(s.specialtyFa || '')
    setSpecialtyEn(s.specialtyEn || '')
    setLicenseNo(s.licenseNo || '')
    setBioFa(s.bioFa || '')
    setBioEn(s.bioEn || '')
    setIsActive(s.isActive)
    setMessage(null)
    setModalOpen(true)
  }

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault()
    setMessage(null)

    const formData = new FormData()
    formData.append('nameFa', nameFa)
    formData.append('nameEn', nameEn)
    formData.append('titleFa', titleFa)
    formData.append('titleEn', titleEn)
    formData.append('specialtyFa', specialtyFa)
    formData.append('specialtyEn', specialtyEn)
    formData.append('licenseNo', licenseNo)
    formData.append('bioFa', bioFa)
    formData.append('bioEn', bioEn)
    formData.append('isActive', isActive ? 'true' : 'false')

    startTransition(async () => {
      let res
      if (editingStaff) {
        res = await updateStaffAction(editingStaff.id, formData)
      } else {
        res = await createStaffAction(formData)
      }

      if (res.error) {
        setMessage({ type: 'error', text: res.error })
      } else {
        setMessage({ type: 'success', text: res.message || (isEn ? 'Saved successfully' : 'با موفقیت ذخیره شد.') })
        setTimeout(() => setModalOpen(false), 800)
      }
    })
  }

  const handleToggle = (s: StaffItem) => {
    startTransition(async () => {
      await toggleStaffActiveAction(s.id)
    })
  }

  const handleDelete = (s: StaffItem) => {
    const confirmText = isEn
      ? `Are you sure you want to delete ${s.nameEn || s.nameFa}?`
      : `آیا از حذف ${s.nameFa} اطمینان دارید؟`
    if (!window.confirm(confirmText)) return

    startTransition(async () => {
      const res = await deleteStaffAction(s.id)
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
            {isEn ? 'Veterinary & Medical Staff' : 'کادر پزشکی و درمانی'}
          </h1>
          <p className="text-sm text-muted-foreground">
            {isEn
              ? 'Manage veterinarian profiles, titles, veterinary license numbers, and specialties'
              : 'مدیریت مشخصات دامپزشکان، تخصص‌ها، سوابق و شماره نظام دامپزشکی'}
          </p>
        </div>
        <button
          onClick={openAddModal}
          className="bg-gradient-to-r from-primary to-[#DFC07A] text-charcoal-950 font-bold px-4 py-2.5 rounded-xl text-xs shadow-gold hover:opacity-95 transition-all cursor-pointer flex items-center gap-1.5"
        >
          <span>➕</span>
          <span>{isEn ? 'Add New Veterinarian' : 'افزودن پزشک جدید'}</span>
        </button>
      </div>

      {/* Grid of Doctors */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {staff.length === 0 ? (
          <div className="col-span-full py-12 text-center bg-surface border border-border rounded-2xl">
            <p className="text-muted-foreground text-sm">
              {isEn
                ? 'No veterinarians registered yet. Click "+ Add New Veterinarian" to add the real clinic team.'
                : 'هنوز دامپزشکی ثبت نشده است. برای ثبت تیم پزشکی واقعی کلینیک، بر روی "+ افزودن پزشک جدید" کلیک کنید.'}
            </p>
          </div>
        ) : (
          staff.map((member) => {
            const mName = isEn ? (member.nameEn || member.nameFa) : member.nameFa
            const mTitle = isEn ? (member.titleEn || member.titleFa) : member.titleFa
            const mBio = isEn ? (member.bioEn || member.bioFa) : member.bioFa

            return (
              <div key={member.id} className="bg-surface border border-border rounded-2xl p-6 flex flex-col justify-between shadow-sm space-y-4">
                <div>
                  <div className="flex items-center gap-4 mb-4">
                    <div className="w-14 h-14 rounded-full bg-surface-elevated border-2 border-border-gold flex items-center justify-center text-primary font-bold text-xl shadow-gold shrink-0">
                      {mName.charAt(0)}
                    </div>
                    <div>
                      <h3 className="font-bold text-foreground text-base">{mName}</h3>
                      <p className="text-xs text-primary font-semibold">{mTitle || (isEn ? 'Veterinarian' : 'دامپزشک')}</p>
                      {member.licenseNo && (
                        <span className="text-[11px] text-muted-foreground block mt-0.5 font-mono">
                          {isEn ? 'License:' : 'نظام:'} {member.licenseNo}
                        </span>
                      )}
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    {mBio || (isEn ? 'No biography provided' : 'بدون بیوگرافی ثبت شده')}
                  </p>
                </div>

                <div className="pt-3 border-t border-border flex items-center justify-between text-xs">
                  <button
                    type="button"
                    onClick={() => handleToggle(member)}
                    disabled={isPending}
                    className={`px-2 py-0.5 rounded-full text-[11px] font-medium transition-all cursor-pointer ${
                      member.isActive
                        ? 'text-emerald-400 bg-emerald-500/15 border border-emerald-500/30'
                        : 'text-rose-400 bg-rose-500/15 border border-rose-500/30'
                    }`}
                  >
                    {member.isActive ? (isEn ? 'Active' : 'فعال') : (isEn ? 'Inactive' : 'غیرفعال')}
                  </button>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => openEditModal(member)}
                      className="text-primary font-bold hover:underline cursor-pointer"
                    >
                      ✏️ {isEn ? 'Edit' : 'ویرایش'}
                    </button>
                    <span className="text-border">|</span>
                    <button
                      onClick={() => handleDelete(member)}
                      className="text-red-400 hover:text-red-300 p-1"
                      title={isEn ? 'Delete doctor' : 'حذف'}
                    >
                      🗑️
                    </button>
                  </div>
                </div>
              </div>
            )
          })
        )}
      </div>

      {/* Modal Dialog */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#181A20] border border-primary/30 rounded-2xl w-full max-w-xl p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <h2 className="text-base font-bold text-foreground">
                {editingStaff
                  ? (isEn ? 'Edit Veterinarian Profile' : 'ویرایش مشخصات دامپزشک')
                  : (isEn ? 'Add New Veterinarian' : 'افزودن دامپزشک جدید')}
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
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-foreground/80 mb-1">
                    {isEn ? 'Full Name (Persian) *' : 'نام و نام خانوادگی (فارسی) *'}
                  </label>
                  <input
                    type="text"
                    required
                    value={nameFa}
                    onChange={(e) => setNameFa(e.target.value)}
                    placeholder="مثال: دکتر مهدی صابری"
                    className="w-full px-3.5 py-2 rounded-xl bg-surface-elevated border border-border text-xs text-foreground focus:border-primary outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-foreground/80 mb-1">
                    {isEn ? 'Full Name (English)' : 'نام و نام خانوادگی (انگلیسی)'}
                  </label>
                  <input
                    type="text"
                    value={nameEn}
                    onChange={(e) => setNameEn(e.target.value)}
                    placeholder="e.g. Dr. Mehdi Saberi"
                    className="w-full px-3.5 py-2 rounded-xl bg-surface-elevated border border-border text-xs text-foreground focus:border-primary outline-none dir-ltr"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-foreground/80 mb-1">
                    {isEn ? 'Title / Position (Persian)' : 'سمت و عنوان (فارسی)'}
                  </label>
                  <input
                    type="text"
                    value={titleFa}
                    onChange={(e) => setTitleFa(e.target.value)}
                    placeholder="مثال: جراح ارشد دامپزشکی"
                    className="w-full px-3.5 py-2 rounded-xl bg-surface-elevated border border-border text-xs text-foreground focus:border-primary outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-foreground/80 mb-1">
                    {isEn ? 'Title / Position (English)' : 'سمت و عنوان (انگلیسی)'}
                  </label>
                  <input
                    type="text"
                    value={titleEn}
                    onChange={(e) => setTitleEn(e.target.value)}
                    placeholder="e.g. Senior Veterinary Surgeon"
                    className="w-full px-3.5 py-2 rounded-xl bg-surface-elevated border border-border text-xs text-foreground focus:border-primary outline-none dir-ltr"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-foreground/80 mb-1">
                    {isEn ? 'Veterinary License No.' : 'شماره نظام دامپزشکی'}
                  </label>
                  <input
                    type="text"
                    value={licenseNo}
                    onChange={(e) => setLicenseNo(e.target.value)}
                    placeholder="مثال: ۱۲۳۴۵"
                    className="w-full px-3.5 py-2 rounded-xl bg-surface-elevated border border-border text-xs text-foreground focus:border-primary outline-none font-mono dir-ltr"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-foreground/80 mb-1">
                    {isEn ? 'Specialty' : 'تخصص اصلی'}
                  </label>
                  <input
                    type="text"
                    value={specialtyFa}
                    onChange={(e) => setSpecialtyFa(e.target.value)}
                    placeholder="مثال: جراحی بافت نرم و ارتوپدی"
                    className="w-full px-3.5 py-2 rounded-xl bg-surface-elevated border border-border text-xs text-foreground focus:border-primary outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-foreground/80 mb-1">
                  {isEn ? 'Biography & Background (Persian)' : 'رزومه و بیوگرافی (فارسی)'}
                </label>
                <textarea
                  rows={3}
                  value={bioFa}
                  onChange={(e) => setBioFa(e.target.value)}
                  placeholder="سوابق دانشگاهی، تخصص‌ها و دستاوردهای بالینی..."
                  className="w-full px-3.5 py-2 rounded-xl bg-surface-elevated border border-border text-xs text-foreground focus:border-primary outline-none"
                />
              </div>

              <div className="flex items-center gap-2 pt-2">
                <input
                  type="checkbox"
                  id="staffActiveCheck"
                  checked={isActive}
                  onChange={(e) => setIsActive(e.target.checked)}
                  className="rounded border-border text-primary focus:ring-primary w-4 h-4 cursor-pointer"
                />
                <label htmlFor="staffActiveCheck" className="text-xs text-foreground cursor-pointer select-none">
                  {isEn ? 'Active & displayed on clinic team page' : 'فعال و نمایش در صفحه معرفی کادر درمانی'}
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
                  {isPending ? (isEn ? 'Saving...' : 'در حال ذخیره...') : (isEn ? 'Save Profile' : 'ذخیره پزشک')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
