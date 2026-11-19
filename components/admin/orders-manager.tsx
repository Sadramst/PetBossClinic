'use client'

import { useState, useTransition } from 'react'
import { useRouter } from '@/i18n/routing'
import type { OrderStatus, Role } from '@prisma/client'
import { updateOrderAction } from '@/app/actions/admin-orders'
import { allowedNextStatuses } from '@/components/admin/order-status'
import { confirmDialog } from '@/components/ui/confirm-dialog'

export interface AdminOrderRow {
  id: string
  number: string
  status: OrderStatus
  paymentMethod: 'ONLINE' | 'COD'
  total: number
  subtotal: number
  shippingFee: number
  discount: number
  shippingDiscount: number
  couponCode: string | null
  createdAt: string
  paidAt: string | null
  customerName: string
  customerPhone: string
  shipName: string
  shipPhone: string
  shipProvince: string
  shipCity: string
  shipAddress: string
  shipPostal: string
  customerNote: string | null
  adminNote: string | null
  trackingCode: string | null
  refId: string | null
  items: { id: string; nameFa: string; sku: string | null; quantity: number; unitPrice: number; lineTotal: number }[]
}

const STATUS_FA: Record<OrderStatus, string> = {
  PENDING_PAYMENT: 'در انتظار پرداخت',
  PAYMENT_FAILED: 'پرداخت ناموفق',
  CONFIRMED: 'تأییدشده',
  PROCESSING: 'در حال آماده‌سازی',
  SHIPPED: 'ارسال‌شده',
  DELIVERED: 'تحویل‌شده',
  CANCELLED: 'لغوشده',
}
const STATUS_CLS: Partial<Record<OrderStatus, string>> = {
  CONFIRMED: 'bg-sky-500/15 text-sky-300',
  PROCESSING: 'bg-amber-500/15 text-amber-300',
  SHIPPED: 'bg-violet-500/15 text-violet-300',
  DELIVERED: 'bg-emerald-500/15 text-emerald-300',
  CANCELLED: 'bg-red-500/15 text-red-300',
  PAYMENT_FAILED: 'bg-red-500/15 text-red-300',
}
const toman = (n: number) => `${n.toLocaleString('fa-IR')} تومان`

export function OrdersManager({ orders, counts, active, role }: { orders: AdminOrderRow[]; counts: Record<string, number>; active: string; role: Role }) {
  const router = useRouter()
  const [open, setOpen] = useState<string | null>(null)

  const tabs: [string, string][] = [
    ['open', 'نیازمند اقدام'],
    ['all', 'همه'],
    ...(Object.keys(STATUS_FA) as OrderStatus[]).map((s) => [s, STATUS_FA[s]] as [string, string]),
  ]

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold">سفارش‌ها</h1>
        <p className="text-sm text-muted-foreground mt-1">
          «نیازمند اقدام» یعنی سفارش‌های تأییدشده و در حال آماده‌سازی که هنوز ارسال نشده‌اند.
        </p>
      </div>
      <div className="flex flex-wrap gap-1.5 text-sm">
        {tabs.map(([key, label]) => (
          <button
            key={key}
            onClick={() => router.push(`/admin/orders?status=${key}`)}
            className={`px-3 py-1.5 rounded-lg border ${active === key ? 'bg-primary text-charcoal-950 border-primary font-bold' : 'border-border hover:bg-surface-hover'}`}
          >
            {label} {counts[key] != null && <span className="opacity-70">({counts[key].toLocaleString('fa-IR')})</span>}
          </button>
        ))}
      </div>

      <div className="rounded-2xl border border-border bg-surface-card divide-y divide-border">
        {orders.length === 0 && <p className="p-6 text-sm text-muted-foreground">سفارشی وجود ندارد.</p>}
        {orders.map((o) => (
          <div key={o.id}>
            <button onClick={() => setOpen(open === o.id ? null : o.id)} className="w-full p-4 grid grid-cols-2 md:grid-cols-6 gap-2 items-center text-sm text-start hover:bg-surface-hover">
              <span className="font-bold" dir="ltr">{o.number}</span>
              <span className="text-muted-foreground">{o.createdAt}</span>
              <span>{o.customerName}</span>
              <span>{o.paymentMethod === 'COD' ? 'پرداخت در محل' : 'آنلاین'}</span>
              <span className="font-bold">{toman(o.total)}</span>
              <span className={`justify-self-start text-xs rounded-full px-2.5 py-1 ${STATUS_CLS[o.status] ?? 'bg-surface text-muted-foreground'}`}>{STATUS_FA[o.status]}</span>
            </button>
            {open === o.id && <OrderDetail order={o} role={role} onSaved={() => router.refresh()} />}
          </div>
        ))}
      </div>
    </div>
  )
}

function OrderDetail({ order, role, onSaved }: { order: AdminOrderRow; role: Role; onSaved: () => void }) {
  const [status, setStatus] = useState(order.status)
  const [tracking, setTracking] = useState(order.trackingCode ?? '')
  const [note, setNote] = useState(order.adminNote ?? '')
  const [msg, setMsg] = useState<string | null>(null)
  const [pending, start] = useTransition()
  // Only the moves the server accepts for this order and role (same rules as updateOrderAction).
  const options: OrderStatus[] = [order.status, ...allowedNextStatuses(order.status, role)]

  return (
    <div className="px-4 pb-5 grid grid-cols-1 gap-4 lg:grid-cols-3 text-sm">
      <div className="lg:col-span-2 space-y-3">
        <table className="w-full text-xs">
          <thead className="text-muted-foreground">
            <tr><th className="text-start py-1">کالا</th><th className="text-start">کد</th><th>تعداد</th><th className="text-end">جمع</th></tr>
          </thead>
          <tbody>
            {order.items.map((i) => (
              <tr key={i.id} className="border-t border-border">
                <td className="py-1.5">{i.nameFa}</td>
                <td dir="ltr" className="text-start">{i.sku}</td>
                <td className="text-center">{i.quantity.toLocaleString('fa-IR')}</td>
                <td className="text-end">{toman(i.lineTotal)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="text-xs text-muted-foreground">
          کالاها {toman(order.subtotal)}
          {order.discount > 0 && <> − تخفیف {toman(order.discount)}</>} + ارسال {toman(order.shippingFee)}
          {order.shippingDiscount > 0 && <> (ارسال رایگان با کد: {toman(order.shippingDiscount)} تخفیف)</>} = <b className="text-foreground">{toman(order.total)}</b>
          {order.couponCode && <> · کد تخفیف: <span dir="ltr" className="font-mono">{order.couponCode}</span></>}
          {order.refId && <> · کد پیگیری پرداخت: <span dir="ltr">{order.refId}</span></>}
        </p>
        <div className="rounded-xl border border-border p-3 leading-7">
          <b>{order.shipName}</b> · <span dir="ltr">{order.shipPhone}</span>
          <br />
          {order.shipProvince}، {order.shipCity}، {order.shipAddress}
          <br />
          کد پستی: <span dir="ltr">{order.shipPostal}</span> · حساب مشتری: <span dir="ltr">{order.customerPhone}</span>
          {order.customerNote && (
            <>
              <br />
              <span className="text-amber-300">توضیح مشتری: {order.customerNote}</span>
            </>
          )}
        </div>
      </div>
      <div className="space-y-3">
        <label className="block space-y-1">
          <span className="text-xs">وضعیت</span>
          <select value={status} onChange={(e) => setStatus(e.target.value as OrderStatus)} className="w-full rounded-xl border border-border bg-input px-3 py-2">
            {options.map((s) => <option key={s} value={s}>{STATUS_FA[s]}</option>)}
          </select>
        </label>
        <label className="block space-y-1">
          <span className="text-xs">کد رهگیری پست / پیک</span>
          <input value={tracking} onChange={(e) => setTracking(e.target.value)} dir="ltr" className="w-full rounded-xl border border-border bg-input px-3 py-2" />
        </label>
        <label className="block space-y-1">
          <span className="text-xs">یادداشت داخلی</span>
          <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} className="w-full rounded-xl border border-border bg-input px-3 py-2" />
        </label>
        <button
          disabled={pending}
          onClick={() =>
            start(async () => {
              if (status === 'CANCELLED' && order.status !== 'CANCELLED') {
                const ok = await confirmDialog({
                  title: 'سفارش لغو شود؟',
                  description: 'موجودی کالاها به انبار برمی‌گردد و در صورت پرداخت آنلاین باید وجه به مشتری بازگردانده شود.',
                  confirmLabel: 'لغو سفارش',
                  tone: 'danger',
                })
                if (!ok) return
              }
              // An online order with no recorded payment can only be confirmed by staff who have seen the money
              // (e.g. card-to-card, or the ZarinPal panel after a bank timeout).
              const confirmsUnpaid = status === 'CONFIRMED' && order.status !== 'CONFIRMED' && order.paymentMethod === 'ONLINE' && !order.paidAt
              if (confirmsUnpaid) {
                const ok = await confirmDialog({
                  title: 'دریافت وجه تأیید شود؟',
                  description: 'برای این سفارش آنلاین پرداختی ثبت نشده است. فقط اگر وجه را مطمئن دریافت کرده‌اید (مثلاً کارت‌به‌کارت یا در پنل درگاه) تأیید کنید.',
                  confirmLabel: 'وجه دریافت شده است',
                })
                if (!ok) return
              }
              const res = await updateOrderAction(order.id, { status, trackingCode: tracking, adminNote: note, ...(confirmsUnpaid ? { confirmPaid: true } : {}) })
              setMsg(res.error ?? 'ذخیره شد.')
              if (!res.error) onSaved()
            })
          }
          className="w-full h-10 rounded-xl bg-gradient-gold text-charcoal-950 font-bold disabled:opacity-60"
        >
          ذخیره تغییرات
        </button>
        {msg && <p className="text-xs">{msg}</p>}
      </div>
    </div>
  )
}
