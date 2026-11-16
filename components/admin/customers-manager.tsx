'use client'

import { useState, useTransition } from 'react'
import { useRouter } from '@/i18n/routing'
import { setCustomerBlockedAction } from '@/app/actions/admin-orders'

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
                <td className="p-3">
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
