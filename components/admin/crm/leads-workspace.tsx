'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { LeadStage } from '@prisma/client'
import { PageHeader, FilterBar, Pager, StatCard, useUrlState, AdminTabs } from '@/components/admin/kit'
import { Button } from '@/components/ui/button'
import { toast } from '@/components/ui/toaster'
import { changeLeadStageAction, exportLeadsCsvAction } from '@/app/actions/crm-leads'
import { LEAD_STAGE_LABEL, LEAD_STAGE_ORDER, type LeadStageKey } from '@/lib/crm/labels'
import { LeadDrawer, type LeadView, type StaffLite } from './lead-drawer'
import { LeadsBoard } from './leads-board'
import { LeadsTable } from './leads-table'
import { SavedViews } from './saved-views'

export interface LeadsWorkspaceProps {
  leads: LeadView[]
  total: number
  page: number
  size: number
  counts: Record<string, number>
  staff: StaffLite[]
  sources: string[]
  isAdmin: boolean
  canEdit: boolean
  openNew?: boolean
}

const DEFAULTS = { q: '', stage: '', owner: '', source: '', view: 'board', page: 1 }

export function LeadsWorkspace({ leads, total, page, size, counts, staff, sources, isAdmin, canEdit, openNew }: LeadsWorkspaceProps) {
  const router = useRouter()
  const [state, patch] = useUrlState(DEFAULTS)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [creating, setCreating] = useState(!!openNew)
  const [pendingStage, setPendingStage] = useState<LeadStage | null>(null)
  const selected = leads.find((l) => l.id === selectedId) ?? null
  const dirty = !!(state.q || state.stage || state.owner || state.source)
  const view = state.view === 'list' ? 'list' : 'board'

  async function move(lead: LeadView, to: LeadStageKey) {
    if (to === 'LOST') {
      setSelectedId(lead.id)
      setPendingStage('LOST')
      return
    }
    const r = await changeLeadStageAction(lead.id, to as LeadStage)
    if (!r.ok) return void toast.error(r.error)
    toast.success(`«${lead.name || lead.phone}» به «${LEAD_STAGE_LABEL[to]}» رفت`)
    router.refresh()
  }

  async function exportCsv() {
    const r = await exportLeadsCsvAction({ q: state.q, stage: (state.stage || undefined) as LeadStage | undefined, owner: state.owner, source: state.source })
    if (!r.ok) return void toast.error(r.error)
    const url = URL.createObjectURL(new Blob([r.data], { type: 'text/csv;charset=utf-8' }))
    const a = document.createElement('a')
    a.href = url
    a.download = 'leads.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  const open = (l: LeadView) => {
    setPendingStage(null)
    setSelectedId(l.id)
  }
  const close = () => {
    setSelectedId(null)
    setPendingStage(null)
    setCreating(false)
  }

  return (
    <div className="space-y-5" data-testid="leads-page">
      <PageHeader
        title="سرنخ‌ها"
        subtitle="از اولین تماس تا تبدیل به مشتری؛ هر سرنخ یک مسئول و یک پیگیری بعدی دارد."
        breadcrumbs={[{ label: 'سرنخ‌ها' }]}
        actions={
          <>
            {isAdmin && (
              <Button variant="secondary" size="sm" onClick={exportCsv} data-testid="leads-export">
                خروجی CSV
              </Button>
            )}
            {canEdit && (
              <Button variant="gold" size="sm" onClick={() => setCreating(true)} data-testid="lead-new">
                سرنخ جدید
              </Button>
            )}
          </>
        }
      />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4" data-testid="leads-stats">
        {(['NEW', 'CONTACTED', 'APPOINTMENT_BOOKED', 'WON'] as const).map((s) => (
          <StatCard key={s} statKey={s} label={LEAD_STAGE_LABEL[s]} value={(counts[s] ?? 0).toLocaleString('fa-IR')} active={state.stage === s} tone={s === 'NEW' ? 'gold' : s === 'WON' ? 'ok' : 'neutral'} />
        ))}
      </div>

      <AdminTabs
        label="نمای سرنخ‌ها"
        value={view}
        onChange={(v) => patch({ view: v })}
        testIdPrefix="leads-view"
        items={[
          { id: 'board', label: 'برد مراحل' },
          { id: 'list', label: 'فهرست', count: total },
        ]}
      />

      <FilterBar
        search={{ value: state.q, placeholder: 'نام، موبایل یا پیام…' }}
        dirty={dirty}
        onChange={(p) => patch(p as Record<string, string>)}
        onReset={() => patch({ q: '', stage: '', owner: '', source: '' })}
        views={<SavedViews entity="LEAD" canShare={isAdmin} current={{ q: state.q, stage: state.stage, owner: state.owner, source: state.source }} onApply={(f) => patch({ q: f.q ?? '', stage: f.stage ?? '', owner: f.owner ?? '', source: f.source ?? '' })} />}
        filters={[
          { key: 'stage', label: 'مرحله', type: 'select', value: state.stage, testId: 'leads-filter-stage', options: [{ value: '', label: 'همهٔ مراحل' }, ...LEAD_STAGE_ORDER.map((s) => ({ value: s, label: LEAD_STAGE_LABEL[s] }))] },
          { key: 'owner', label: 'مسئول', type: 'select', value: state.owner, testId: 'leads-filter-owner', options: [{ value: '', label: 'همهٔ مسئولان' }, { value: 'none', label: 'بدون مسئول' }, ...staff.map((s) => ({ value: s.id, label: s.name }))] },
          ...(sources.length ? [{ key: 'source', label: 'منبع', type: 'select' as const, value: state.source, options: [{ value: '', label: 'همهٔ منابع' }, ...sources.map((s) => ({ value: s, label: s }))] }] : []),
        ]}
      />

      {view === 'board' ? <LeadsBoard leads={leads} counts={counts} staff={staff} onOpen={open} canMove={canEdit} onMove={canEdit ? move : () => toast.error('برای جابه‌جایی سرنخ دسترسی ویرایش لازم است.')} /> : <LeadsTable leads={leads} staff={staff} onOpen={open} />}

      {view === 'list' && <Pager page={page} pageSize={size} total={total} onPage={(p) => patch({ page: p })} onSize={undefined} />}
      {view === 'board' && total > leads.length && <p className="text-center text-xs text-muted-foreground">فقط جدیدترین {leads.length.toLocaleString('fa-IR')} سرنخ نمایش داده می‌شود؛ برای دیدن همه به نمای فهرست بروید یا فیلتر کنید.</p>}

      <LeadDrawer canEdit={canEdit} lead={selected} creating={creating} pendingStage={pendingStage} staff={staff} isAdmin={isAdmin} onClose={close} onChanged={() => router.refresh()} />
    </div>
  )
}
