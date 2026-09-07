'use client'

import React, { useState, useTransition } from 'react'
import {
  createLeadAction,
  updateLeadStatusAction,
  deleteLeadAction,
} from '@/app/actions/leads'

interface LeadItem {
  id: string
  name: string | null
  phone: string
  message: string | null
  source: string | null
  status: string
  createdAt: Date
}

interface Props {
  leads: LeadItem[]
  isEn: boolean
}

export function LeadsManager({ leads, isEn }: Props) {
  const [isPending, startTransition] = useTransition()
  const [modalOpen, setModalOpen] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  // Form fields
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [leadMessage, setLeadMessage] = useState('')
  const [status, setStatus] = useState('NEW')

  const openAddModal = () => {
    setName('')
    setPhone('')
    setLeadMessage('')
    setStatus('NEW')
    setMessage(null)
    setModalOpen(true)
  }

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault()
    setMessage(null)

    const formData = new FormData()
    formData.append('name', name)
    formData.append('phone', phone)
    formData.append('message', leadMessage)
    formData.append('status', status)
    formData.append('source', 'MANUAL_ENTRY')

    startTransition(async () => {
      const res = await createLeadAction(formData)
      if (res.error) {
        setMessage({ type: 'error', text: res.error })
      } else {
        setMessage({ type: 'success', text: res.message || (isEn ? 'Lead added' : 'سرنخ با موفقیت اضافه شد.') })
        setTimeout(() => setModalOpen(false), 800)
      }
    })
  }

  const handleStatusChange = (leadId: string, newStatus: string) => {
    startTransition(async () => {
      await updateLeadStatusAction(leadId, newStatus)
    })
  }

  const handleDelete = (lead: LeadItem) => {
    const confirmText = isEn
      ? `Are you sure you want to delete lead for "${lead.name || lead.phone}"?`
      : `آیا از حذف این درخواست اطمینان دارید؟`
    if (!window.confirm(confirmText)) return

    startTransition(async () => {
      const res = await deleteLeadAction(lead.id)
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
            {isEn ? 'Inquiries & Appointment Leads' : 'سرنخ‌ها و درخواست‌های نوبت'}
          </h1>
          <p className="text-sm text-muted-foreground">
            {isEn
              ? 'Consultation requests, booking inquiries, and customer communication pipeline'
              : 'درخواست‌های مشاوره و رزرو وقت آنلاین ثبت شده توسط مراجعین'}
          </p>
        </div>
        <button
          onClick={openAddModal}
          className="bg-gradient-to-r from-primary to-[#DFC07A] text-charcoal-950 font-bold px-4 py-2.5 rounded-xl text-xs shadow-gold hover:opacity-95 transition-all cursor-pointer flex items-center gap-1.5"
        >
          <span>➕</span>
          <span>{isEn ? 'Add In-Person / Phone Lead' : 'ثبت درخواست حضوری یا تلفنی'}</span>
        </button>
      </div>

      {/* Leads Table */}
      <div className="bg-surface border border-border rounded-2xl overflow-hidden shadow-sm">
        <div className="p-4 border-b border-border bg-surface-elevated/40 flex items-center justify-between">
          <h2 className="text-xs font-bold text-foreground">
            {isEn ? `Leads Inbox (${leads.length} entries)` : `لیست درخواست‌های نوبت (${leads.length} مورد)`}
          </h2>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-start">
            <thead className="bg-surface-elevated text-muted-foreground border-b border-border">
              <tr>
                <th className="px-5 py-3.5 text-start font-semibold">{isEn ? 'Client Name' : 'نام متقاضی'}</th>
                <th className="px-5 py-3.5 text-start font-semibold">{isEn ? 'Phone Number' : 'شماره تماس'}</th>
                <th className="px-5 py-3.5 text-start font-semibold">{isEn ? 'Message / Source' : 'پیام / منبع'}</th>
                <th className="px-5 py-3.5 text-start font-semibold">{isEn ? 'Status' : 'وضعیت'}</th>
                <th className="px-5 py-3.5 text-start font-semibold">{isEn ? 'Created At' : 'تاریخ ثبت'}</th>
                <th className="px-5 py-3.5 text-center font-semibold">{isEn ? 'Actions' : 'عملیات'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {leads.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-8 text-muted-foreground">
                    {isEn ? 'No lead records logged yet' : 'سرنخی در سیستم ثبت نشده است'}
                  </td>
                </tr>
              ) : (
                leads.map((lead) => (
                  <tr key={lead.id} className="hover:bg-surface-elevated/50 transition-colors">
                    <td className="px-5 py-4 font-semibold text-foreground">
                      {lead.name || (isEn ? 'Anonymous Client' : 'مراجعه‌کننده ناشناس')}
                    </td>
                    <td className="px-5 py-4 font-mono text-xs text-primary dir-ltr text-start">
                      {lead.phone}
                    </td>
                    <td className="px-5 py-4 text-xs text-muted-foreground max-w-xs truncate">
                      {lead.message || lead.source || '—'}
                    </td>
                    <td className="px-5 py-4">
                      <select
                        value={lead.status}
                        onChange={(e) => handleStatusChange(lead.id, e.target.value)}
                        disabled={isPending}
                        className={`text-[11px] px-2.5 py-1 rounded-full font-medium border outline-none cursor-pointer ${
                          lead.status === 'NEW'
                            ? 'bg-blue-500/15 text-blue-400 border-blue-500/30'
                            : lead.status === 'CONTACTED'
                            ? 'bg-amber-500/15 text-amber-400 border-amber-500/30'
                            : lead.status === 'CONVERTED'
                            ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                            : 'bg-surface-elevated text-muted-foreground border-border'
                        }`}
                      >
                        <option value="NEW">🔵 {isEn ? 'New' : 'جدید'}</option>
                        <option value="CONTACTED">🟡 {isEn ? 'Contacted' : 'تماس گرفته شد'}</option>
                        <option value="CONVERTED">🟢 {isEn ? 'Converted / Booked' : 'نوبت نهایی شد'}</option>
                        <option value="CLOSED">⚪ {isEn ? 'Closed' : 'بایگانی'}</option>
                      </select>
                    </td>
                    <td className="px-5 py-4 text-xs text-muted-foreground">
                      {new Date(lead.createdAt).toLocaleDateString(isEn ? 'en-US' : 'fa-IR')}
                    </td>
                    <td className="px-5 py-4 text-center">
                      <button
                        onClick={() => handleDelete(lead)}
                        className="text-red-400 hover:text-red-300 p-1 transition-colors cursor-pointer"
                        title={isEn ? 'Delete lead' : 'حذف سرنخ'}
                      >
                        🗑️
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Dialog */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#181A20] border border-primary/30 rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <h2 className="text-base font-bold text-foreground">
                {isEn ? 'Add Lead or Appointment Request' : 'ثبت درخواست نوبت / سرنخ جدید'}
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
                  {isEn ? 'Client Name' : 'نام و نام‌خانوادگی مراجع'}
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="مثال: آقای رضایی"
                  className="w-full px-3.5 py-2 rounded-xl bg-surface-elevated border border-border text-xs text-foreground focus:border-primary outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-foreground/80 mb-1">
                  {isEn ? 'Phone Number *' : 'شماره تماس *'}
                </label>
                <input
                  type="text"
                  required
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="09121234567"
                  className="w-full px-3.5 py-2 rounded-xl bg-surface-elevated border border-border text-xs text-foreground focus:border-primary outline-none font-mono dir-ltr"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-foreground/80 mb-1">
                  {isEn ? 'Notes / Inquiry Message' : 'یادداشت یا علت مراجعه'}
                </label>
                <textarea
                  rows={3}
                  value={leadMessage}
                  onChange={(e) => setLeadMessage(e.target.value)}
                  placeholder="درخواست ویزیت سگ نژاد شیتزو برای واکسیناسیون..."
                  className="w-full px-3.5 py-2 rounded-xl bg-surface-elevated border border-border text-xs text-foreground focus:border-primary outline-none"
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
                  {isPending ? (isEn ? 'Saving...' : 'در حال ثبت...') : (isEn ? 'Save Lead' : 'ثبت درخواست')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
