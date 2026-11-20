'use client'

import { DataTable, stageBadge, type Column } from '@/components/admin/kit'
import { relativeDayFa, dayDiff } from '@/lib/crm/labels'
import { cn } from '@/lib/utils'
import type { LeadView, StaffLite } from './lead-drawer'

export interface LeadsTableProps {
  leads: LeadView[]
  staff: StaffLite[]
  onOpen: (lead: LeadView) => void
}

export function LeadsTable({ leads, staff, onOpen }: LeadsTableProps) {
  const names = Object.fromEntries(staff.map((s) => [s.id, s.name]))
  const followCell = (l: LeadView) => {
    if (!l.followUpDate) return <span className="text-muted-foreground">—</span>
    const open = l.stage !== 'WON' && l.stage !== 'LOST'
    const late = open && dayDiff(new Date(l.followUpDate)) < 0
    return <span className={cn('font-bold', late && 'text-red-500')}>{relativeDayFa(l.followUpDate)}</span>
  }
  const columns: Column<LeadView>[] = [
    {
      key: 'name',
      header: 'سرنخ',
      cell: (l) => (
        <button type="button" className="text-start font-bold hover:text-primary" onClick={() => onOpen(l)} data-testid="lead-row-open">
          {l.name || l.phone}
        </button>
      ),
    },
    { key: 'phone', header: 'موبایل', cell: (l) => <span dir="ltr">{l.phone}</span> },
    { key: 'stage', header: 'مرحله', cell: (l) => stageBadge(l.stage) },
    { key: 'service', header: 'خدمت', cell: (l) => l.serviceInterest || <span className="text-muted-foreground">—</span> },
    { key: 'owner', header: 'مسئول', cell: (l) => (l.ownerId ? names[l.ownerId] ?? 'کاربر حذف‌شده' : <span className="text-muted-foreground">بدون مسئول</span>) },
    { key: 'follow', header: 'پیگیری', cell: followCell },
    { key: 'source', header: 'منبع', cell: (l) => l.source || '—' },
  ]
  return (
    <DataTable
      columns={columns}
      rows={leads}
      rowKey={(l) => l.id}
      caption="فهرست سرنخ‌ها"
      empty={<p className="p-8 text-center text-sm text-muted-foreground">سرنخی با این فیلترها پیدا نشد.</p>}
      mobileCard={(l) => (
        <button type="button" onClick={() => onOpen(l)} className="block w-full text-start">
          <span className="flex items-center justify-between gap-2">
            <span className="font-bold">{l.name || l.phone}</span>
            {stageBadge(l.stage)}
          </span>
          <span dir="ltr" className="block text-start text-xs text-muted-foreground">{l.phone}</span>
          <span className="mt-1 block text-xs">پیگیری: {followCell(l)}</span>
        </button>
      )}
    />
  )
}
