'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Link } from '@/i18n/routing'
import { PageHeader, Pager, AdminTabs, StatusBadge, taskBadge, useUrlState, EmptyState } from '@/components/admin/kit'
import { Button } from '@/components/ui/button'
import { toast } from '@/components/ui/toaster'
import { confirmDialog } from '@/components/ui/confirm-dialog'
import { completeTaskAction, snoozeTaskAction, deleteTaskAction, exportTasksCsvAction } from '@/app/actions/crm-tasks'
import { TASK_PRIORITY_LABEL, TASK_TYPE_LABEL, relativeDayFa, isoDayOffset } from '@/lib/crm/labels'
import { cn } from '@/lib/utils'
import { TaskDialog, type TaskView } from './task-dialog'

export interface TasksManagerProps {
  tasks: TaskView[]
  total: number
  page: number
  size: number
  scope: 'mine' | 'today' | 'overdue' | 'all'
  counts: { mine: number; today: number; overdue: number }
  staff: { id: string; name: string }[]
  currentUserId: string
  isAdmin: boolean
  openNew?: boolean
}

const DEFAULTS = { scope: 'mine', status: '', type: '', page: 1 }

export function TasksManager({ tasks, total, page, size, scope, counts, staff, currentUserId, isAdmin, openNew }: TasksManagerProps) {
  const router = useRouter()
  const [state, patch] = useUrlState(DEFAULTS)
  const [pending, start] = useTransition()
  const [editing, setEditing] = useState<TaskView | null>(null)
  const [creating, setCreating] = useState(!!openNew)
  const names = Object.fromEntries(staff.map((s) => [s.id, s.name]))

  function run(fn: () => Promise<{ ok: boolean; error?: string }>, ok: string) {
    start(async () => {
      const r = await fn()
      if (!r.ok) return void toast.error(r.error ?? 'انجام نشد')
      toast.success(ok)
      router.refresh()
    })
  }

  async function exportCsv() {
    const r = await exportTasksCsvAction({ scope })
    if (!r.ok) return void toast.error(r.error)
    const url = URL.createObjectURL(new Blob([r.data], { type: 'text/csv;charset=utf-8' }))
    const a = document.createElement('a')
    a.href = url
    a.download = 'tasks.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-5" data-testid="tasks-page">
      <PageHeader
        title="کارها و پیگیری‌ها"
        subtitle="هر مشتری و سرنخ باید یک کار بعدی داشته باشد؛ اینجا کارهای امروز شما، عقب‌افتاده‌ها و کارهای تیم را می‌بینید."
        breadcrumbs={[{ label: 'کارها' }]}
        actions={
          <>
            {isAdmin && (
              <Button variant="secondary" size="sm" onClick={exportCsv} data-testid="tasks-export">
                خروجی CSV
              </Button>
            )}
            <Button variant="gold" size="sm" onClick={() => setCreating(true)} data-testid="task-new">
              کار جدید
            </Button>
          </>
        }
      />

      <AdminTabs
        label="دامنهٔ کارها"
        value={scope}
        onChange={(v) => patch({ scope: v })}
        testIdPrefix="tasks-scope"
        items={[
          { id: 'mine', label: 'کارهای من', count: counts.mine },
          { id: 'today', label: 'امروز', count: counts.today },
          { id: 'overdue', label: 'عقب‌افتاده', count: counts.overdue },
          { id: 'all', label: 'همهٔ کارها' },
        ]}
      />

      <div className="flex flex-wrap items-center gap-2" data-testid="tasks-filters">
        <select aria-label="وضعیت" className="field field-sm w-40" value={state.status} onChange={(e) => patch({ status: e.target.value })} data-testid="tasks-filter-status">
          <option value="">وضعیت: پیش‌فرض</option>
          <option value="OPEN">باز</option>
          <option value="IN_PROGRESS">در حال انجام</option>
          <option value="DONE">انجام‌شده</option>
          <option value="CANCELLED">لغوشده</option>
        </select>
        <select aria-label="نوع" className="field field-sm w-44" value={state.type} onChange={(e) => patch({ type: e.target.value })} data-testid="tasks-filter-type">
          <option value="">همهٔ انواع</option>
          {Object.entries(TASK_TYPE_LABEL).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        {(state.status || state.type) && (
          <Button size="sm" variant="ghost" onClick={() => patch({ status: '', type: '' })} data-testid="filter-reset">
            پاک کردن فیلترها
          </Button>
        )}
      </div>

      {tasks.length === 0 ? (
        <EmptyState title={scope === 'overdue' ? 'کار عقب‌افتاده‌ای ندارید' : 'کاری برای نمایش نیست'} description="کارهای خودکار هر روز صبح از روی سرنخ‌ها، واکسن‌ها و سبدهای رهاشده ساخته می‌شوند." action={<Button size="sm" variant="gold" onClick={() => setCreating(true)}>ثبت کار</Button>} />
      ) : (
        <ul className="space-y-2" data-testid="tasks-list">
          {tasks.map((t) => {
            const done = t.status === 'DONE' || t.status === 'CANCELLED'
            return (
              <li key={t.id} data-testid="task-row" data-task-id={t.id} className={cn('flex flex-wrap items-center gap-3 rounded-2xl border border-border bg-surface p-3', t.overdue && !done && 'border-red-500/40')}>
                <button
                  type="button"
                  aria-label={`انجام شد: ${t.title}`}
                  disabled={pending || done}
                  data-testid="task-complete"
                  onClick={() => run(async () => await completeTaskAction(t.id), 'کار انجام شد')}
                  className={cn('inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full border-2 text-lg', done ? 'border-emerald-500 bg-emerald-500/15 text-emerald-500' : 'border-border text-transparent hover:border-primary hover:text-primary')}
                >
                  ✓
                </button>
                <div className="min-w-0 flex-1">
                  <button type="button" onClick={() => setEditing(t)} className={cn('block text-start font-bold hover:text-primary', done && 'line-through opacity-60')} data-testid="task-open">
                    {t.title}
                  </button>
                  <p className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                    <span>{TASK_TYPE_LABEL[t.type]}</span>
                    {t.priority === 1 && <span className="font-bold text-red-500">{TASK_PRIORITY_LABEL[1]}</span>}
                    {t.customerId && (
                      <Link className="text-primary hover:underline" href={`/admin/customers/${t.customerId}`}>
                        {t.customerName || 'مشتری'}
                      </Link>
                    )}
                    {t.leadId && !t.customerId && (
                      <Link className="text-primary hover:underline" href="/admin/leads?view=list">
                        {t.leadName || 'سرنخ'}
                      </Link>
                    )}
                    {t.ticketId && (
                      <Link className="text-primary hover:underline" href="/admin/messages">
                        پیام مرتبط
                      </Link>
                    )}
                    <span>{t.ownerId ? names[t.ownerId] ?? 'کاربر حذف‌شده' : 'بدون مسئول'}</span>
                    {t.system && <StatusBadge tone="neutral" dot={false}>خودکار</StatusBadge>}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className={cn('text-sm font-bold', t.overdue && !done ? 'text-red-500' : 'text-muted-foreground')}>{relativeDayFa(t.dueAt)}</span>
                  {taskBadge(t.status)}
                  {!done && (
                    <Button size="sm" variant="ghost" disabled={pending} data-testid="task-snooze" onClick={() => run(async () => await snoozeTaskAction(t.id, isoDayOffset(1)), 'به فردا موکول شد')}>
                      فردا
                    </Button>
                  )}
                  {isAdmin && (
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={pending}
                      data-testid="task-delete"
                      onClick={async () => {
                        if (!(await confirmDialog({ title: 'کار حذف شود؟', confirmLabel: 'حذف' }))) return
                        run(async () => await deleteTaskAction(t.id), 'کار حذف شد')
                      }}
                    >
                      حذف
                    </Button>
                  )}
                </div>
              </li>
            )
          })}
        </ul>
      )}

      <Pager page={page} pageSize={size} total={total} onPage={(p) => patch({ page: p })} />

      <TaskDialog open={creating || !!editing} task={editing} staff={staff} currentUserId={currentUserId} onClose={() => { setCreating(false); setEditing(null) }} onSaved={() => router.refresh()} />
    </div>
  )
}
