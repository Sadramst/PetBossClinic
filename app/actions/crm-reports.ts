'use server'

import { crmGuard, crmFail, type Result } from '@/lib/crm/action-guard'
import { MSG } from '@/lib/crm/errors'
import { REPORT_TABS, buildReport, rangeForDays, type ReportData, type ReportTab } from '@/lib/crm/reports'
import { toCsv } from '@/lib/crm/export'

export async function getReportAction(tab: string, days: number): Promise<Result<ReportData>> {
  const g = await crmGuard('VIEWER', 'report-get', 60)
  if (!g.ok) return g
  if (!(REPORT_TABS as readonly string[]).includes(tab)) return { ok: false, error: MSG.badInput }
  try {
    return { ok: true, data: await buildReport(tab as ReportTab, rangeForDays(Number(days))) }
  } catch (e) {
    return crmFail(e, 'report-get')
  }
}

export async function exportReportCsvAction(tab: string, days: number): Promise<Result<string>> {
  const g = await crmGuard('ADMIN', 'report-export', 10)
  if (!g.ok) return g
  if (!(REPORT_TABS as readonly string[]).includes(tab)) return { ok: false, error: MSG.badInput }
  try {
    const r = await buildReport(tab as ReportTab, rangeForDays(Number(days)))
    const rows = r.sections.flatMap((s) => [[s.title, s.head.join(' | ')], ...s.rows.map((row) => [s.title, row.join(' | ')])])
    return { ok: true, data: toCsv(['بخش', 'ردیف'], rows) }
  } catch (e) {
    return crmFail(e, 'report-export')
  }
}
