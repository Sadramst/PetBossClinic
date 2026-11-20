'use client'

import { useEffect, useState, useTransition } from 'react'
import { Link } from '@/i18n/routing'
import type { LeadStage, LostReason } from '@prisma/client'
import { Drawer, JalaliDateField, StatusBadge, stageBadge } from '@/components/admin/kit'
import { Button } from '@/components/ui/button'
import { Input, Select, Textarea } from '@/components/ui/input'
import { Field } from '@/components/ui/field'
import { toast } from '@/components/ui/toaster'
import { confirmDialog } from '@/components/ui/confirm-dialog'
import { assignLeadAction, changeLeadStageAction, convertLeadToCustomerAction, createLeadManualAction, deleteLeadAction, setLeadFollowUpAction } from '@/app/actions/crm-leads'
import { LEAD_NEXT, LEAD_STAGE_LABEL, LOST_REASON_LABEL, relativeDayFa, isoDayOffset, type LostReasonKey } from '@/lib/crm/labels'
import { formatJalaliDateTime } from '@/components/admin/format'

export type LeadView = {
  id: string
  name: string | null
  phone: string
  email: string | null
  petType: string | null
  serviceInterest: string | null
  message: string | null
  source: string | null
  stage: LeadStage
  lostReason: LostReason | null
  ownerId: string | null
  customerId: string | null
  followUpDate: string | null
  createdAt: string
}

export type StaffLite = { id: string; name: string }

export interface LeadDrawerProps {
  lead: LeadView | null
  /** True when creating a new lead. */
  creating: boolean
  /** A stage the user asked for that still needs a reason (LOST). */
  pendingStage: LeadStage | null
  staff: StaffLite[]
  isAdmin: boolean
  canEdit?: boolean
  onClose: () => void
  onChanged: () => void
}

export function LeadDrawer({ lead, creating, pendingStage, staff, isAdmin, canEdit = true, onClose, onChanged }: LeadDrawerProps) {
  const open = creating || !!lead
  const [pending, start] = useTransition()
  const [reason, setReason] = useState<LostReason | ''>('')
  const [lostAsk, setLostAsk] = useState(false)
  const [follow, setFollow] = useState<string | null>(null)
  const [form, setForm] = useState({ name: '', phone: '', email: '', petType: '', serviceInterest: '', message: '' })

  useEffect(() => {
    setReason('')
    setLostAsk(false)
    setFollow(lead?.followUpDate ?? null)
    if (creating) setForm({ name: '', phone: '', email: '', petType: '', serviceInterest: '', message: '' })
  }, [lead?.id, lead?.followUpDate, creating])

  function run(fn: () => Promise<{ ok: boolean; error?: string }>, ok: string, close = false) {
    start(async () => {
      const r = await fn()
      if (!r.ok) return void toast.error(r.error ?? 'انجام نشد')
      toast.success(ok)
      onChanged()
      if (close) onClose()
    })
  }

  if (creating) {
    return (
      <Drawer open={open} onOpenChange={(o) => !o && onClose()} title="ثبت سرنخ جدید" description="مثلاً تماس تلفنی یا مراجعهٔ حضوری که هنوز مشتری نشده است.">
        <form
          className="space-y-4"
          data-testid="lead-create-form"
          onSubmit={(e) => {
            e.preventDefault()
            run(async () => await createLeadManualAction(form), 'سرنخ ثبت شد', true)
          }}
        >
          <Field label="نام" optional>
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} maxLength={80} data-testid="lead-form-name" />
          </Field>
          <Field label="شمارهٔ موبایل" required>
            <Input dir="ltr" inputMode="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} data-testid="lead-form-phone" />
          </Field>
          <Field label="ایمیل" optional>
            <Input dir="ltr" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="نوع حیوان" optional>
              <Input value={form.petType} onChange={(e) => setForm({ ...form, petType: e.target.value })} maxLength={40} />
            </Field>
            <Field label="خدمت مورد نظر" optional>
              <Input value={form.serviceInterest} onChange={(e) => setForm({ ...form, serviceInterest: e.target.value })} maxLength={80} />
            </Field>
          </div>
          <Field label="یادداشت" optional>
            <Textarea rows={3} value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} maxLength={1000} />
          </Field>
          <Button type="submit" variant="gold" disabled={pending || !form.phone.trim()} data-testid="lead-form-submit">
            ثبت سرنخ
          </Button>
        </form>
      </Drawer>
    )
  }

  if (!lead) return <Drawer open={false} onOpenChange={() => onClose()} title="سرنخ">{null}</Drawer>

  const next = canEdit ? LEAD_NEXT[lead.stage] : []
  const needReason = pendingStage === 'LOST' || lostAsk

  return (
    <Drawer open={open} onOpenChange={(o) => !o && onClose()} title={lead.name || lead.phone} description={`ثبت‌شده در ${formatJalaliDateTime(lead.createdAt)}`}>
      <div className="space-y-5" data-testid="lead-drawer">
        <div className="flex flex-wrap items-center gap-2">
          {stageBadge(lead.stage)}
          {lead.lostReason && <StatusBadge tone="neutral">{LOST_REASON_LABEL[lead.lostReason as LostReasonKey]}</StatusBadge>}
          {lead.source && <span className="text-xs text-muted-foreground">منبع: {lead.source}</span>}
        </div>

        <dl className="grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-xs text-muted-foreground">موبایل</dt>
            <dd dir="ltr" className="text-start font-bold">{lead.phone}</dd>
          </div>
          {lead.email && (
            <div>
              <dt className="text-xs text-muted-foreground">ایمیل</dt>
              <dd dir="ltr" className="text-start">{lead.email}</dd>
            </div>
          )}
          {lead.petType && (
            <div>
              <dt className="text-xs text-muted-foreground">حیوان</dt>
              <dd>{lead.petType}</dd>
            </div>
          )}
          {lead.serviceInterest && (
            <div>
              <dt className="text-xs text-muted-foreground">خدمت مورد نظر</dt>
              <dd>{lead.serviceInterest}</dd>
            </div>
          )}
        </dl>
        {lead.message && <p className="rounded-xl bg-surface-elevated p-3 text-sm leading-7">{lead.message}</p>}

        {needReason ? (
          <div className="rounded-xl border border-border-gold p-3" data-testid="lost-reason-panel">
            <Field label="چرا این سرنخ از دست رفت؟" required>
              <Select value={reason} onChange={(e) => setReason(e.target.value as LostReason)} placeholder="دلیل را انتخاب کنید" data-testid="lost-reason-select">
                {Object.entries(LOST_REASON_LABEL).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </Select>
            </Field>
            <div className="mt-3 flex gap-2">
              <Button variant="danger" size="sm" disabled={!reason || pending} data-testid="lost-reason-confirm" onClick={() => run(async () => await changeLeadStageAction(lead.id, 'LOST', reason as LostReason), 'سرنخ از دست رفته ثبت شد', true)}>
                ثبت از دست رفتن
              </Button>
              <Button variant="ghost" size="sm" onClick={onClose}>
                انصراف
              </Button>
            </div>
          </div>
        ) : (
          next.length > 0 && (
            <div>
              <p className="mb-2 text-xs font-bold text-muted-foreground">انتقال به مرحلهٔ دیگر</p>
              <div className="flex flex-wrap gap-2">
                {next.map((s) => (
                  <Button
                    key={s}
                    size="sm"
                    variant={s === 'LOST' ? 'dangerOutline' : s === 'WON' ? 'gold' : 'secondary'}
                    disabled={pending}
                    data-testid={`lead-move-${s}`}
                    onClick={() => (s === 'LOST' ? setLostAsk(true) : run(async () => await changeLeadStageAction(lead.id, s as LeadStage), 'مرحله تغییر کرد'))}
                  >
                    {LEAD_STAGE_LABEL[s]}
                  </Button>
                ))}
              </div>
            </div>
          )
        )}

        <Field label="مسئول پیگیری">
          <Select
            value={lead.ownerId ?? ''}
            disabled={pending}
            onChange={(e) => run(async () => await assignLeadAction(lead.id, e.target.value || null), 'مسئول ذخیره شد')}
            data-testid="lead-owner-select"
          >
            <option value="">بدون مسئول</option>
            {staff.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </Select>
        </Field>

        <div>
          <JalaliDateField label="پیگیری بعدی" value={follow} onChange={setFollow} data-testid="lead-followup" />
          <div className="mt-2 flex flex-wrap gap-2">
            {[
              ['امروز', 0],
              ['فردا', 1],
              ['هفتهٔ بعد', 7],
            ].map(([l, d]) => (
              <Button key={String(l)} size="sm" variant="ghost" onClick={() => setFollow(isoDayOffset(Number(d)))}>
                {l}
              </Button>
            ))}
            <Button size="sm" variant="secondary" disabled={pending || follow === lead.followUpDate} data-testid="lead-followup-save" onClick={() => run(async () => await setLeadFollowUpAction(lead.id, follow), 'پیگیری ذخیره شد')}>
              ذخیره پیگیری{follow ? ` (${relativeDayFa(follow)})` : ''}
            </Button>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 border-t border-border pt-4">
          {lead.customerId ? (
            <Link href={`/admin/customers/${lead.customerId}`} className="btn btn-outline btn-sm" data-testid="lead-open-customer">
              پروندهٔ مشتری
            </Link>
          ) : (
            <Button
              size="sm"
              variant="outline"
              disabled={pending}
              data-testid="lead-convert"
              onClick={async () => {
                if (!(await confirmDialog({ title: 'این سرنخ به مشتری تبدیل شود؟', description: 'اگر با این شماره مشتری وجود داشته باشد، به همان وصل می‌شود.', tone: 'default', confirmLabel: 'تبدیل' }))) return
                run(async () => await convertLeadToCustomerAction(lead.id), 'سرنخ به مشتری وصل شد')
              }}
            >
              تبدیل به مشتری
            </Button>
          )}
          {isAdmin && (
            <Button
              size="sm"
              variant="dangerOutline"
              disabled={pending}
              data-testid="lead-delete"
              onClick={async () => {
                if (!(await confirmDialog({ title: 'سرنخ حذف شود؟', description: 'این کار قابل بازگشت نیست.', confirmLabel: 'حذف' }))) return
                run(async () => await deleteLeadAction(lead.id), 'سرنخ حذف شد', true)
              }}
            >
              حذف
            </Button>
          )}
        </div>
      </div>
    </Drawer>
  )
}
