'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Link } from '@/i18n/routing'
import { lifecycleBadge, churnBadge, type LifecycleStageValue } from '@/components/admin/kit'
import { Button } from '@/components/ui/button'
import { Select, Textarea } from '@/components/ui/input'
import { toast } from '@/components/ui/toaster'
import { assignCustomerOwnerAction, quickNoteAction } from '@/app/actions/crm-customers'
import { faNum, relativeDayFa } from '@/lib/crm/labels'

export interface CustomerHealthCardProps {
  customerId: string
  lifecycle: LifecycleStageValue | null
  health: number | null
  churn: string | null
  ownerId: string | null
  lastContactedAt: string | null
  staff: { id: string; name: string }[]
  counts: { openTasks: number; openLeads: number; openTickets: number }
}

function tone(score: number): string {
  return score >= 70 ? 'bg-emerald-500' : score >= 40 ? 'bg-amber-500' : 'bg-red-500'
}

/** Header strip of the customer page: stage, health, owner, open work and a quick note. */
export function CustomerHealthCard({ customerId, lifecycle, health, churn, ownerId, lastContactedAt, staff, counts }: CustomerHealthCardProps) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const [note, setNote] = useState('')

  return (
    <section aria-label="وضعیت مشتری" className="grid gap-4 rounded-2xl border border-border bg-surface p-4 md:grid-cols-3" data-testid="customer-health-card">
      <div className="space-y-2">
        <p className="text-xs font-bold text-muted-foreground">مرحلهٔ مشتری</p>
        <div className="flex flex-wrap items-center gap-2">
          {lifecycle ? lifecycleBadge(lifecycle) : <span className="text-sm text-muted-foreground">هنوز محاسبه نشده</span>}
          {churn && churnBadge(churn)}
        </div>
        <p className="text-xs font-bold text-muted-foreground">امتیاز سلامت</p>
        {health === null ? (
          <p className="text-sm text-muted-foreground">پس از اجرای بعدی محاسبهٔ روزانه نمایش داده می‌شود.</p>
        ) : (
          <div data-testid="health-score">
            <div className="flex items-center gap-3">
              <b className="text-2xl">{faNum(health)}</b>
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-surface-elevated" role="img" aria-label={`امتیاز سلامت ${faNum(health)} از ۱۰۰`}>
                <div className={`h-full ${tone(health)}`} style={{ width: `${health}%` }} />
              </div>
            </div>
          </div>
        )}
        <p className="text-xs text-muted-foreground">آخرین تماس: {lastContactedAt ? relativeDayFa(lastContactedAt) : 'ثبت نشده'}</p>
      </div>

      <div className="space-y-2">
        <label className="block text-xs font-bold text-muted-foreground" htmlFor="customer-owner">
          مسئول پرونده
        </label>
        <Select
          id="customer-owner"
          value={ownerId ?? ''}
          disabled={pending}
          data-testid="customer-owner-select"
          onChange={(e) =>
            start(async () => {
              const r = await assignCustomerOwnerAction(customerId, e.target.value || null)
              if (!r.ok) return void toast.error(r.error)
              toast.success('مسئول ذخیره شد')
              router.refresh()
            })
          }
        >
          <option value="">بدون مسئول</option>
          {staff.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </Select>
        <ul className="space-y-1 text-sm">
          <li>
            <Link href={`/admin/tasks?scope=all`} className="hover:text-primary" data-testid="health-open-tasks">
              کارهای باز: <b>{faNum(counts.openTasks)}</b>
            </Link>
          </li>
          <li>
            <Link href="/admin/leads?view=list" className="hover:text-primary">
              سرنخ‌های باز: <b>{faNum(counts.openLeads)}</b>
            </Link>
          </li>
          <li>
            <Link href="/admin/messages" className="hover:text-primary">
              پیام‌های باز: <b>{faNum(counts.openTickets)}</b>
            </Link>
          </li>
        </ul>
      </div>

      <form
        className="space-y-2"
        data-testid="quick-note-form"
        onSubmit={(e) => {
          e.preventDefault()
          start(async () => {
            const r = await quickNoteAction(customerId, note)
            if (!r.ok) return void toast.error(r.error)
            toast.success('یادداشت ثبت شد')
            setNote('')
            router.refresh()
          })
        }}
      >
        <label htmlFor="quick-note" className="block text-xs font-bold text-muted-foreground">
          یادداشت سریع
        </label>
        <Textarea id="quick-note" rows={3} value={note} onChange={(e) => setNote(e.target.value)} maxLength={2000} placeholder="مثلاً: تلفنی درخواست نوبت واکسن داد…" data-testid="quick-note-body" />
        <Button type="submit" size="sm" variant="secondary" disabled={pending || !note.trim()} data-testid="quick-note-submit">
          ثبت یادداشت
        </Button>
      </form>
    </section>
  )
}
