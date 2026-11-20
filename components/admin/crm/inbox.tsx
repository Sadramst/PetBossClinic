'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { TicketPriority, TicketStatus } from '@prisma/client'
import { PageHeader, FilterBar, Pager, DataTable, StatCard, StatusBadge, ticketBadge, useUrlState, type Column } from '@/components/admin/kit'
import { Button } from '@/components/ui/button'
import { toast } from '@/components/ui/toaster'
import { exportTicketsCsvAction } from '@/app/actions/tickets'
import { PRIORITY_LABEL, SLA_LABEL, TICKET_STATUS_LABEL, relativeDayFa } from '@/lib/crm/labels'
import { cn } from '@/lib/utils'
import { TicketDrawer } from './ticket-drawer'
import { SavedViews } from './saved-views'

export type TicketListItem = {
  id: string
  name: string
  phone: string
  subject: string | null
  message: string
  isRead: boolean
  status: TicketStatus
  priority: TicketPriority
  assigneeId: string | null
  customerId: string | null
  createdAt: string
  sla: 'ok' | 'due' | 'breached'
}

export interface InboxProps {
  tickets: TicketListItem[]
  total: number
  page: number
  size: number
  counts: { open: number; pending: number; unassigned: number; breached: number }
  staff: { id: string; name: string }[]
  isAdmin: boolean
  canEdit: boolean
  /** Opened directly from a notification link. */
  initialId?: string
}

const DEFAULTS = { q: '', status: '', assignee: '', priority: '', breached: '', page: 1 }
const SLA_TONE = { ok: 'success', due: 'warning', breached: 'danger' } as const

export function Inbox({ tickets, total, page, size, counts, staff, isAdmin, canEdit, initialId }: InboxProps) {
  const router = useRouter()
  const [state, patch] = useUrlState(DEFAULTS)
  const [openId, setOpenId] = useState<string | null>(initialId ?? null)
  const names = Object.fromEntries(staff.map((s) => [s.id, s.name]))
  const dirty = !!(state.q || state.status || state.assignee || state.priority || state.breached)

  async function exportCsv() {
    const r = await exportTicketsCsvAction({ q: state.q, status: (state.status || undefined) as TicketStatus | undefined, priority: (state.priority || undefined) as TicketPriority | undefined })
    if (!r.ok) return void toast.error(r.error)
    const url = URL.createObjectURL(new Blob([r.data], { type: 'text/csv;charset=utf-8' }))
    const a = document.createElement('a')
    a.href = url
    a.download = 'tickets.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  const slaCell = (t: TicketListItem) =>
    t.status === 'OPEN' || t.status === 'PENDING' ? <StatusBadge tone={SLA_TONE[t.sla]}>{SLA_LABEL[t.sla]}</StatusBadge> : <span className="text-muted-foreground">—</span>

  const columns: Column<TicketListItem>[] = [
    {
      key: 'subject',
      header: 'پیام',
      cell: (t) => (
        <button type="button" onClick={() => setOpenId(t.id)} className="block max-w-xs text-start" data-testid="ticket-open">
          <span className={cn('block truncate', !t.isRead ? 'font-extrabold' : 'font-bold')}>{!t.isRead && <span aria-label="خوانده‌نشده" className="me-1.5 inline-block h-2 w-2 rounded-full bg-primary align-middle" />}{t.subject || t.message.slice(0, 60)}</span>
          <span className="block truncate text-xs text-muted-foreground">{t.name}</span>
        </button>
      ),
    },
    { key: 'status', header: 'وضعیت', cell: (t) => ticketBadge(t.status) },
    { key: 'sla', header: 'مهلت پاسخ', cell: slaCell },
    { key: 'priority', header: 'اولویت', cell: (t) => <span className={t.priority === 'HIGH' ? 'font-bold text-red-500' : undefined}>{PRIORITY_LABEL[t.priority]}</span> },
    { key: 'assignee', header: 'مسئول', cell: (t) => (t.assigneeId ? names[t.assigneeId] ?? 'کاربر حذف‌شده' : <span className="text-muted-foreground">بدون مسئول</span>) },
    { key: 'date', header: 'دریافت', cell: (t) => relativeDayFa(t.createdAt) },
  ]

  return (
    <div className="space-y-5" data-testid="inbox-page">
      <PageHeader
        title="پیام‌ها و پشتیبانی"
        subtitle="هر پیام مثل یک درخواست پشتیبانی پیگیری می‌شود: مسئول، اولویت، مهلت پاسخ و گفتگو در یک‌جا."
        breadcrumbs={[{ label: 'پیام‌ها' }]}
        actions={
          isAdmin && (
            <Button variant="secondary" size="sm" onClick={exportCsv} data-testid="tickets-export">
              خروجی CSV
            </Button>
          )
        }
      />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4" data-testid="inbox-stats">
        <StatCard statKey="open" label="باز" value={counts.open.toLocaleString('fa-IR')} tone="gold" />
        <StatCard statKey="pending" label="در انتظار مشتری" value={counts.pending.toLocaleString('fa-IR')} />
        <StatCard statKey="unassigned" label="بدون مسئول" value={counts.unassigned.toLocaleString('fa-IR')} tone={counts.unassigned ? 'warn' : 'neutral'} />
        <StatCard statKey="breached" label="مهلت گذشته" value={counts.breached.toLocaleString('fa-IR')} tone={counts.breached ? 'danger' : 'ok'} active={state.breached === '1'} />
      </div>

      <FilterBar
        search={{ value: state.q, placeholder: 'نام، موبایل، موضوع یا متن پیام…' }}
        dirty={dirty}
        onChange={(p) => patch(p as Record<string, string>)}
        onReset={() => patch({ q: '', status: '', assignee: '', priority: '', breached: '' })}
        views={<SavedViews entity="TICKET" canShare={isAdmin} current={{ q: state.q, status: state.status, assignee: state.assignee, priority: state.priority, breached: state.breached }} onApply={(f) => patch({ q: f.q ?? '', status: f.status ?? '', assignee: f.assignee ?? '', priority: f.priority ?? '', breached: f.breached ?? '' })} />}
        filters={[
          { key: 'status', label: 'وضعیت', type: 'select', value: state.status, testId: 'inbox-filter-status', options: [{ value: '', label: 'همهٔ وضعیت‌ها' }, ...Object.entries(TICKET_STATUS_LABEL).map(([value, label]) => ({ value, label }))] },
          { key: 'assignee', label: 'مسئول', type: 'select', value: state.assignee, testId: 'inbox-filter-assignee', options: [{ value: '', label: 'همهٔ مسئولان' }, { value: 'none', label: 'بدون مسئول' }, ...staff.map((s) => ({ value: s.id, label: s.name }))] },
          { key: 'priority', label: 'اولویت', type: 'select', value: state.priority, options: [{ value: '', label: 'همهٔ اولویت‌ها' }, ...Object.entries(PRIORITY_LABEL).map(([value, label]) => ({ value, label }))] },
          { key: 'breached', label: 'فقط مهلت گذشته', type: 'toggle', value: state.breached === '1', testId: 'inbox-filter-breached' },
        ]}
      />

      <DataTable
        columns={columns}
        rows={tickets}
        rowKey={(t) => t.id}
        caption="فهرست پیام‌ها"
        empty={<p className="p-8 text-center text-sm text-muted-foreground">پیامی با این فیلترها پیدا نشد.</p>}
        mobileCard={(t) => (
          <button type="button" onClick={() => setOpenId(t.id)} className="block w-full text-start">
            <span className="flex items-center justify-between gap-2">
              <span className={cn(!t.isRead ? 'font-extrabold' : 'font-bold')}>{t.subject || t.message.slice(0, 40)}</span>
              {ticketBadge(t.status)}
            </span>
            <span className="mt-1 flex items-center justify-between text-xs text-muted-foreground">
              <span>{t.name}</span>
              {slaCell(t)}
            </span>
          </button>
        )}
      />

      <Pager page={page} pageSize={size} total={total} onPage={(p) => patch({ page: p })} />

      <TicketDrawer ticketId={openId} staff={staff} isAdmin={isAdmin} canEdit={canEdit} onClose={() => { setOpenId(null); router.refresh() }} onChanged={() => router.refresh()} />
    </div>
  )
}
