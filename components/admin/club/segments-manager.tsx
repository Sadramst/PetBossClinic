'use client'

import { useState } from 'react'
import { Link } from '@/i18n/routing'
import { deleteSegmentAction, pinSegmentAction, saveSegmentAction } from '@/app/actions/admin-club'
import type { SegmentRules } from '@/lib/club/segments'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Field } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { faNum } from '@/components/admin/format'
import { Card, Empty, useAct } from '@/components/admin/club/kit'
import { RulesBuilder, SegmentPreviewBox } from '@/components/admin/club/rules-builder'

interface Row {
  id: string
  name: string
  description: string
  isPinned: boolean
  rules: SegmentRules
  count: number
}

export function SegmentsManager({ segments, tiers }: { segments: Row[]; tiers: { key: string; label: string }[] }) {
  const { run, pending } = useAct()
  const [editing, setEditing] = useState<Row | 'new' | null>(null)
  const [name, setName] = useState('')
  const [desc, setDesc] = useState('')
  const [rules, setRules] = useState<SegmentRules>({})

  const open = (s: Row | 'new') => {
    setEditing(s)
    setName(s === 'new' ? '' : s.name)
    setDesc(s === 'new' ? '' : s.description)
    setRules(s === 'new' ? {} : s.rules)
  }

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-extrabold">گروه‌های مشتریان</h1>
          <p className="mt-1 text-sm text-muted-foreground">مخاطبان هدف را با شرط‌های دقیق (نوع حیوان، برند غذا، آخرین خرید، سطح و ...) ذخیره کنید و در کمپین‌ها استفاده کنید.</p>
        </div>
        <Button variant="gold" size="sm" onClick={() => open('new')} data-testid="segment-new">گروه جدید</Button>
      </div>

      {editing && (
        <Card title={editing === 'new' ? 'گروه جدید' : 'ویرایش گروه'}>
          <div className="space-y-4" data-testid="segment-form">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="نام گروه" required><Input value={name} onChange={(e) => setName(e.target.value)} maxLength={60} data-testid="segment-name" /></Field>
              <Field label="توضیح" optional><Input value={desc} onChange={(e) => setDesc(e.target.value)} maxLength={200} /></Field>
            </div>
            <RulesBuilder value={rules} onChange={setRules} tiers={tiers} />
            <SegmentPreviewBox rules={rules} />
            <p className="text-xs text-muted-foreground">فقط مشتریانی که رضایت دریافت پیامک دارند در کمپین‌ها پیام می‌گیرند؛ این شرط همیشه اعمال می‌شود.</p>
            <div className="flex gap-2">
              <Button
                variant="gold"
                loading={pending}
                onClick={() => run(() => saveSegmentAction(editing === 'new' ? null : editing.id, { name, description: desc, rules }), { ok: 'گروه ذخیره شد', after: () => setEditing(null) })}
                data-testid="segment-save"
              >
                ذخیره گروه
              </Button>
              <Button variant="ghost" onClick={() => setEditing(null)}>انصراف</Button>
            </div>
          </div>
        </Card>
      )}

      {segments.length === 0 ? (
        <Empty>هنوز گروهی نساخته‌اید. مثلاً «صاحبان سگ که ۶۰ روز است خرید نکرده‌اند» را تعریف کنید.</Empty>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3" data-testid="segments-list">
          {segments.map((s) => (
            <li key={s.id} className="flex min-w-0 flex-col rounded-2xl border border-border bg-surface-card p-4">
              <div className="flex items-start justify-between gap-2">
                <h2 className="min-w-0 break-words font-bold">{s.name}</h2>
                {s.isPinned && <Badge tone="gold">سنجاق‌شده</Badge>}
              </div>
              {s.description && <p className="mt-1 text-xs leading-6 text-muted-foreground">{s.description}</p>}
              <p className="mt-2 text-sm"><b className="text-primary">{faNum(s.count)}</b> مشتری با رضایت پیامک</p>
              <div className="mt-auto flex flex-wrap gap-3 pt-3 text-xs">
                <button className="text-primary" onClick={() => open(s)}>ویرایش</button>
                <button disabled={pending} onClick={() => run(() => pinSegmentAction(s.id, !s.isPinned))}>{s.isPinned ? 'برداشتن سنجاق' : 'سنجاق'}</button>
                <Link href={`/admin/campaigns?segment=${s.id}`} className="text-primary">ساخت کمپین</Link>
                <button className="text-red-400" disabled={pending} onClick={() => run(() => deleteSegmentAction(s.id), { confirm: { title: `حذف «${s.name}»؟`, description: 'کمپین‌های قبلی که از این گروه ساخته شده‌اند حفظ می‌شوند.', confirmLabel: 'حذف' }, ok: 'حذف شد' })}>حذف</button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
