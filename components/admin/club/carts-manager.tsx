'use client'

import { useState } from 'react'
import { Link } from '@/i18n/routing'
import { sendCartReminderAction } from '@/app/actions/admin-club'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { faNum, toman } from '@/components/admin/format'
import { Card, Empty, TableWrap, td, th, useAct } from '@/components/admin/club/kit'

interface CartRow {
  customerId: string
  name: string
  phone: string
  consent: boolean
  items: { name: string; quantity: number }[]
  itemCount: number
  subtotal: number
  idle: string
  reminded: string | null
}

export function CartsManager({ carts, top, abandoned, idleHours, total }: { carts: CartRow[]; top: { productId: string; name: string; quantity: number; carts: number }[]; abandoned: boolean; idleHours: number; total: number }) {
  const { run, pending } = useAct()
  const [pct, setPct] = useState('10')
  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-extrabold">سبدهای خرید مشتریان</h1>
          <p className="mt-1 text-sm text-muted-foreground">آنچه مشتریان وارد شده به سبد می‌گذارند؛ سبدهای رهاشده فرصت فروش‌اند. {faNum(total)} سبد.</p>
        </div>
        <div className="flex gap-2">
          <Link href="/admin/carts" className={`btn btn-sm ${abandoned ? 'btn-gold' : 'btn-ghost'}`}>رهاشده (بیش از {faNum(idleHours)} ساعت)</Link>
          <Link href="/admin/carts?view=all" className={`btn btn-sm ${!abandoned ? 'btn-gold' : 'btn-ghost'}`}>همه سبدها</Link>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="min-w-0 space-y-3">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <label htmlFor="remind-pct" className="font-bold">تخفیف یادآوری (٪)</label>
            <Input id="remind-pct" className="w-24" inputMode="numeric" value={pct} onChange={(e) => setPct(e.target.value)} />
            <span className="text-xs text-muted-foreground">۰ = بدون کد. فقط به مشتریان با رضایت پیامک ارسال می‌شود.</span>
          </div>
          {carts.length === 0 ? (
            <Empty>سبد {abandoned ? 'رهاشده‌ای' : 'فعالی'} وجود ندارد.</Empty>
          ) : (
            <TableWrap>
              <table className="w-full min-w-[42rem] text-sm" data-testid="carts-table">
                <thead><tr className="border-b border-border">{['مشتری', 'اقلام', 'جمع', 'بی‌حرکت', ''].map((h) => <th key={h} className={th}>{h}</th>)}</tr></thead>
                <tbody className="divide-y divide-border">
                  {carts.map((c) => (
                    <tr key={c.customerId} data-testid="cart-row">
                      <td className={td}>
                        <Link href={`/admin/customers/${c.customerId}`} className="font-bold text-primary hover:underline">{c.name}</Link>
                        <div dir="ltr" className="text-start text-xs text-muted-foreground">{c.phone}</div>
                        {!c.consent && <Badge tone="neutral" size="sm">بدون رضایت پیامک</Badge>}
                      </td>
                      <td className={td}>
                        {c.items.slice(0, 3).map((i, k) => <div key={k} className="text-xs">{i.name} × {faNum(i.quantity)}</div>)}
                        {c.items.length > 3 && <div className="text-xs text-muted-foreground">و {faNum(c.items.length - 3)} قلم دیگر</div>}
                      </td>
                      <td className={`${td} whitespace-nowrap`}>{toman(c.subtotal)}</td>
                      <td className={td}>{c.idle}{c.reminded && <div className="text-[11px] text-muted-foreground">یادآوری: {c.reminded}</div>}</td>
                      <td className={td}>
                        <Button size="sm" variant="outline" disabled={pending || !c.consent} onClick={() => run(() => sendCartReminderAction(c.customerId, Number(pct)), { ok: 'یادآوری در صف قرار گرفت' })} data-testid="cart-remind">
                          ارسال یادآوری با کد تخفیف
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableWrap>
          )}
        </div>
        <Card title="پرتکرارترین محصولات در سبدها">
          {top.length === 0 ? <Empty>سبدی ثبت نشده است.</Empty> : (
            <ol className="space-y-2 text-sm" data-testid="top-carted">
              {top.map((t) => <li key={t.productId} className="flex justify-between gap-2"><span className="min-w-0 truncate">{t.name}</span><span className="shrink-0 text-xs text-muted-foreground">{faNum(t.quantity)} عدد · {faNum(t.carts)} سبد</span></li>)}
            </ol>
          )}
        </Card>
      </div>
    </div>
  )
}
