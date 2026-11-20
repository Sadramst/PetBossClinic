'use client'

import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { toast } from '@/components/ui/toaster'
import { Drawer, confirmDialog } from '@/components/admin/kit'
import { adjustBatchAction, createExpiryCouponAction, writeOffBatchAction } from '@/app/actions/inventory'
import { ADJUST_REASONS_FA } from '@/lib/shop/expiry-rules'
import type { BatchRow } from '@/lib/shop/inventory-admin'

const field = 'w-full min-h-11 rounded-xl border border-border bg-input px-3 py-2 text-sm'

/** Row-level actions: adjust with a reason, write off, near-expiry coupon, add a batch for the same product. */
export function BatchActions({ batch, canAdmin, onChanged, onAddFor }: { batch: BatchRow; canAdmin: boolean; onChanged: () => void; onAddFor: (b: BatchRow) => void }) {
  const [open, setOpen] = useState(false)
  const [delta, setDelta] = useState('')
  const [reason, setReason] = useState<keyof typeof ADJUST_REASONS_FA>('COUNT')
  const [note, setNote] = useState('')
  const [pending, start] = useTransition()

  const submitAdjust = () => {
    start(async () => {
      const res = await adjustBatchAction(batch.id, Number(delta), reason, note)
      if (res.error) {
      toast.error(res.error)
      return
    }
      toast.success(res.message ?? 'ثبت شد.')
      setOpen(false)
      setDelta('')
      setNote('')
      onChanged()
    })
  }

  const writeOff = async () => {
    const ok = await confirmDialog({
      title: `امحای ${batch.quantity.toLocaleString('fa-IR')} عدد از «${batch.productName}»؟`,
      description: 'موجودی این بچ صفر می‌شود و زیان آن در گزارش ضایعات ثبت می‌شود. این کار برگشت‌پذیر نیست.',
      confirmLabel: 'امحا کن',
      tone: 'danger',
    })
    if (!ok) return
    start(async () => {
      const res = await writeOffBatchAction(batch.id, 'امحای بچ از برد موجودی')
      if (res.error) {
      toast.error(res.error)
      return
    }
      toast.success(res.message ?? 'انجام شد.')
      onChanged()
    })
  }

  const coupon = () =>
    start(async () => {
      const res = await createExpiryCouponAction(batch.productId, batch.id)
      if (res.error) {
      toast.error(res.error)
      return
    }
      toast.success(res.message ?? 'ساخته شد.')
    })

  const sellable = batch.state === 'critical' || batch.state === 'soon'

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <Button size="sm" variant="secondary" onClick={() => onAddFor(batch)}>
        بچ جدید
      </Button>
      {canAdmin && (
        <>
          <Button size="sm" variant="secondary" data-testid={`batch-adjust-${batch.id}`} onClick={() => setOpen(true)} disabled={pending}>
            تعدیل
          </Button>
          {sellable && (
            <Button size="sm" variant="outline" onClick={coupon} disabled={pending}>
              تخفیف نزدیک انقضا
            </Button>
          )}
          <Button size="sm" variant="dangerOutline" data-testid={`batch-writeoff-${batch.id}`} onClick={writeOff} disabled={pending}>
            امحا
          </Button>
        </>
      )}
      <Drawer
        open={open}
        onOpenChange={setOpen}
        title="تعدیل موجودی بچ"
        description={`«${batch.productName}» · موجودی فعلی ${batch.quantity.toLocaleString('fa-IR')} عدد. برای کم کردن عدد منفی بنویسید.`}
        footer={
          <Button variant="gold" onClick={submitAdjust} disabled={pending || !delta}>
            ثبت تعدیل
          </Button>
        }
      >
        <div className="space-y-4">
          <label className="block text-sm font-bold">
            تغییر (مثلاً ‎-۳ یا ۵)
            <input className={field} dir="ltr" inputMode="numeric" value={delta} onChange={(e) => setDelta(e.target.value.replace(/[^\d-]/g, ''))} />
          </label>
          <label className="block text-sm font-bold">
            دلیل
            <select className={field} value={reason} onChange={(e) => setReason(e.target.value as keyof typeof ADJUST_REASONS_FA)}>
              {Object.entries(ADJUST_REASONS_FA).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm font-bold">
            توضیح {reason === 'OTHER' ? '(الزامی)' : '(اختیاری)'}
            <textarea className={`${field} h-24`} value={note} onChange={(e) => setNote(e.target.value)} />
          </label>
        </div>
      </Drawer>
    </div>
  )
}
