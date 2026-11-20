import { db } from '@/lib/db'
import { buildLeadWhere, STAGE_LABEL_FA, LOST_REASON_LABEL_FA, type LeadListQuery } from '@/lib/crm/leads'
import { buildTicketWhere, TICKET_STATUS_LABEL_FA, slaState, type TicketListQuery } from '@/lib/crm/tickets'
import { buildTaskWhere, TASK_TYPE_LABEL_FA, type TaskListQuery } from '@/lib/crm/tasks'

export const EXPORT_CAP = 10_000

/**
 * One CSV cell, safe against spreadsheet formula injection: anything starting with = + - @ tab or CR
 * (also after leading spaces or a quote) is prefixed so Excel/Sheets show it as text.
 */
export function csvSafe(value: unknown): string {
  let s = value == null ? '' : value instanceof Date ? value.toISOString().slice(0, 10) : String(value)
  if (/^[\s"']*[=+\-@\t\r]/.test(s)) s = `'${s}`
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

/** UTF-8 with BOM (so Excel reads Persian), CRLF line ends, at most EXPORT_CAP data rows. */
export function toCsv(head: string[], rows: unknown[][]): string {
  const lines = [head.map(csvSafe).join(',')]
  for (const r of rows.slice(0, EXPORT_CAP)) lines.push(r.map(csvSafe).join(','))
  return '﻿' + lines.join('\r\n')
}

export async function leadsCsv(filters: LeadListQuery = {}): Promise<string> {
  const rows = await db.lead.findMany({ where: buildLeadWhere(filters), orderBy: { createdAt: 'desc' }, take: EXPORT_CAP })
  return toCsv(
    ['نام', 'موبایل', 'ایمیل', 'مرحله', 'دلیل از دست رفتن', 'منبع', 'حیوان', 'خدمت مورد علاقه', 'پیگیری بعدی', 'تاریخ ثبت'],
    rows.map((l) => [l.name, l.phone, l.email, STAGE_LABEL_FA[l.stage], l.lostReason ? LOST_REASON_LABEL_FA[l.lostReason] : '', l.source, l.petType, l.serviceInterest, l.followUpDate, l.createdAt])
  )
}

export async function ticketsCsv(filters: TicketListQuery = {}): Promise<string> {
  const now = new Date()
  const rows = await db.contactMessage.findMany({ where: buildTicketWhere(filters), orderBy: { createdAt: 'desc' }, take: EXPORT_CAP })
  return toCsv(
    ['نام', 'موبایل', 'ایمیل', 'موضوع', 'وضعیت', 'اولویت', 'وضعیت SLA', 'اولین پاسخ', 'تاریخ حل', 'تاریخ ثبت'],
    rows.map((m) => [m.name, m.phone, m.email, m.subject, TICKET_STATUS_LABEL_FA[m.status], m.priority, slaState(m, now), m.firstResponseAt, m.resolvedAt, m.createdAt])
  )
}

export async function tasksCsv(filters: TaskListQuery = {}): Promise<string> {
  const rows = await db.crmTask.findMany({ where: buildTaskWhere(filters), orderBy: [{ dueAt: { sort: 'asc', nulls: 'last' } }, { createdAt: 'desc' }], take: EXPORT_CAP })
  return toCsv(
    ['عنوان', 'نوع', 'وضعیت', 'اولویت', 'موعد', 'خودکار', 'یادداشت', 'تاریخ ایجاد'],
    rows.map((t) => [t.title, TASK_TYPE_LABEL_FA[t.type], t.status, t.priority, t.dueAt, t.system ? 'بله' : 'خیر', t.note, t.createdAt])
  )
}
