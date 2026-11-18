'use client'

import { useTransition } from 'react'
import { useRouter } from '@/i18n/routing'
import { toast } from '@/components/ui/toaster'
import { confirmDialog } from '@/components/ui/confirm-dialog'
import type { ClubResult } from '@/app/actions/admin-club'

/** Runs a server action, toasts the outcome and refreshes the page data. */
export function useAct() {
  const router = useRouter()
  const [pending, start] = useTransition()
  const run = <T,>(fn: () => Promise<ClubResult<T>>, opts: { ok?: string; confirm?: { title: string; description?: string; confirmLabel?: string }; after?: (r: ClubResult<T>) => void } = {}) =>
    start(async () => {
      if (opts.confirm && !(await confirmDialog({ ...opts.confirm, tone: 'danger' } as never))) return
      let r: ClubResult<T>
      try {
        r = await fn()
      } catch {
        toast.error('خطایی رخ داد', 'دوباره تلاش کنید.')
        return
      }
      if (!r.ok) return void toast.error(r.error ?? 'انجام نشد')
      if (opts.ok) toast.success(opts.ok, r.error)
      opts.after?.(r)
      router.refresh()
    })
  return { run, pending }
}

export function Card({ title, actions, children, className = '' }: { title?: string; actions?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <section className={`min-w-0 rounded-2xl border border-border bg-surface-card ${className}`}>
      {(title || actions) && (
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-3">
          {title && <h2 className="text-sm font-extrabold">{title}</h2>}
          {actions}
        </div>
      )}
      <div className="p-4">{children}</div>
    </section>
  )
}

export function Stat({ label, value, hint, testId }: { label: string; value: string; hint?: string; testId?: string }) {
  return (
    <div className="min-w-0 rounded-2xl border border-border bg-surface-card p-4" data-testid={testId}>
      <div className="text-[11px] font-bold text-muted-foreground">{label}</div>
      <div className="mt-1 break-words text-lg font-black">{value}</div>
      {hint && <div className="mt-0.5 text-[11px] text-muted-foreground">{hint}</div>}
    </div>
  )
}

export function TableWrap({ children }: { children: React.ReactNode }) {
  return <div className="overflow-x-auto rounded-xl border border-border">{children}</div>
}

export const th = 'p-3 text-start text-xs font-bold text-muted-foreground whitespace-nowrap'
export const td = 'p-3 align-top'

export function Empty({ children }: { children: React.ReactNode }) {
  return <p className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">{children}</p>
}

export const TIER_TONE = (color: string) => ({ borderColor: color, color })
