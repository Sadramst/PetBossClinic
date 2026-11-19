'use client'

import { useState } from 'react'
import { dryRunAutomationAction, saveAutomationAction } from '@/app/actions/admin-club'
import type { AutomationRun } from '@/lib/club/automations'
import { TEMPLATE_VAR_HELP } from '@/lib/club/messaging/render'
import { SKIP_REASON_LABEL } from '@/lib/club/messaging/rules'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Field } from '@/components/ui/field'
import { Input, Select, Textarea } from '@/components/ui/input'
import { toast } from '@/components/ui/toaster'
import { faNum } from '@/components/admin/format'
import { Card, useAct } from '@/components/admin/club/kit'

interface RuleView {
  kind: string
  label: string
  description: string
  enabled: boolean
  params: Record<string, number>
  paramLabels: Record<string, string>
  body: string
  coupon: { type: string; value: number; maxDiscount?: number | null; minSubtotal?: number; validDays: number; restrictToPetBrand?: boolean } | null
  lastRun: string | null
  queued7d: number
  sent7d: number
}

export function AutomationsManager({ rules }: { rules: RuleView[] }) {
  return (
    <div className="space-y-4" data-testid="automations-list">
      {rules.map((r) => <RuleCard key={r.kind} rule={r} />)}
    </div>
  )
}

function RuleCard({ rule }: { rule: RuleView }) {
  const { run, pending } = useAct()
  const [enabled, setEnabled] = useState(rule.enabled)
  const [params, setParams] = useState(rule.params)
  const [body, setBody] = useState(rule.body)
  const [coupon, setCoupon] = useState(rule.coupon)
  const [dry, setDry] = useState<AutomationRun | null>(null)
  const [dryBusy, setDryBusy] = useState(false)

  const patch = (over: Record<string, unknown> = {}) => ({ enabled, params, bodyTemplate: body, couponTemplate: coupon, ...over })

  const dryRun = async () => {
    setDryBusy(true)
    const r = await dryRunAutomationAction(rule.kind).catch(() => null)
    setDryBusy(false)
    if (!r?.ok || !r.data) return void toast.error(r?.error ?? 'اجرای آزمایشی انجام نشد')
    setDry(r.data)
  }

  return (
    <Card
      title={rule.label}
      actions={
        <label className="flex items-center gap-2 text-xs font-bold">
          <input
            type="checkbox"
            checked={enabled}
            disabled={pending}
            data-testid={`automation-toggle-${rule.kind}`}
            className="h-5 w-5 accent-[var(--color-primary,#c9a45c)]"
            onChange={(e) => {
              const next = e.target.checked
              setEnabled(next)
              run(() => saveAutomationAction(rule.kind, patch({ enabled: next })), { ok: next ? 'قانون روشن شد' : 'قانون خاموش شد' })
            }}
          />
          {enabled ? <Badge tone="success">روشن</Badge> : <Badge tone="neutral">خاموش</Badge>}
        </label>
      }
    >
      <p className="text-sm leading-7 text-muted-foreground">{rule.description}</p>
      <p className="mt-1 text-xs text-muted-foreground">
        {rule.lastRun ? `آخرین پیام در صف: ${rule.lastRun}` : 'هنوز اجرا نشده'} · هفت روز اخیر: {faNum(rule.queued7d)} در صف، {faNum(rule.sent7d)} ارسال‌شده
      </p>

      {Object.keys(rule.paramLabels).length > 0 && (
        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Object.entries(rule.paramLabels).map(([k, l]) => (
            <Field key={k} label={l}><Input inputMode="numeric" value={params[k] ?? ''} onChange={(e) => setParams({ ...params, [k]: Number(e.target.value) || 0 })} /></Field>
          ))}
        </div>
      )}

      <div className="mt-3 space-y-2">
        <Field label="متن پیام"><Textarea value={body} onChange={(e) => setBody(e.target.value)} rows={3} maxLength={500} /></Field>
        <div className="flex flex-wrap gap-1.5" aria-label="متغیرها">
          {Object.entries(TEMPLATE_VAR_HELP).map(([k, l]) => (
            <button key={k} type="button" title={l} onClick={() => setBody((b) => `${b} {${k}}`)} className="min-h-8 rounded-full border border-border bg-surface-elevated px-2.5 text-xs hover:border-primary">{`{${k}}`}</button>
          ))}
        </div>
      </div>

      <div className="mt-3">
        <label className="flex items-center gap-2 text-sm font-bold">
          <input type="checkbox" className="h-4 w-4 accent-[var(--color-primary,#c9a45c)]" checked={!!coupon} onChange={(e) => setCoupon(e.target.checked ? { type: 'PERCENT', value: 10, maxDiscount: 150000, minSubtotal: 0, validDays: 14, restrictToPetBrand: false } : null)} /> همراه پیام یک کد تخفیف شخصی ساخته شود
        </label>
        {coupon && (
          <div className="mt-2 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Field label="نوع"><Select value={coupon.type} onChange={(e) => setCoupon({ ...coupon, type: e.target.value })}><option value="PERCENT">درصدی</option><option value="FIXED">مبلغ ثابت</option><option value="FREE_SHIPPING">ارسال رایگان</option></Select></Field>
            {coupon.type !== 'FREE_SHIPPING' && <Field label={coupon.type === 'PERCENT' ? 'درصد' : 'مبلغ'}><Input inputMode="numeric" value={coupon.value} onChange={(e) => setCoupon({ ...coupon, value: Number(e.target.value) || 0 })} /></Field>}
            <Field label="اعتبار (روز)"><Input inputMode="numeric" value={coupon.validDays} onChange={(e) => setCoupon({ ...coupon, validDays: Number(e.target.value) || 1 })} /></Field>
            <label className="flex items-center gap-2 self-end pb-3 text-sm"><input type="checkbox" className="h-4 w-4 accent-[var(--color-primary,#c9a45c)]" checked={!!coupon.restrictToPetBrand} onChange={(e) => setCoupon({ ...coupon, restrictToPetBrand: e.target.checked })} /> محدود به برند غذای حیوان</label>
          </div>
        )}
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <Button variant="gold" size="sm" loading={pending} onClick={() => run(() => saveAutomationAction(rule.kind, patch()), { ok: 'قانون ذخیره شد' })} data-testid={`automation-save-${rule.kind}`}>ذخیره</Button>
        <Button variant="outline" size="sm" loading={dryBusy} onClick={dryRun} data-testid={`automation-dry-${rule.kind}`}>اجرای آزمایشی</Button>
      </div>

      {dry && (
        <div className="mt-4 rounded-xl border border-border bg-surface p-3" data-testid="dry-result">
          <p className="text-sm font-bold">{faNum(dry.candidates)} مشتری مناسب پیدا شد؛ در اجرای آزمایشی هیچ پیامی ارسال نشد.</p>
          {Object.keys(dry.skipped).length > 0 && <p className="mt-1 text-xs text-muted-foreground">ردشده‌ها: {Object.entries(dry.skipped).map(([k, n]) => `${SKIP_REASON_LABEL[k] ?? k} (${faNum(n)})`).join('، ')}</p>}
          <ul className="mt-2 space-y-2">
            {dry.preview.map((p, i) => (
              <li key={i} className="rounded-lg border border-border p-2 text-xs leading-6">
                <b>{p.name}</b> <span dir="ltr">{p.phone}</span>
                <p className="mt-0.5 whitespace-pre-wrap break-words text-muted-foreground">{p.text}</p>
                {p.wouldSkip && <p className="text-amber-400">ارسال نمی‌شود: {SKIP_REASON_LABEL[p.wouldSkip] ?? p.wouldSkip}</p>}
              </li>
            ))}
          </ul>
        </div>
      )}
    </Card>
  )
}
