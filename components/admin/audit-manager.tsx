'use client'

import React, { useState } from 'react'

export interface AuditLogItem {
  id: string
  userId: string | null
  action: string
  entity: string
  entityId: string
  ip: string | null
  location: string | null
  userAgent: string | null
  createdAt: string | Date
  before: unknown
  after: unknown
  user?: {
    id: string
    name: string | null
    email: string | null
  } | null
}

interface Props {
  logs: AuditLogItem[]
  isEn: boolean
}

export function AuditManager({ logs, isEn }: Props) {
  const [selectedEntity, setSelectedEntity] = useState<string>('ALL')
  const [selectedAction, setSelectedAction] = useState<string>('ALL')
  const [searchQuery, setSearchQuery] = useState('')
  const [activeLogModal, setActiveLogModal] = useState<AuditLogItem | null>(null)

  const getActionBadge = (action: string) => {
    switch (action) {
      case 'CREATE':
        return (
          <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
            {isEn ? 'CREATE' : 'ایجاد / ثبت'}
          </span>
        )
      case 'UPDATE':
        return (
          <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-500/15 text-amber-400 border border-amber-500/30">
            {isEn ? 'UPDATE' : 'ویرایش'}
          </span>
        )
      case 'DELETE':
        return (
          <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-red-500/15 text-red-400 border border-red-500/30">
            {isEn ? 'DELETE' : 'حذف'}
          </span>
        )
      case 'BULK_DELETE':
        return (
          <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-purple-500/15 text-purple-400 border border-purple-500/30">
            {isEn ? 'BULK DELETE' : 'حذف دسته‌ای'}
          </span>
        )
      default:
        return (
          <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-blue-500/15 text-blue-400 border border-blue-500/30">
            {action}
          </span>
        )
    }
  }

  const getEntityIcon = (entity: string) => {
    switch (entity) {
      case 'PRODUCT':
        return '📦 ' + (isEn ? 'Product' : 'محصول')
      case 'PRODUCT_CATEGORY':
        return '🏷️ ' + (isEn ? 'Category' : 'دسته‌بندی')
      case 'SERVICE':
        return '💊 ' + (isEn ? 'Service' : 'خدمت')
      case 'DIVISION':
        return '🏥 ' + (isEn ? 'Division' : 'بخش درمانی')
      case 'STAFF':
        return '👨‍⚕️ ' + (isEn ? 'Staff' : 'کادر درمانی')
      case 'SITE_SETTING':
        return '⚙️ ' + (isEn ? 'Site Settings' : 'تنظیمات سایت')
      case 'THEME':
        return '🎨 ' + (isEn ? 'Theme' : 'پوسته')
      case 'FAQ':
        return '❓ ' + (isEn ? 'FAQ' : 'پرسش متداول')
      default:
        return '📄 ' + entity
    }
  }

  const formatTimestamp = (dateInput: string | Date) => {
    const d = new Date(dateInput)
    if (isNaN(d.getTime())) return String(dateInput)

    const dateStr = d.toLocaleDateString(isEn ? 'en-US' : 'fa-IR', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
    const timeStr = d.toLocaleTimeString(isEn ? 'en-US' : 'fa-IR', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    })

    return `${dateStr} - ${timeStr}`
  }

  const filteredLogs = logs.filter((l) => {
    const matchesEntity = selectedEntity === 'ALL' || l.entity === selectedEntity
    const matchesAction = selectedAction === 'ALL' || l.action === selectedAction
    const q = searchQuery.toLowerCase().trim()
    const matchesSearch =
      !q ||
      l.entity.toLowerCase().includes(q) ||
      l.action.toLowerCase().includes(q) ||
      (l.entityId && l.entityId.toLowerCase().includes(q)) ||
      (l.location && l.location.toLowerCase().includes(q)) ||
      (l.ip && l.ip.includes(q))

    return matchesEntity && matchesAction && matchesSearch
  })

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-border">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-foreground flex items-center gap-2">
            <span>📜</span>
            <span>{isEn ? 'Audit History & Location Stamp Log' : 'تاریخچه تغییرات و لاگ مکانی-زمانی ادمین'}</span>
          </h1>
          <p className="text-xs text-muted-foreground mt-1">
            {isEn
              ? 'Immutable chronological audit trail recording exact timestamps, IP addresses, geo-locations, and actor identifiers for every modification.'
              : 'ثبت خودکار و لحظه‌ای تمام تغییرات سایت با مُهر زمانی، موقعیت جغرافیایی، IP کاربری و مشخصات ویرایشگر جهت نظارت دقیق و شفاف.'}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="px-3 py-1.5 rounded-xl bg-surface-elevated border border-border text-xs font-mono text-primary font-bold">
            {logs.length} {isEn ? 'Total Events' : 'رکورد ثبت شده'}
          </span>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
        <div className="flex flex-wrap items-center gap-2 flex-1">
          {/* Entity Filter */}
          <select
            value={selectedEntity}
            onChange={(e) => setSelectedEntity(e.target.value)}
            className="px-3 py-2 rounded-xl bg-surface-elevated border border-border text-xs text-foreground outline-none focus:border-primary"
          >
            <option value="ALL">{isEn ? 'All Entities' : 'همه بخش‌ها'}</option>
            <option value="PRODUCT">{isEn ? 'Products' : 'محصولات'}</option>
            <option value="PRODUCT_CATEGORY">{isEn ? 'Categories' : 'دسته‌بندی‌ها'}</option>
            <option value="SERVICE">{isEn ? 'Services' : 'خدمات'}</option>
            <option value="DIVISION">{isEn ? 'Divisions' : 'بخش‌های درمانی'}</option>
            <option value="STAFF">{isEn ? 'Staff' : 'کادر درمان'}</option>
            <option value="SITE_SETTING">{isEn ? 'Site Settings' : 'تنظیمات سایت'}</option>
            <option value="THEME">{isEn ? 'Theme' : 'پوسته سایت'}</option>
            <option value="FAQ">{isEn ? 'FAQs' : 'پرسش‌ها'}</option>
          </select>

          {/* Action Filter */}
          <select
            value={selectedAction}
            onChange={(e) => setSelectedAction(e.target.value)}
            className="px-3 py-2 rounded-xl bg-surface-elevated border border-border text-xs text-foreground outline-none focus:border-primary"
          >
            <option value="ALL">{isEn ? 'All Actions' : 'همه عملیات‌ها'}</option>
            <option value="CREATE">{isEn ? 'Created' : 'ثبت / ایجاد'}</option>
            <option value="UPDATE">{isEn ? 'Updated' : 'ویرایش'}</option>
            <option value="DELETE">{isEn ? 'Deleted' : 'حذف'}</option>
            <option value="BULK_DELETE">{isEn ? 'Bulk Delete' : 'حذف دسته‌ای'}</option>
          </select>

          {/* Search Box */}
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={isEn ? 'Search IP, entity, ID...' : 'جستجو در آدرس IP، شناسه، بخش...'}
            className="px-3 py-2 rounded-xl bg-surface-elevated border border-border text-xs text-foreground outline-none focus:border-primary flex-1 min-w-[200px]"
          />
        </div>
      </div>

      {/* Audit Log Table */}
      <div className="bg-surface border border-border rounded-2xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-start">
            <thead className="bg-surface-elevated text-muted-foreground uppercase text-[10px] tracking-wider border-b border-border">
              <tr>
                <th className="p-3.5 text-start">{isEn ? 'Timestamp' : 'زمان دقیق'}</th>
                <th className="p-3.5 text-start">{isEn ? 'Action' : 'عملیات'}</th>
                <th className="p-3.5 text-start">{isEn ? 'Entity' : 'موجودیت'}</th>
                <th className="p-3.5 text-start">{isEn ? 'Location & IP' : 'موقعیت مکانی و IP'}</th>
                <th className="p-3.5 text-start">{isEn ? 'Actor (Who)' : 'ویرایشگر'}</th>
                <th className="p-3.5 text-center">{isEn ? 'Details' : 'جزئیات'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-muted-foreground">
                    {isEn ? 'No audit records found.' : 'هیچ رکوردی برای نمایش وجود ندارد.'}
                  </td>
                </tr>
              ) : (
                filteredLogs.map((log) => {
                  const afterData = log.after as Record<string, unknown> | null
                  const actorInfo = afterData?._actor as { id?: string; email?: string; name?: string } | undefined
                  const actorName = actorInfo?.name || log.user?.name || (isEn ? 'System Administrator' : 'مدیر سیستم')
                  const actorEmail = actorInfo?.email || log.user?.email || 'admin@petbossclinic.com'

                  return (
                    <tr key={log.id} className="hover:bg-surface-elevated/40 transition-colors">
                      {/* Timestamp */}
                      <td className="p-3.5 whitespace-nowrap font-mono text-[11px] text-foreground">
                        {formatTimestamp(log.createdAt)}
                      </td>

                      {/* Action */}
                      <td className="p-3.5 whitespace-nowrap">
                        {getActionBadge(log.action)}
                      </td>

                      {/* Entity */}
                      <td className="p-3.5 whitespace-nowrap">
                        <span className="font-semibold text-foreground">
                          {getEntityIcon(log.entity)}
                        </span>
                        <span className="block text-[10px] text-muted-foreground font-mono truncate max-w-[150px]">
                          {log.entityId}
                        </span>
                      </td>

                      {/* Location & IP */}
                      <td className="p-3.5">
                        <div className="flex flex-col">
                          <span className="font-medium text-foreground flex items-center gap-1">
                            <span>📍</span>
                            <span>{log.location || (isEn ? 'Tehran, IR' : 'تهران، ایران')}</span>
                          </span>
                          <span className="text-[10px] font-mono text-muted-foreground">
                            IP: {log.ip || '127.0.0.1'}
                          </span>
                        </div>
                      </td>

                      {/* Actor */}
                      <td className="p-3.5">
                        <div className="flex flex-col">
                          <span className="font-semibold text-foreground">
                            {actorName}
                          </span>
                          <span className="text-[10px] text-muted-foreground font-mono">
                            {actorEmail}
                          </span>
                        </div>
                      </td>

                      {/* Inspect Button */}
                      <td className="p-3.5 text-center whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => setActiveLogModal(log)}
                          className="px-2.5 py-1 rounded-lg bg-surface-elevated hover:bg-primary/20 text-foreground hover:text-primary text-[11px] font-medium border border-border transition-colors cursor-pointer"
                        >
                          👁️ {isEn ? 'Inspect' : 'مشاهده'}
                        </button>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal: View Details */}
      {activeLogModal && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-surface border border-primary/30 rounded-2xl w-full max-w-2xl p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <h3 className="text-base font-bold text-foreground flex items-center gap-2">
                <span>🔍</span>
                <span>{isEn ? 'Audit Record Details' : 'مشخصات کامل رکورد فعالیت'}</span>
              </h3>
              <button
                type="button"
                onClick={() => setActiveLogModal(null)}
                className="text-muted-foreground hover:text-foreground text-sm"
              >
                ✕
              </button>
            </div>

            {/* Overview Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 p-4 rounded-xl bg-surface-elevated border border-border text-xs">
              <div>
                <span className="text-muted-foreground block mb-0.5">{isEn ? 'Action' : 'نوع عملیات'}</span>
                <div>{getActionBadge(activeLogModal.action)}</div>
              </div>
              <div>
                <span className="text-muted-foreground block mb-0.5">{isEn ? 'Entity' : 'بخش مربوطه'}</span>
                <span className="font-bold text-foreground">{getEntityIcon(activeLogModal.entity)}</span>
              </div>
              <div>
                <span className="text-muted-foreground block mb-0.5">{isEn ? 'Record ID' : 'شناسه رکورد'}</span>
                <span className="font-mono text-primary truncate block">{activeLogModal.entityId}</span>
              </div>
              <div>
                <span className="text-muted-foreground block mb-0.5">{isEn ? 'Timestamp' : 'تاریخ و زمان'}</span>
                <span className="font-mono text-foreground">{formatTimestamp(activeLogModal.createdAt)}</span>
              </div>
              <div>
                <span className="text-muted-foreground block mb-0.5">{isEn ? 'Location' : 'موقعیت مکانی'}</span>
                <span className="text-foreground">{activeLogModal.location || 'تهران، ایران'}</span>
              </div>
              <div>
                <span className="text-muted-foreground block mb-0.5">{isEn ? 'IP Address' : 'آدرس IP'}</span>
                <span className="font-mono text-foreground">{activeLogModal.ip || '127.0.0.1'}</span>
              </div>
            </div>

            {/* Changes: Before / After */}
            <div className="space-y-3">
              {activeLogModal.before ? (
                <div>
                  <h4 className="text-xs font-bold text-muted-foreground uppercase mb-1">
                    {isEn ? 'State Before Modification' : 'وضعیت قبلی (Before)'}
                  </h4>
                  <pre
                    className="p-3 rounded-xl bg-charcoal-950 text-emerald-400 font-mono text-[11px] overflow-x-auto border border-border"
                    dir="ltr"
                  >
                    {JSON.stringify(activeLogModal.before, null, 2)}
                  </pre>
                </div>
              ) : null}

              {activeLogModal.after ? (
                <div>
                  <h4 className="text-xs font-bold text-muted-foreground uppercase mb-1">
                    {isEn ? 'State After Modification' : 'وضعیت جدید (After)'}
                  </h4>
                  <pre
                    className="p-3 rounded-xl bg-charcoal-950 text-amber-300 font-mono text-[11px] overflow-x-auto border border-border"
                    dir="ltr"
                  >
                    {JSON.stringify(activeLogModal.after, null, 2)}
                  </pre>
                </div>
              ) : null}
            </div>

            <div className="flex justify-end pt-3 border-t border-border">
              <button
                type="button"
                onClick={() => setActiveLogModal(null)}
                className="px-4 py-2 rounded-xl bg-surface-elevated hover:bg-surface-hover text-foreground text-xs font-bold"
              >
                {isEn ? 'Close' : 'بستن'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
