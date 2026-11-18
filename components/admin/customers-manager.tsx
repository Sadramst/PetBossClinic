'use client'

import { useState, useTransition } from 'react'
import { useRouter } from '@/i18n/routing'
import { resetCustomerPasswordAction, setCustomerBlockedAction } from '@/app/actions/admin-orders'
import { Alert } from '@/components/ui/alert'
import { confirmDialog } from '@/components/ui/confirm-dialog'
import { toast } from '@/components/ui/toaster'

export interface AdminCustomerRow {
  id: string
  name: string
  phone: string
  email: string | null
  joined: string
  lastLogin: string | null
  orders: number
  spent: number
  isBlocked: boolean
}

export function CustomersManager({ customers, query }: { customers: AdminCustomerRow[]; query: string }) {
  const router = useRouter()
  const [q, setQ] = useState(query)
  const [pending, start] = useTransition()
  // Shown once, right after a reset; leaves the screen on reload and is never stored.
  const [temp, setTemp] = useState<{ name: string; phone: string; password: string } | null>(null)

  const resetPassword = (c: AdminCustomerRow) =>
    start(async () => {
      const ok = await confirmDialog({
        title: `رمز موقت برای ${c.name}؟`,
        description:
          'یک رمز عبور موقت ساخته می‌شود و مشتری از همه دستگاه‌ها خارج می‌شود. فقط پس از تماس تلفنی و اطمینان از هویت مشتری، رمز را به او اطلاع دهید.',
        confirmLabel: 'ساخت رمز موقت',
      })
      if (!ok) return
      const res = await resetCustomerPasswordAction(c.id)
      if (res.error || !res.password) {
        toast.error('بازنشانی انجام نشد', res.error)
        return
      }
      setTemp({ name: c.name, phone: c.phone, password: res.password })
    })

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold">مشتریان فروشگاه</h1>
          <p className="text-sm text-muted-foreground mt-1">مشتریانی که با شماره موبایل در سایت ثبت‌نام کرده‌اند.</p>
        </div>
        <form onSubmit={(e) => (e.preventDefault(), router.push(`/admin/customers?q=${encodeURIComponent(q)}`))}>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="جستجوی نام یا موبایل" className="rounded-xl border border-border bg-input px-3 py-2 text-sm" />
        </form>
      </div>

      {temp && (
        <Alert tone="warning" title={`رمز موقت ${temp.name} (${temp.phone})`}>
          <p className="leading-7">
            این رمز فقط همین یک بار نمایش داده می‌شود. آن را تلفنی به مشتری بدهید و بگویید پس از ورود، از «اطلاعات حساب» رمز جدید
            بسازد.
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <code dir="ltr" className="rounded-lg bg-surface px-3 py-2 text-base font-bold tracking-wider text-primary">
              {temp.password}
            </code>
            <button
              type="button"
              className="text-xs font-bold text-primary"
              onClick={() => navigator.clipboard?.writeText(temp.password).then(() => toast.success('کپی شد'))}
            >
              کپی
            </button>
            <button type="button" className="text-xs text-muted-foreground" onClick={() => setTemp(null)}>
              بستن
            </button>
          </div>
        </Alert>
      )}

      <div className="overflow-x-auto rounded-2xl border border-border bg-surface-card">
        <table className="w-full text-sm">
          <thead className="text-xs text-muted-foreground">
            <tr className="border-b border-border">
              {['نام', 'موبایل', 'عضویت', 'آخرین ورود', 'سفارش', 'مجموع خرید', ''].map((h) => (
                <th key={h} className="p-3 text-start">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {customers.length === 0 && (
              <tr><td colSpan={7} className="p-4 text-muted-foreground">مشتری‌ای پیدا نشد.</td></tr>
            )}
            {customers.map((c) => (
              <tr key={c.id} className={c.isBlocked ? 'opacity-60' : ''}>
                <td className="p-3">{c.name}</td>
                <td className="p-3" dir="ltr">{c.phone}</td>
                <td className="p-3">{c.joined}</td>
                <td className="p-3">{c.lastLogin ?? '—'}</td>
                <td className="p-3">{c.orders.toLocaleString('fa-IR')}</td>
                <td className="p-3">{c.spent.toLocaleString('fa-IR')} تومان</td>
                <td className="p-3 whitespace-nowrap">
                  <button disabled={pending} onClick={() => resetPassword(c)} className="me-4 text-xs text-primary">
                    رمز موقت
                  </button>
                  <button
                    disabled={pending}
                    onClick={() => start(async () => (await setCustomerBlockedAction(c.id, !c.isBlocked), router.refresh()))}
                    className={`text-xs ${c.isBlocked ? 'text-emerald-400' : 'text-red-400'}`}
                  >
                    {c.isBlocked ? 'فعال‌سازی' : 'مسدود کردن'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
