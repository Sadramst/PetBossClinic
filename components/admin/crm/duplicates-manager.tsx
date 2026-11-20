'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Link } from '@/i18n/routing'
import { Drawer, EmptyState, PageHeader, StatusBadge } from '@/components/admin/kit'
import { Button } from '@/components/ui/button'
import { toast } from '@/components/ui/toaster'
import { confirmDialog } from '@/components/ui/confirm-dialog'
import { findDuplicatesAction, mergeCustomersAction } from '@/app/actions/crm-data'
import type { CustomerBrief, DuplicateCandidate, DuplicateReason } from '@/lib/crm/dedupe'
import type { MergeReport } from '@/lib/crm/merge'
import { faNum } from '@/lib/crm/labels'
import { toman, formatJalaliDateTime } from '@/components/admin/format'
import { cn } from '@/lib/utils'

export const REASON_FA: Record<DuplicateReason, string> = { PHONE: 'شمارهٔ یکسان', EMAIL: 'ایمیل یکسان', NAME_PET: 'نام و حیوان مشابه' }

export const MOVED_FA: Record<string, string> = {
  addresses: 'آدرس',
  orders: 'سفارش',
  pets: 'حیوان خانگی',
  visits: 'مراجعهٔ کلینیک',
  rewardRedemptions: 'استفاده از جایزه',
  notes: 'یادداشت',
  messageOutbox: 'پیامک ارسالی',
  coupons: 'کوپن',
  couponRedemptions: 'استفاده از کوپن',
  marketingContacts: 'مخاطب بازاریابی',
  leads: 'سرنخ',
  messages: 'پیام پشتیبانی',
  tasks: 'کار',
  activities: 'رویداد تاریخچه',
  pointsTransactions: 'تراکنش امتیاز',
}

/** Persian summary lines for a merge report: only the tables that actually move rows. */
export function movedLines(moved: Record<string, number>): string[] {
  return Object.entries(moved)
    .filter(([, n]) => n > 0)
    .map(([k, n]) => `${faNum(n)} ${MOVED_FA[k] ?? k}`)
}

function BriefCard({ c, role, picked, onPick }: { c: CustomerBrief; role: 'A' | 'B'; picked: boolean; onPick: () => void }) {
  return (
    <label className={cn('block cursor-pointer rounded-2xl border p-3 text-sm', picked ? 'border-primary bg-primary/5' : 'border-border')} data-testid={`merge-pick-${role}`}>
      <span className="flex items-center gap-2">
        <input type="radio" name="survivor" checked={picked} onChange={onPick} />
        <span className="font-extrabold">{c.name || '—'}</span>
        {picked && <StatusBadge tone="gold" dot={false}>مشتری باقی‌مانده</StatusBadge>}
      </span>
      <span dir="ltr" className="mt-1 block text-start text-xs">{c.phone}</span>
      {c.email && <span dir="ltr" className="block text-start text-xs text-muted-foreground">{c.email}</span>}
      <span className="mt-2 block text-xs text-muted-foreground">
        {faNum(c.ordersCount)} سفارش · {toman(c.totalSpent)} · {faNum(c.pointsBalance)} امتیاز
      </span>
      {c.petNames.length > 0 && <span className="block text-xs text-muted-foreground">حیوانات: {c.petNames.join('، ')}</span>}
      <span className="block text-[11px] text-muted-foreground">عضویت: {formatJalaliDateTime(c.createdAt)}</span>
      <Link href={`/admin/customers/${c.id}`} className="mt-1 inline-block text-xs font-bold text-primary hover:underline" target="_blank">
        مشاهدهٔ پرونده
      </Link>
    </label>
  )
}

export interface DuplicatesManagerProps {
  initial: DuplicateCandidate[]
  isAdmin: boolean
}

/** Candidate pairs and the merge wizard: pick the survivor, review an exact dry-run, confirm. */
export function DuplicatesManager({ initial, isAdmin }: DuplicatesManagerProps) {
  const router = useRouter()
  const [pairs, setPairs] = useState(initial)
  const [active, setActive] = useState<DuplicateCandidate | null>(null)
  const [survivor, setSurvivor] = useState<'A' | 'B'>('A')
  const [report, setReport] = useState<MergeReport | null>(null)
  const [pending, start] = useTransition()

  const key = (p: DuplicateCandidate) => `${p.a.id}:${p.b.id}`

  function open(p: DuplicateCandidate) {
    setActive(p)
    setSurvivor(p.a.ordersCount >= p.b.ordersCount ? 'A' : 'B')
    setReport(null)
  }

  const ids = active ? (survivor === 'A' ? { s: active.a.id, l: active.b.id } : { s: active.b.id, l: active.a.id }) : null

  function preview(next: 'A' | 'B' = survivor) {
    if (!active) return
    const s = next === 'A' ? active.a.id : active.b.id
    const l = next === 'A' ? active.b.id : active.a.id
    start(async () => {
      const r = await mergeCustomersAction(s, l, true)
      if (!r.ok) return void toast.error(r.error)
      setReport(r.data)
    })
  }

  async function commit() {
    if (!ids || !active) return
    const ok = await confirmDialog({
      title: 'این دو پرونده ادغام شوند؟',
      description: 'اطلاعات پروندهٔ دوم به پروندهٔ اول منتقل می‌شود و پروندهٔ دوم مسدود می‌ماند. این کار برگشت‌پذیر نیست.',
      confirmLabel: 'ادغام',
    })
    if (!ok) return
    start(async () => {
      const r = await mergeCustomersAction(ids.s, ids.l, false)
      if (!r.ok) return void toast.error(r.error)
      toast.success('پرونده‌ها ادغام شدند')
      setPairs((ps) => ps.filter((p) => ![p.a.id, p.b.id].some((x) => x === ids.l)))
      setActive(null)
      router.refresh()
    })
  }

  function refresh() {
    start(async () => {
      const r = await findDuplicatesAction()
      if (!r.ok) return void toast.error(r.error)
      setPairs(r.data)
    })
  }

  return (
    <div className="space-y-5" data-testid="duplicates-page">
      <PageHeader
        title="مشتریان تکراری"
        subtitle="پرونده‌هایی که شماره، ایمیل یا نام و حیوان مشابه دارند. پیش از ادغام، یک پیش‌نمایش دقیق می‌بینید."
        breadcrumbs={[{ label: 'مشتریان', href: '/admin/customers' }, { label: 'تکراری‌ها' }]}
        actions={
          <Button variant="secondary" size="sm" onClick={refresh} disabled={pending} data-testid="duplicates-refresh">
            بررسی دوباره
          </Button>
        }
      />

      {pairs.length === 0 ? (
        <EmptyState title="مورد تکراری پیدا نشد" description="هر هفته یک بار این صفحه را بررسی کنید؛ ورود فایل مشتری یا ثبت‌نام‌های دستی ممکن است تکراری بسازد." />
      ) : (
        <ul className="space-y-3" data-testid="duplicates-list">
          {pairs.map((p) => (
            <li key={key(p)} data-testid="duplicates-row" className="rounded-2xl border border-border bg-surface p-4">
              <div className="flex flex-wrap items-center gap-2">
                {p.reasons.map((r) => (
                  <StatusBadge key={r} tone={r === 'NAME_PET' ? 'warning' : 'info'}>
                    {REASON_FA[r]}
                  </StatusBadge>
                ))}
                <span className="text-xs text-muted-foreground">شباهت {faNum(Math.round(p.score))}٪</span>
              </div>
              <div className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
                {[p.a, p.b].map((c) => (
                  <div key={c.id} className="rounded-xl bg-background p-3">
                    <p className="font-bold">{c.name || '—'}</p>
                    <p dir="ltr" className="text-start text-xs text-muted-foreground">{c.phone}</p>
                    <p className="text-xs text-muted-foreground">{faNum(c.ordersCount)} سفارش</p>
                  </div>
                ))}
              </div>
              <div className="mt-3 flex gap-2">
                <Button size="sm" variant="gold" onClick={() => open(p)} data-testid="merge-open">
                  بررسی و ادغام
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <Drawer open={!!active} onOpenChange={(o) => !o && setActive(null)} title="ادغام دو پرونده" description="پروندهٔ باقی‌مانده را انتخاب کنید؛ همهٔ اطلاعات پروندهٔ دیگر به آن منتقل می‌شود.">
        {active && (
          <div className="space-y-4" data-testid="merge-wizard">
            <div className="grid gap-3">
              <BriefCard c={active.a} role="A" picked={survivor === 'A'} onPick={() => { setSurvivor('A'); setReport(null) }} />
              <BriefCard c={active.b} role="B" picked={survivor === 'B'} onPick={() => { setSurvivor('B'); setReport(null) }} />
            </div>

            {!report ? (
              <Button variant="secondary" disabled={pending} onClick={() => preview()} data-testid="merge-preview">
                پیش‌نمایش ادغام
              </Button>
            ) : (
              <div className="rounded-2xl border border-border-gold p-4 text-sm" data-testid="merge-report">
                <p className="mb-2 font-extrabold">نتیجهٔ ادغام (هنوز انجام نشده)</p>
                <ul className="list-disc space-y-1 ps-5 leading-7">
                  {movedLines(report.moved).map((l) => (
                    <li key={l}>{l} منتقل می‌شود</li>
                  ))}
                  {report.filledFields.length > 0 && <li>فیلدهای خالی از پروندهٔ دیگر پر می‌شود: {report.filledFields.join('، ')}</li>}
                  {report.tagsAdded.length > 0 && <li>برچسب‌های اضافه: {report.tagsAdded.join('، ')}</li>}
                  {report.pointsRefsRenamed > 0 && <li>{faNum(report.pointsRefsRenamed)} مرجع امتیاز هم‌نام اصلاح می‌شود</li>}
                  <li>
                    امتیاز نهایی {faNum(report.pointsBalance)} · {faNum(report.ordersCount)} سفارش · {toman(report.totalSpent)}
                  </li>
                </ul>
                {isAdmin ? (
                  <Button className="mt-4" variant="danger" disabled={pending} onClick={commit} data-testid="merge-confirm">
                    ادغام نهایی
                  </Button>
                ) : (
                  <p className="mt-3 text-xs text-muted-foreground">ادغام نهایی فقط برای مدیر فعال است.</p>
                )}
              </div>
            )}
          </div>
        )}
      </Drawer>
    </div>
  )
}
