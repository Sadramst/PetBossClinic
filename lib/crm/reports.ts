import { db } from '@/lib/db'
import { LEAD_STAGE_LABEL, LEAD_STAGE_ORDER, LOST_REASON_LABEL, TICKET_STATUS_LABEL, type LostReasonKey } from '@/lib/crm/labels'
import { expiryState } from '@/lib/shop/expiry'
import type { DateRange } from '@/lib/crm/types'

export const REPORT_TABS = ['funnel', 'customers', 'operations', 'messaging', 'expiry'] as const
export type ReportTab = (typeof REPORT_TABS)[number]
export const REPORT_TAB_LABEL: Record<ReportTab, string> = {
  funnel: 'قیف فروش',
  customers: 'مشتریان',
  operations: 'عملیات',
  messaging: 'پیام‌رسانی',
  expiry: 'تاریخ انقضا',
}

/** Every report is a set of titled tables, so the page and the CSV export share one shape. */
export type ReportSection = { title: string; head: string[]; rows: Array<Array<string | number>> }
export type ReportData = { tab: ReportTab; sections: ReportSection[] }

const LIFECYCLE_FA: Record<string, string> = {
  SUBSCRIBER: 'مشترک',
  LEAD: 'سرنخ',
  PROSPECT: 'مشتری بالقوه',
  NEW_CUSTOMER: 'مشتری جدید',
  ACTIVE: 'فعال',
  AT_RISK: 'در معرض ریزش',
  LAPSED: 'غیرفعال',
  VIP: 'ویژه',
  BLOCKED: 'مسدود',
}
const CHURN_FA: Record<string, string> = { LOW: 'کم', MEDIUM: 'متوسط', HIGH: 'زیاد' }

export function rangeForDays(days: number, now: Date = new Date()): DateRange {
  const d = [7, 30, 90, 365].includes(days) ? days : 30
  return { from: new Date(now.getTime() - d * 86_400_000), to: now }
}

const pct = (a: number, b: number) => (b > 0 ? `${Math.round((a / b) * 100)}٪` : '—')

export async function funnelReport(range: DateRange): Promise<ReportSection[]> {
  const where = { createdAt: { gte: range.from, lte: range.to } }
  const [byStage, lost, bySource] = await Promise.all([
    db.lead.groupBy({ by: ['stage'], where, _count: { _all: true } }),
    db.lead.groupBy({ by: ['lostReason'], where: { ...where, stage: 'LOST' }, _count: { _all: true } }),
    db.lead.groupBy({ by: ['source'], where, _count: { _all: true }, orderBy: { _count: { source: 'desc' } }, take: 10 }),
  ])
  const total = byStage.reduce((s, r) => s + r._count._all, 0)
  const count = (k: string) => byStage.find((r) => r.stage === k)?._count._all ?? 0
  return [
    {
      title: 'مراحل سرنخ‌های این بازه',
      head: ['مرحله', 'تعداد', 'سهم از کل'],
      rows: LEAD_STAGE_ORDER.map((s) => [LEAD_STAGE_LABEL[s], count(s), pct(count(s), total)]),
    },
    { title: 'نرخ تبدیل', head: ['شاخص', 'مقدار'], rows: [['کل سرنخ‌ها', total], ['موفق', count('WON')], ['نرخ تبدیل', pct(count('WON'), total)]] },
    {
      title: 'دلیل از دست رفتن',
      head: ['دلیل', 'تعداد'],
      rows: lost.map((r) => [r.lostReason ? (LOST_REASON_LABEL[r.lostReason as LostReasonKey] ?? r.lostReason) : 'نامشخص', r._count._all]),
    },
    { title: 'منبع سرنخ‌ها', head: ['منبع', 'تعداد'], rows: bySource.map((r) => [r.source || 'نامشخص', r._count._all]) },
  ]
}

export async function customerReport(range: DateRange): Promise<ReportSection[]> {
  const base = { mergedIntoId: null }
  const [lifecycle, churn, joined, avg] = await Promise.all([
    db.customer.groupBy({ by: ['lifecycleStage'], where: base, _count: { _all: true } }),
    db.customer.groupBy({ by: ['churnRisk'], where: base, _count: { _all: true } }),
    db.customer.count({ where: { ...base, createdAt: { gte: range.from, lte: range.to } } }),
    db.customer.aggregate({ where: { ...base, healthScore: { not: null } }, _avg: { healthScore: true } }),
  ])
  return [
    {
      title: 'چرخهٔ عمر مشتری',
      head: ['مرحله', 'تعداد'],
      rows: lifecycle.map((r) => [r.lifecycleStage ? (LIFECYCLE_FA[r.lifecycleStage] ?? r.lifecycleStage) : 'محاسبه‌نشده', r._count._all]),
    },
    {
      title: 'ریسک ریزش',
      head: ['ریسک', 'تعداد'],
      rows: churn.map((r) => [r.churnRisk ? (CHURN_FA[r.churnRisk] ?? r.churnRisk) : 'محاسبه‌نشده', r._count._all]),
    },
    { title: 'خلاصه', head: ['شاخص', 'مقدار'], rows: [['ثبت‌نام جدید در این بازه', joined], ['میانگین امتیاز سلامت', Math.round(avg._avg.healthScore ?? 0)]] },
  ]
}

export async function operationsReport(range: DateRange): Promise<ReportSection[]> {
  const now = new Date()
  const [tasksByStatus, overdue, ticketsByStatus, responded] = await Promise.all([
    db.crmTask.groupBy({ by: ['status'], where: { createdAt: { gte: range.from, lte: range.to } }, _count: { _all: true } }),
    db.crmTask.count({ where: { status: { in: ['OPEN', 'IN_PROGRESS'] }, dueAt: { lt: now } } }),
    db.contactMessage.groupBy({ by: ['status'], where: { createdAt: { gte: range.from, lte: range.to } }, _count: { _all: true } }),
    db.contactMessage.findMany({
      where: { firstResponseAt: { not: null }, createdAt: { gte: range.from, lte: range.to } },
      select: { createdAt: true, firstResponseAt: true },
      take: 2000,
    }),
  ])
  const hours = responded.length
    ? responded.reduce((s, m) => s + ((m.firstResponseAt as Date).getTime() - m.createdAt.getTime()) / 3_600_000, 0) / responded.length
    : null
  const TASK_FA: Record<string, string> = { OPEN: 'باز', IN_PROGRESS: 'در حال انجام', DONE: 'انجام‌شده', CANCELLED: 'لغو شده' }
  return [
    {
      title: 'وظایف ایجادشده',
      head: ['وضعیت', 'تعداد'],
      rows: [...tasksByStatus.map((r): [string, number] => [TASK_FA[r.status] ?? r.status, r._count._all]), ['وظایف عقب‌افتاده (همهٔ زمان‌ها)', overdue]],
    },
    {
      title: 'تیکت‌ها',
      head: ['وضعیت', 'تعداد'],
      rows: ticketsByStatus.map((r) => [TICKET_STATUS_LABEL[r.status as keyof typeof TICKET_STATUS_LABEL] ?? r.status, r._count._all]),
    },
    { title: 'سرعت پاسخ', head: ['شاخص', 'مقدار'], rows: [['میانگین زمان نخستین پاسخ (ساعت)', hours === null ? '—' : Math.round(hours * 10) / 10]] },
  ]
}

export async function messagingReport(range: DateRange): Promise<ReportSection[]> {
  const rows = await db.messageOutbox.groupBy({
    by: ['channel', 'status'],
    where: { createdAt: { gte: range.from, lte: range.to } },
    _count: { _all: true },
  })
  const ST: Record<string, string> = { QUEUED: 'در صف', SENDING: 'در حال ارسال', SENT: 'ارسال‌شده', FAILED: 'ناموفق', SKIPPED: 'ردشده', CANCELLED: 'لغو شده' }
  return [{ title: 'پیام‌ها بر اساس کانال و وضعیت', head: ['کانال', 'وضعیت', 'تعداد'], rows: rows.map((r) => [r.channel, ST[r.status] ?? r.status, r._count._all]) }]
}

export async function expiryReport(): Promise<ReportSection[]> {
  const cfg = await db.expiryConfig.findUnique({ where: { id: 'default' } })
  const th = { soonDays: cfg?.soonDays ?? 90, criticalDays: cfg?.criticalDays ?? 30 }
  const batches = await db.inventory.findMany({
    where: { expiryDate: { not: null }, quantity: { gt: 0 } },
    orderBy: { expiryDate: 'asc' },
    take: 2000,
    select: { quantity: true, batchNumber: true, expiryDate: true, costPrice: true, product: { select: { nameFa: true } } },
  })
  const FA: Record<string, string> = { expired: 'منقضی', critical: 'بحرانی', soon: 'نزدیک انقضا', ok: 'سالم', none: 'بدون انقضا' }
  const now = new Date()
  const groups: Record<string, { batches: number; units: number; value: number }> = {}
  const risky: ReportSection['rows'] = []
  for (const b of batches) {
    const st = expiryState(b.expiryDate, th, now)
    const g = (groups[st] ??= { batches: 0, units: 0, value: 0 })
    g.batches++
    g.units += b.quantity
    g.value += b.quantity * (b.costPrice ?? 0)
    if (st === 'expired' || st === 'critical' || st === 'soon') {
      risky.push([b.product.nameFa, b.batchNumber ?? '—', (b.expiryDate as Date).toISOString().slice(0, 10), b.quantity, FA[st]])
    }
  }
  return [
    {
      title: 'خلاصهٔ موجودی بر اساس وضعیت انقضا',
      head: ['وضعیت', 'تعداد بچ', 'تعداد واحد', 'ارزش خرید'],
      rows: Object.entries(groups).map(([k, g]) => [FA[k] ?? k, g.batches, g.units, g.value]),
    },
    { title: 'بچ‌های نیازمند اقدام', head: ['محصول', 'بچ', 'تاریخ انقضا (میلادی)', 'تعداد', 'وضعیت'], rows: risky.slice(0, 200) },
  ]
}

export async function buildReport(tab: ReportTab, range: DateRange): Promise<ReportData> {
  const sections =
    tab === 'funnel'
      ? await funnelReport(range)
      : tab === 'customers'
        ? await customerReport(range)
        : tab === 'operations'
          ? await operationsReport(range)
          : tab === 'messaging'
            ? await messagingReport(range)
            : await expiryReport()
  return { tab, sections }
}
