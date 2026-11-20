'use client'

import { useCallback, useEffect, useState, useTransition } from 'react'
import { Link } from '@/i18n/routing'
import type { TicketPriority, TicketStatus } from '@prisma/client'
import { Drawer, StatusBadge, ticketBadge } from '@/components/admin/kit'
import { Button } from '@/components/ui/button'
import { Select, Textarea } from '@/components/ui/input'
import { Field } from '@/components/ui/field'
import { toast } from '@/components/ui/toaster'
import { confirmDialog } from '@/components/ui/confirm-dialog'
import { assignTicketAction, deleteTicketAction, getTicketAction, replyTicketAction, setTicketPriorityAction, setTicketStatusAction } from '@/app/actions/tickets'
import { PRIORITY_LABEL, SLA_LABEL, TICKET_NEXT, TICKET_STATUS_LABEL } from '@/lib/crm/labels'
import { formatJalaliDateTime } from '@/components/admin/format'
import type { TicketReplyRow, TicketRow } from '@/lib/crm/tickets'

export interface TicketDrawerProps {
  ticketId: string | null
  staff: { id: string; name: string }[]
  isAdmin: boolean
  canEdit: boolean
  onClose: () => void
  onChanged: () => void
}

const SLA_TONE = { ok: 'success', due: 'warning', breached: 'danger' } as const

/** One ticket: the message, the conversation, SLA and the reply box (public reply, SMS or internal note). */
export function TicketDrawer({ ticketId, staff, isAdmin, canEdit, onClose, onChanged }: TicketDrawerProps) {
  const [data, setData] = useState<{ ticket: TicketRow; replies: TicketReplyRow[] } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [body, setBody] = useState('')
  const [mode, setMode] = useState<'reply' | 'sms' | 'internal'>('reply')
  const [pending, start] = useTransition()
  const names = Object.fromEntries(staff.map((s) => [s.id, s.name]))

  const load = useCallback(async () => {
    if (!ticketId) return
    const r = await getTicketAction(ticketId)
    if (r.ok) {
      setData(r.data)
      setError(null)
    } else setError(r.error)
  }, [ticketId])

  useEffect(() => {
    setData(null)
    setError(null)
    setBody('')
    setMode('reply')
    void load()
  }, [load])

  function run(fn: () => Promise<{ ok: boolean; error?: string }>, ok: string, then?: () => void) {
    start(async () => {
      const r = await fn()
      if (!r.ok) return void toast.error(r.error ?? 'انجام نشد')
      toast.success(ok)
      onChanged()
      then?.()
      await load()
    })
  }

  const t = data?.ticket
  return (
    <Drawer open={!!ticketId} onOpenChange={(o) => !o && onClose()} title={t ? t.subject || `پیام ${t.name}` : 'پیام'} description={t ? `${t.name} · ${formatJalaliDateTime(t.createdAt)}` : undefined}>
      {error && <p className="rounded-xl bg-red-500/10 p-3 text-sm text-red-500">{error}</p>}
      {!t && !error && <p className="py-8 text-center text-sm text-muted-foreground">در حال بارگذاری…</p>}
      {t && data && (
        <div className="space-y-5" data-testid="ticket-drawer">
          <div className="flex flex-wrap items-center gap-2">
            {ticketBadge(t.status)}
            {(t.status === 'OPEN' || t.status === 'PENDING') && (
              <StatusBadge tone={SLA_TONE[t.sla]} data-testid="ticket-sla">
                {SLA_LABEL[t.sla]}
              </StatusBadge>
            )}
            <span dir="ltr" className="text-xs text-muted-foreground">{t.phone}</span>
            {t.customerId && (
              <Link href={`/admin/customers/${t.customerId}`} className="text-xs font-bold text-primary hover:underline" data-testid="ticket-customer-link">
                پروندهٔ مشتری
              </Link>
            )}
          </div>

          <p className="whitespace-pre-wrap rounded-xl bg-surface-elevated p-3 text-sm leading-7">{t.message}</p>

          {canEdit && (
            <div className="grid gap-3 sm:grid-cols-3">
              <Field label="مسئول">
                <Select value={t.assigneeId ?? ''} disabled={pending} data-testid="ticket-assignee" onChange={(e) => run(async () => await assignTicketAction(t.id, e.target.value || null), 'مسئول ذخیره شد')}>
                  <option value="">بدون مسئول</option>
                  {staff.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="اولویت">
                <Select value={t.priority} disabled={pending} data-testid="ticket-priority" onChange={(e) => run(async () => await setTicketPriorityAction(t.id, e.target.value as TicketPriority), 'اولویت ذخیره شد')}>
                  {Object.entries(PRIORITY_LABEL).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="وضعیت">
                <Select value={t.status} disabled={pending} data-testid="ticket-status" onChange={(e) => run(async () => await setTicketStatusAction(t.id, e.target.value as TicketStatus), 'وضعیت تغییر کرد')}>
                  <option value={t.status}>{TICKET_STATUS_LABEL[t.status]}</option>
                  {TICKET_NEXT[t.status].map((s) => (
                    <option key={s} value={s}>
                      {TICKET_STATUS_LABEL[s]}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>
          )}
          {!canEdit && t.assigneeId && <p className="text-xs text-muted-foreground">مسئول: {names[t.assigneeId] ?? 'کاربر حذف‌شده'}</p>}

          <section aria-label="گفتگو" data-testid="ticket-thread">
            <h3 className="mb-2 text-sm font-extrabold">گفتگو</h3>
            {data.replies.length === 0 ? (
              <p className="text-sm text-muted-foreground">هنوز پاسخی ثبت نشده است.</p>
            ) : (
              <ul className="space-y-2">
                {data.replies.map((r) => (
                  <li key={r.id} data-testid="ticket-reply" className={r.internal ? 'rounded-xl border border-dashed border-amber-500/50 bg-amber-500/5 p-3 text-sm' : 'rounded-xl border border-border bg-surface p-3 text-sm'}>
                    <p className="mb-1 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                      <span className="font-bold">{r.authorUserId ? names[r.authorUserId] ?? 'کارمند' : 'سیستم'}</span>
                      <span>{formatJalaliDateTime(r.createdAt)}</span>
                      {r.internal ? <StatusBadge tone="warning" dot={false}>یادداشت داخلی</StatusBadge> : r.channel === 'SMS' ? <StatusBadge tone="info" dot={false}>پیامک</StatusBadge> : null}
                    </p>
                    <p className="whitespace-pre-wrap leading-7">{r.body}</p>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {canEdit && t.status !== 'CLOSED' && (
            <form
              className="space-y-3 border-t border-border pt-4"
              data-testid="ticket-reply-form"
              onSubmit={(e) => {
                e.preventDefault()
                run(async () => await replyTicketAction(t.id, { body, internal: mode === 'internal', sendSms: mode === 'sms' }), mode === 'internal' ? 'یادداشت ثبت شد' : 'پاسخ ثبت شد', () => setBody(''))
              }}
            >
              <div role="radiogroup" aria-label="نوع پاسخ" className="flex flex-wrap gap-2">
                {(
                  [
                    ['reply', 'پاسخ ثبت‌شده'],
                    ['sms', 'ارسال پیامک'],
                    ['internal', 'یادداشت داخلی'],
                  ] as const
                ).map(([k, l]) => (
                  <button key={k} type="button" role="radio" aria-checked={mode === k} onClick={() => setMode(k)} data-testid={`ticket-mode-${k}`} className={`min-h-9 rounded-full border px-3 text-xs font-bold ${mode === k ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground'}`}>
                    {l}
                  </button>
                ))}
              </div>
              <Textarea rows={4} value={body} onChange={(e) => setBody(e.target.value)} maxLength={640} placeholder={mode === 'internal' ? 'یادداشتی که فقط تیم می‌بیند…' : 'پاسخ شما…'} aria-label="متن پاسخ" data-testid="ticket-reply-body" />
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs text-muted-foreground">{body.length.toLocaleString('fa-IR')} / ۶۴۰</span>
                <Button type="submit" variant="gold" size="sm" disabled={pending || !body.trim()} data-testid="ticket-reply-submit">
                  {mode === 'internal' ? 'ثبت یادداشت' : mode === 'sms' ? 'ارسال پیامک' : 'ثبت پاسخ'}
                </Button>
              </div>
            </form>
          )}

          <div className="flex flex-wrap gap-2 border-t border-border pt-4">
            {canEdit && (
              <Link href={`/admin/tasks?new=1`} className="btn btn-outline btn-sm" data-testid="ticket-make-task">
                ساخت کار پیگیری
              </Link>
            )}
            {isAdmin && (
              <Button
                size="sm"
                variant="dangerOutline"
                disabled={pending}
                data-testid="ticket-delete"
                onClick={async () => {
                  if (!(await confirmDialog({ title: 'این پیام و گفتگوهایش حذف شود؟', description: 'این کار قابل بازگشت نیست.', confirmLabel: 'حذف' }))) return
                  run(async () => await deleteTicketAction(t.id), 'پیام حذف شد', onClose)
                }}
              >
                حذف پیام
              </Button>
            )}
          </div>
        </div>
      )}
    </Drawer>
  )
}
