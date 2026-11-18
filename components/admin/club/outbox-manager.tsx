'use client'

import { Link } from '@/i18n/routing'
import { cancelMessageAction, processOutboxAction, retryMessageAction } from '@/app/actions/admin-club'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { toast } from '@/components/ui/toaster'
import { faNum } from '@/components/admin/format'
import { Empty, TableWrap, td, th, useAct } from '@/components/admin/club/kit'
import { MESSAGE_STATUS } from '@/components/admin/club/status'

interface Row {
  id: string
  customerId: string | null
  name: string
  phone: string
  kind: string
  status: string
  body: string
  error: string
  attempts: number
  when: string
}

export function OutboxManager({ rows, configured, queued }: { rows: Row[]; configured: boolean; queued: number }) {
  const { run, pending } = useAct()
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">{faNum(queued)} پیام در انتظار ارسال</p>
        <Button
          variant="gold"
          size="sm"
          disabled={pending || queued === 0}
          data-testid="outbox-process"
          onClick={() =>
            run(() => processOutboxAction(), {
              confirm: undefined,
              after: (r) => {
                const d = r.data as { sent: number; failed: number } | undefined
                if (d) toast.success(`${faNum(d.sent)} پیام ارسال شد`, d.failed ? `${faNum(d.failed)} ناموفق` : undefined)
              },
            })
          }
        >
          ارسال صف
        </Button>
      </div>
      {!configured && <p className="text-xs text-amber-400">تا اتصال سرویس پیامک، دکمه‌ی ارسال فقط پیام راهنما نشان می‌دهد.</p>}
      {rows.length === 0 ? (
        <Empty>پیامی با این فیلتر وجود ندارد.</Empty>
      ) : (
        <TableWrap>
          <table className="w-full min-w-[44rem] text-sm" data-testid="outbox-table">
            <thead><tr className="border-b border-border">{['مشتری', 'نوع', 'وضعیت', 'زمان', 'پیام', ''].map((h) => <th key={h} className={th}>{h}</th>)}</tr></thead>
            <tbody className="divide-y divide-border">
              {rows.map((m) => (
                <tr key={m.id} data-testid="outbox-row">
                  <td className={td}>
                    {m.customerId ? <Link href={`/admin/customers/${m.customerId}`} className="font-bold text-primary hover:underline">{m.name}</Link> : '—'}
                    <div dir="ltr" className="text-start text-xs text-muted-foreground">{m.phone}</div>
                  </td>
                  <td className={td}>{m.kind}</td>
                  <td className={td}>
                    <Badge tone={MESSAGE_STATUS[m.status]?.tone ?? 'neutral'}>{MESSAGE_STATUS[m.status]?.label ?? m.status}</Badge>
                    {m.attempts > 0 && <div className="mt-1 text-[11px] text-muted-foreground">{faNum(m.attempts)} تلاش</div>}
                  </td>
                  <td className={`${td} whitespace-nowrap`}>{m.when}</td>
                  <td className={`${td} max-w-sm`}>
                    <p className="line-clamp-3 break-words leading-6">{m.body}</p>
                    {m.error && <p className="mt-1 text-xs text-red-400">{m.error}</p>}
                  </td>
                  <td className={`${td} whitespace-nowrap`}>
                    {m.status === 'FAILED' && <button className="me-3 text-xs text-primary" disabled={pending} onClick={() => run(() => retryMessageAction(m.id), { ok: 'دوباره در صف قرار گرفت' })}>تلاش مجدد</button>}
                    {m.status === 'QUEUED' && <button className="text-xs text-red-400" disabled={pending} onClick={() => run(() => cancelMessageAction(m.id), { confirm: { title: 'لغو این پیام؟', confirmLabel: 'لغو پیام' }, ok: 'لغو شد' })}>لغو</button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableWrap>
      )}
    </div>
  )
}
