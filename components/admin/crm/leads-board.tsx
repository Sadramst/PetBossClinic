'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'
import { LEAD_NEXT, LEAD_STAGE_LABEL, LEAD_STAGE_ORDER, relativeDayFa, faNum, dayDiff, type LeadStageKey } from '@/lib/crm/labels'
import type { LeadView, StaffLite } from './lead-drawer'

export interface LeadsBoardProps {
  leads: LeadView[]
  counts: Record<string, number>
  staff: StaffLite[]
  onOpen: (lead: LeadView) => void
  /** Ask to move a lead; the workspace handles the LOST reason step. */
  onMove: (lead: LeadView, to: LeadStageKey) => void
  /** False for read-only roles: no drag and no move menu. */
  canMove?: boolean
}

const COLUMN_TONE: Record<LeadStageKey, string> = {
  NEW: 'border-t-primary',
  CONTACTED: 'border-t-sky-500',
  QUALIFIED: 'border-t-sky-500',
  APPOINTMENT_BOOKED: 'border-t-amber-500',
  WON: 'border-t-emerald-500',
  LOST: 'border-t-border',
}

/** Staged board: drag a card to a column, or use the move menu (keyboard and phones). */
export function LeadsBoard({ leads, counts, staff, onOpen, onMove, canMove = true }: LeadsBoardProps) {
  const [dragId, setDragId] = useState<string | null>(null)
  const [over, setOver] = useState<LeadStageKey | null>(null)
  const names = Object.fromEntries(staff.map((s) => [s.id, s.name]))

  return (
    <div className="-mx-4 overflow-x-auto px-4 pb-3" data-testid="leads-board">
      <div className="flex min-w-max gap-3 md:min-w-0 md:grid md:grid-cols-6">
        {LEAD_STAGE_ORDER.map((stage) => {
          const col = leads.filter((l) => l.stage === stage)
          const total = counts[stage] ?? col.length
          return (
            <section
              key={stage}
              aria-label={LEAD_STAGE_LABEL[stage]}
              data-testid={`leads-col-${stage}`}
              onDragOver={(e) => {
                e.preventDefault()
                setOver(stage)
              }}
              onDragLeave={() => setOver((o) => (o === stage ? null : o))}
              onDrop={(e) => {
                e.preventDefault()
                setOver(null)
                const lead = leads.find((l) => l.id === dragId)
                setDragId(null)
                if (lead && lead.stage !== stage) onMove(lead, stage)
              }}
              className={cn('flex w-64 shrink-0 flex-col rounded-2xl border border-border border-t-4 bg-surface p-2.5 md:w-auto', COLUMN_TONE[stage], over === stage && 'ring-2 ring-primary/50')}
            >
              <h3 className="mb-2 flex items-center justify-between px-1 text-sm font-extrabold">
                {LEAD_STAGE_LABEL[stage]}
                <span className="rounded-full bg-surface-elevated px-2 text-xs font-bold text-muted-foreground">{faNum(total)}</span>
              </h3>
              <ul className="space-y-2">
                {col.length === 0 && <li className="rounded-xl border border-dashed border-border p-3 text-center text-xs text-muted-foreground">خالی</li>}
                {col.map((l) => {
                  const late = l.followUpDate && stage !== 'WON' && stage !== 'LOST' && dayDiff(new Date(l.followUpDate)) < 0
                  return (
                    <li
                      key={l.id}
                      draggable={canMove}
                      onDragStart={() => setDragId(l.id)}
                      onDragEnd={() => setDragId(null)}
                      data-testid="lead-card"
                      data-lead-id={l.id}
                      className={cn('rounded-xl border border-border bg-background p-3 text-sm shadow-sm', dragId === l.id && 'opacity-50')}
                    >
                      <button type="button" onClick={() => onOpen(l)} className="block w-full text-start" data-testid="lead-card-open">
                        <span className="block font-bold">{l.name || l.phone}</span>
                        {l.name && (
                          <span dir="ltr" className="block text-start text-xs text-muted-foreground">
                            {l.phone}
                          </span>
                        )}
                        {l.serviceInterest && <span className="mt-1 block text-xs text-muted-foreground">{l.serviceInterest}</span>}
                      </button>
                      <div className="mt-2 flex flex-wrap items-center justify-between gap-1 text-[11px]">
                        <span className="text-muted-foreground">{l.ownerId ? names[l.ownerId] ?? 'کاربر حذف‌شده' : 'بدون مسئول'}</span>
                        {l.followUpDate && <span className={cn('font-bold', late ? 'text-red-500' : 'text-muted-foreground')}>پیگیری: {relativeDayFa(l.followUpDate)}</span>}
                      </div>
                      {canMove && LEAD_NEXT[stage].length > 0 && (
                        <select
                          aria-label={`انتقال ${l.name || l.phone}`}
                          className="field field-sm mt-2 w-full"
                          value=""
                          onChange={(e) => e.target.value && onMove(l, e.target.value as LeadStageKey)}
                          data-testid="lead-card-move"
                        >
                          <option value="">انتقال به…</option>
                          {LEAD_NEXT[stage].map((s) => (
                            <option key={s} value={s}>
                              {LEAD_STAGE_LABEL[s]}
                            </option>
                          ))}
                        </select>
                      )}
                    </li>
                  )
                })}
              </ul>
            </section>
          )
        })}
      </div>
    </div>
  )
}
