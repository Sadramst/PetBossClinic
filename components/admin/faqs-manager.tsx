'use client'

import React, { useState, useTransition } from 'react'
import {
  createFaqAction,
  updateFaqAction,
  deleteFaqAction,
} from '@/app/actions/faqs'

interface FaqCategoryItem {
  id: string
  nameFa: string
  nameEn: string | null
}

interface FaqItem {
  id: string
  categoryId: string | null
  questionFa: string
  questionEn: string | null
  answerFa: string
  answerEn: string | null
  isActive: boolean
  category: FaqCategoryItem | null
}

interface Props {
  faqs: FaqItem[]
  categories: FaqCategoryItem[]
  isEn: boolean
}

export function FaqsManager({ faqs, categories, isEn }: Props) {
  const [isPending, startTransition] = useTransition()
  const [modalOpen, setModalOpen] = useState(false)
  const [editingFaq, setEditingFaq] = useState<FaqItem | null>(null)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  // Form fields
  const [categoryId, setCategoryId] = useState('')
  const [questionFa, setQuestionFa] = useState('')
  const [questionEn, setQuestionEn] = useState('')
  const [answerFa, setAnswerFa] = useState('')
  const [answerEn, setAnswerEn] = useState('')
  const [isActive, setIsActive] = useState(true)

  const openAddModal = () => {
    setEditingFaq(null)
    setCategoryId(categories[0]?.id || '')
    setQuestionFa('')
    setQuestionEn('')
    setAnswerFa('')
    setAnswerEn('')
    setIsActive(true)
    setMessage(null)
    setModalOpen(true)
  }

  const openEditModal = (f: FaqItem) => {
    setEditingFaq(f)
    setCategoryId(f.categoryId || '')
    setQuestionFa(f.questionFa)
    setQuestionEn(f.questionEn || '')
    setAnswerFa(f.answerFa)
    setAnswerEn(f.answerEn || '')
    setIsActive(f.isActive)
    setMessage(null)
    setModalOpen(true)
  }

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault()
    setMessage(null)

    const formData = new FormData()
    formData.append('categoryId', categoryId)
    formData.append('questionFa', questionFa)
    formData.append('questionEn', questionEn)
    formData.append('answerFa', answerFa)
    formData.append('answerEn', answerEn)
    formData.append('isActive', isActive ? 'true' : 'false')

    startTransition(async () => {
      let res
      if (editingFaq) {
        res = await updateFaqAction(editingFaq.id, formData)
      } else {
        res = await createFaqAction(formData)
      }

      if (res.error) {
        setMessage({ type: 'error', text: res.error })
      } else {
        setMessage({ type: 'success', text: res.message || (isEn ? 'Saved successfully' : 'با موفقیت ذخیره شد.') })
        setTimeout(() => setModalOpen(false), 800)
      }
    })
  }

  const handleDelete = (f: FaqItem) => {
    const confirmText = isEn
      ? `Are you sure you want to delete this FAQ?`
      : `آیا از حذف این پرسش اطمینان دارید؟`
    if (!window.confirm(confirmText)) return

    startTransition(async () => {
      const res = await deleteFaqAction(f.id)
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
            {isEn ? 'Frequently Asked Questions (FAQ)' : 'مدیریت سوالات متداول'}
          </h1>
          <p className="text-sm text-muted-foreground">
            {isEn
              ? 'Common client questions and verified answers for veterinary consultations'
              : 'پرسش‌ها و پاسخ‌های پرتکرار مراجعین کلینیک'}
          </p>
        </div>
        <button
          onClick={openAddModal}
          className="bg-gradient-to-r from-primary to-[#DFC07A] text-charcoal-950 font-bold px-4 py-2.5 rounded-xl text-xs shadow-gold hover:opacity-95 transition-all cursor-pointer flex items-center gap-1.5"
        >
          <span>➕</span>
          <span>{isEn ? 'Add New Question' : 'افزودن پرسش جدید'}</span>
        </button>
      </div>

      {/* FAQ Items List */}
      <div className="space-y-4">
        {faqs.length === 0 ? (
          <div className="p-12 text-center bg-surface border border-border rounded-2xl">
            <p className="text-muted-foreground text-sm">
              {isEn ? 'No FAQs found. Click "+ Add New Question" to create one.' : 'پرسشی ثبت نشده است. برای افزودن پرسش جدید کلیک کنید.'}
            </p>
          </div>
        ) : (
          faqs.map((item) => {
            const qText = isEn ? (item.questionEn || item.questionFa) : item.questionFa
            const aText = isEn ? (item.answerEn || item.answerFa) : item.answerFa
            const catName = isEn ? (item.category?.nameEn || item.category?.nameFa) : item.category?.nameFa

            return (
              <div key={item.id} className="bg-surface border border-border rounded-2xl p-5 shadow-sm space-y-3">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-center gap-2.5">
                    <span className="w-6 h-6 rounded-full bg-primary/15 text-primary text-xs font-bold flex items-center justify-center shrink-0">
                      ?
                    </span>
                    <h3 className="font-bold text-foreground text-sm">{qText}</h3>
                  </div>
                  <span className="text-[11px] bg-primary/10 text-primary border border-primary/20 px-2.5 py-0.5 rounded-full shrink-0 font-medium">
                    {catName || (isEn ? 'General' : 'عمومی')}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed ps-8">
                  {aText}
                </p>
                <div className="pt-3 border-t border-border ps-8 flex justify-end gap-3 text-xs">
                  <button
                    onClick={() => openEditModal(item)}
                    className="text-primary font-bold hover:underline cursor-pointer"
                  >
                    ✏️ {isEn ? 'Edit' : 'ویرایش'}
                  </button>
                  <button
                    onClick={() => handleDelete(item)}
                    className="text-red-400 hover:text-red-300 transition-colors cursor-pointer"
                  >
                    🗑️ {isEn ? 'Delete' : 'حذف'}
                  </button>
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
                {editingFaq
                  ? (isEn ? 'Edit Question & Answer' : 'ویرایش پرسش و پاسخ')
                  : (isEn ? 'Add New Question' : 'افزودن پرسش جدید')}
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
              {categories.length > 0 && (
                <div>
                  <label className="block text-xs font-semibold text-foreground/80 mb-1">
                    {isEn ? 'Category' : 'دسته‌بندی پرسش'}
                  </label>
                  <select
                    value={categoryId}
                    onChange={(e) => setCategoryId(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl bg-surface-elevated border border-border text-xs text-foreground focus:border-primary outline-none"
                  >
                    <option value="">{isEn ? 'General' : 'عمومی'}</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {isEn ? (c.nameEn || c.nameFa) : c.nameFa}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-foreground/80 mb-1">
                  {isEn ? 'Question (Persian) *' : 'متن سوال (فارسی) *'}
                </label>
                <input
                  type="text"
                  required
                  value={questionFa}
                  onChange={(e) => setQuestionFa(e.target.value)}
                  placeholder="مثال: چه زمانی باید واکسیناسیون توله سگ آغاز شود؟"
                  className="w-full px-3.5 py-2 rounded-xl bg-surface-elevated border border-border text-xs text-foreground focus:border-primary outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-foreground/80 mb-1">
                  {isEn ? 'Question (English)' : 'متن سوال (انگلیسی)'}
                </label>
                <input
                  type="text"
                  value={questionEn}
                  onChange={(e) => setQuestionEn(e.target.value)}
                  placeholder="e.g. When should puppy vaccination start?"
                  className="w-full px-3.5 py-2 rounded-xl bg-surface-elevated border border-border text-xs text-foreground focus:border-primary outline-none dir-ltr"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-foreground/80 mb-1">
                  {isEn ? 'Answer (Persian) *' : 'پاسخ کارشناسی (فارسی) *'}
                </label>
                <textarea
                  rows={4}
                  required
                  value={answerFa}
                  onChange={(e) => setAnswerFa(e.target.value)}
                  placeholder="توضیحات علمی و راهنمای مراجعین..."
                  className="w-full px-3.5 py-2 rounded-xl bg-surface-elevated border border-border text-xs text-foreground focus:border-primary outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-foreground/80 mb-1">
                  {isEn ? 'Answer (English)' : 'پاسخ کارشناسی (انگلیسی)'}
                </label>
                <textarea
                  rows={3}
                  value={answerEn}
                  onChange={(e) => setAnswerEn(e.target.value)}
                  placeholder="English answer explanation..."
                  className="w-full px-3.5 py-2 rounded-xl bg-surface-elevated border border-border text-xs text-foreground focus:border-primary outline-none dir-ltr"
                />
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
                  {isPending ? (isEn ? 'Saving...' : 'در حال ذخیره...') : (isEn ? 'Save Question' : 'ذخیره پرسش')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
