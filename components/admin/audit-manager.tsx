'use client'

import { useState } from 'react'
import { PageHeader, FilterBar, DataTable, Pager, Drawer, StatusBadge, EmptyState, JalaliDateField, useUrlState, type FilterDef } from '@/components/admin/kit'
import { faNum, formatJalaliDateTime } from '@/components/admin/format'
import type { BadgeTone } from '@/components/ui/badge'
import {
  AUDIT_ACTION_FA,
  AUDIT_ENTITY_FA,
  actorOf,
  auditActionLabel,
  auditActionTone,
  auditEntityLabel,
  diffAudit,
  fmtAuditValue,
  isSensitivePath,
  type AuditQuery,
} from '@/lib/admin/audit-view'

export interface AuditLogItem {
  id: string
  userId: string | null
  action: string
  entity: string
  entityId: string
  ip: string | null
  location: string | null
  userAgent: string | null
  createdAt: string
  before: unknown
  after: unknown
  user?: { id: string; name: string | null; email: string | null } | null
}

interface Props {
  logs: AuditLogItem[]
  total: number
  query: AuditQuery
  entities: string[]
  users: { id: string; label: string }[]
}

const DEFAULTS = { q: '', entity: '', action: '', user: '', from: '', to: '', page: 1, size: 50 }
const dayToIso = (d: string) => (d ? `${d}T12:00:00.000Z` : null)
const TONE: Record<string, BadgeTone> = { ok: 'success', warn: 'warning', danger: 'danger', info: 'info', neutral: 'neutral' }

function actorLabel(log: AuditLogItem): { name: string; email: string } {
  const a = actorOf(log.after)
  return {
    name: log.user?.name || a?.name || 'سیستم',
    email: log.user?.email || a?.email || '',
  }
}

function ActionBadge({ action }: { action: string }) {
  return <StatusBadge tone={TONE[auditActionTone(action)]}>{auditActionLabel(action)}</StatusBadge>
}

function DiffView({ log }: { log: AuditLogItem }) {
  const rows = diffAudit(log.before, log.after)
  if (rows.length === 0) return <p className="text-sm text-muted-foreground">تغییر قابل نمایشی ثبت نشده است.</p>
  const KIND = { added: 'افزوده', removed: 'حذف‌شده', changed: 'تغییر کرد' } as const
  return (
    <ul data-testid="audit-diff" className="space-y-2">
      {rows.map((r) => {
        const hidden = isSensitivePath(r.path)
        return (
          <li key={r.path} className="rounded-xl border border-border bg-surface-elevated p-3 text-xs">
            <div className="mb-1.5 flex items-center justify-between gap-2">
              <span dir="ltr" className="font-mono font-bold text-foreground">
                {r.path}
              </span>
              <StatusBadge tone={r.kind === 'added' ? 'success' : r.kind === 'removed' ? 'danger' : 'warning'}>{KIND[r.kind]}</StatusBadge>
            </div>
            {hidden ? (
              <p className="text-muted-foreground">مقدار محرمانه است و نمایش داده نمی‌شود.</p>
            ) : (
              <div className="grid gap-1.5 sm:grid-cols-2">
                {r.kind !== 'added' && (
                  <p className="break-words rounded-lg bg-danger/10 px-2 py-1.5 text-danger">
                    <span className="me-1 font-bold">قبل:</span>
                    {fmtAuditValue(r.before)}
                  </p>
                )}
                {r.kind !== 'removed' && (
                  <p className="break-words rounded-lg bg-success/10 px-2 py-1.5 text-success">
                    <span className="me-1 font-bold">بعد:</span>
                    {fmtAuditValue(r.after)}
                  </p>
                )}
              </div>
            )}
          </li>
        )
      })}
    </ul>
  )
}

export function AuditManager({ logs, total, query, entities, users }: Props) {
  const [state, patch] = useUrlState(DEFAULTS)
  const [active, setActive] = useState<AuditLogItem | null>(null)

  const entityOptions = [...new Set([...Object.keys(AUDIT_ENTITY_FA), ...entities])].sort((a, b) =>
    auditEntityLabel(a).localeCompare(auditEntityLabel(b), 'fa'),
  )
  const filters: FilterDef[] = [
    {
      key: 'entity',
      label: 'همه بخش‌ها',
      type: 'select',
      value: state.entity,
      testId: 'audit-filter-entity',
      options: entityOptions.map((e) => ({ value: e, label: auditEntityLabel(e) })),
    },
    {
      key: 'action',
      label: 'همه عملیات',
      type: 'select',
      value: state.action,
      testId: 'audit-filter-action',
      options: Object.keys(AUDIT_ACTION_FA).map((a) => ({ value: a, label: AUDIT_ACTION_FA[a] })),
    },
    {
      key: 'user',
      label: 'همه کاربران',
      type: 'select',
      value: state.user,
      testId: 'audit-filter-user',
      options: users.map((u) => ({ value: u.id, label: u.label })),
    },
  ]
  const dirty = Boolean(state.q || state.entity || state.action || state.user || state.from || state.to)

  return (
    <div className="p-4 sm:p-6" data-testid="audit-log">
      <PageHeader
        title="گزارش تغییرات"
        subtitle="هر تغییر در پنل با زمان، کاربر و نشانی شبکه ثبت می‌شود و پاک نمی‌شود. روی هر ردیف بزنید تا مقدار قبل و بعد را ببینید."
        breadcrumbs={[{ label: 'تنظیمات' }, { label: 'گزارش تغییرات' }]}
      />
      <FilterBar
        search={{ value: state.q, placeholder: 'جستجو در شناسه، نشانی IP یا شهر' }}
        filters={filters}
        dirty={dirty}
        onChange={(p) => patch(p as Record<string, string>)}
        onReset={() => patch({ q: '', entity: '', action: '', user: '', from: '', to: '' })}
        views={
          <div className="flex flex-wrap items-end gap-2">
            <JalaliDateField label="از تاریخ" value={dayToIso(state.from)} onChange={(iso) => patch({ from: iso ? iso.slice(0, 10) : '' })} data-testid="audit-from" />
            <JalaliDateField label="تا تاریخ" value={dayToIso(state.to)} onChange={(iso) => patch({ to: iso ? iso.slice(0, 10) : '' })} data-testid="audit-to" />
          </div>
        }
      />

      <DataTable
        columns={[
          { key: 'time', header: 'زمان', cell: (l) => <span className="whitespace-nowrap text-xs">{formatJalaliDateTime(l.createdAt)}</span> },
          { key: 'action', header: 'عملیات', cell: (l) => <ActionBadge action={l.action} /> },
          {
            key: 'entity',
            header: 'بخش',
            cell: (l) => (
              <div>
                <span className="font-bold">{auditEntityLabel(l.entity)}</span>
                <span dir="ltr" className="block max-w-[160px] truncate font-mono text-[10px] text-muted-foreground">
                  {l.entityId}
                </span>
              </div>
            ),
          },
          {
            key: 'actor',
            header: 'کاربر',
            cell: (l) => {
              const a = actorLabel(l)
              return (
                <div>
                  <span className="font-bold">{a.name}</span>
                  {a.email && (
                    <span dir="ltr" className="block text-[10px] text-muted-foreground">
                      {a.email}
                    </span>
                  )}
                </div>
              )
            },
          },
          {
            key: 'net',
            header: 'شبکه',
            cell: (l) => (
              <div className="text-xs">
                <span>{l.location || '—'}</span>
                <span dir="ltr" className="block font-mono text-[10px] text-muted-foreground">
                  {l.ip || '—'}
                </span>
              </div>
            ),
          },
        ]}
        rows={logs}
        rowKey={(l) => l.id}
        onRowClick={(l) => setActive(l)}
        caption="فهرست تغییرات ثبت‌شده"
        mobileCard={(l) => (
          <button type="button" onClick={() => setActive(l)} className="block w-full space-y-1 text-start">
            <div className="flex items-center justify-between gap-2">
              <span className="font-bold">{auditEntityLabel(l.entity)}</span>
              <ActionBadge action={l.action} />
            </div>
            <p className="text-xs text-muted-foreground">
              {actorLabel(l).name} · {formatJalaliDateTime(l.createdAt)}
            </p>
          </button>
        )}
        empty={<EmptyState title="رکوردی پیدا نشد" description={dirty ? 'فیلترها را کمی بازتر کنید یا پاکشان کنید.' : 'هنوز تغییری ثبت نشده است.'} />}
      />

      <Pager page={query.page} pageSize={query.size} total={total} onPage={(p) => patch({ page: p })} onSize={(s) => patch({ size: s })} />

      <Drawer
        open={active !== null}
        onOpenChange={(o) => !o && setActive(null)}
        title={active ? `${auditActionLabel(active.action)} · ${auditEntityLabel(active.entity)}` : 'جزئیات تغییر'}
        description={active ? `${formatJalaliDateTime(active.createdAt)} · رکورد ${faNum(total)} تغییر در این فهرست` : undefined}
      >
        {active && (
          <div data-testid="audit-drawer" className="space-y-4">
            <dl className="grid grid-cols-2 gap-3 rounded-xl border border-border bg-surface-elevated p-3 text-xs">
              <div>
                <dt className="text-muted-foreground">کاربر</dt>
                <dd className="font-bold">{actorLabel(active).name}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">نشانی IP</dt>
                <dd dir="ltr" className="text-end font-mono">
                  {active.ip || '—'}
                </dd>
              </div>
              <div className="col-span-2">
                <dt className="text-muted-foreground">شناسه رکورد</dt>
                <dd dir="ltr" className="break-all text-end font-mono">
                  {active.entityId}
                </dd>
              </div>
              {active.userAgent && (
                <div className="col-span-2">
                  <dt className="text-muted-foreground">مرورگر</dt>
                  <dd dir="ltr" className="break-all text-end font-mono text-[10px]">
                    {active.userAgent}
                  </dd>
                </div>
              )}
            </dl>
            <h3 className="text-sm font-bold">تغییرات</h3>
            <DiffView log={active} />
          </div>
        )}
      </Drawer>
    </div>
  )
}
