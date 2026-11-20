'use client'

import { useCallback, useEffect, useState, useTransition } from 'react'
import { listViewsAction, saveViewAction, deleteViewAction } from '@/app/actions/crm-data'
import type { SavedViewEntity, SavedViewRow } from '@/lib/crm/views'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { toast } from '@/components/ui/toaster'
import { confirmDialog } from '@/components/ui/confirm-dialog'

export interface SavedViewsProps {
  entity: SavedViewEntity
  /** The filters currently applied (only non-empty keys are saved). */
  current: Record<string, string>
  /** Called with the saved filters; the caller patches the URL. */
  onApply: (filters: Record<string, string>) => void
  /** Only admins may share a view with the team. */
  canShare?: boolean
}

function toStrings(raw: unknown): Record<string, string> {
  const out: Record<string, string> = {}
  if (raw && typeof raw === 'object') {
    for (const [k, v] of Object.entries(raw as Record<string, unknown>)) if (typeof v === 'string' || typeof v === 'number') out[k] = String(v)
  }
  return out
}

/** Dropdown of saved filter sets plus a small save form. Passed to FilterBar as `views`. */
export function SavedViews({ entity, current, onApply, canShare = false }: SavedViewsProps) {
  const [views, setViews] = useState<SavedViewRow[]>([])
  const [saving, setSaving] = useState(false)
  const [name, setName] = useState('')
  const [shared, setShared] = useState(false)
  const [pending, start] = useTransition()

  const load = useCallback(async () => {
    const r = await listViewsAction(entity)
    if (r.ok) setViews(r.data)
  }, [entity])

  useEffect(() => {
    void load()
  }, [load])

  const hasFilters = Object.values(current).some((v) => v)

  function save() {
    const clean = Object.fromEntries(Object.entries(current).filter(([, v]) => v))
    start(async () => {
      const r = await saveViewAction({ entity, name, filters: clean, shared: canShare && shared })
      if (!r.ok) return void toast.error(r.error)
      toast.success('نما ذخیره شد')
      setSaving(false)
      setName('')
      setShared(false)
      await load()
    })
  }

  async function remove(v: SavedViewRow) {
    if (!(await confirmDialog({ title: `نمای «${v.name}» حذف شود؟`, confirmLabel: 'حذف' }))) return
    const r = await deleteViewAction(v.id)
    if (!r.ok) return void toast.error(r.error)
    await load()
  }

  return (
    <div className="flex flex-wrap items-center gap-2" data-testid="saved-views">
      <label className="sr-only" htmlFor={`saved-view-${entity}`}>
        نماهای ذخیره‌شده
      </label>
      <select
        id={`saved-view-${entity}`}
        className="field field-sm min-w-[9rem]"
        value=""
        onChange={(e) => {
          const v = views.find((x) => x.id === e.target.value)
          if (v) onApply(toStrings(v.filters))
        }}
        data-testid="saved-view-select"
      >
        <option value="">{views.length ? 'نماهای ذخیره‌شده' : 'نمایی ذخیره نشده'}</option>
        {views.map((v) => (
          <option key={v.id} value={v.id}>
            {v.name}
            {v.shared ? ' (مشترک)' : ''}
          </option>
        ))}
      </select>
      {views.some((v) => v.mine || canShare) && (
        <select
          aria-label="حذف نما"
          className="field field-sm w-24"
          value=""
          onChange={(e) => {
            const v = views.find((x) => x.id === e.target.value)
            if (v) void remove(v)
          }}
          data-testid="saved-view-delete"
        >
          <option value="">حذف نما</option>
          {views
            .filter((v) => v.mine || canShare)
            .map((v) => (
              <option key={v.id} value={v.id}>
                {v.name}
              </option>
            ))}
        </select>
      )}
      {saving ? (
        <span className="flex flex-wrap items-center gap-2">
          <Input
            controlSize="sm"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="نام نما"
            maxLength={60}
            aria-label="نام نما"
            data-testid="saved-view-name"
          />
          {canShare && (
            <label className="flex items-center gap-1.5 text-xs font-bold text-muted-foreground">
              <input type="checkbox" checked={shared} onChange={(e) => setShared(e.target.checked)} />
              مشترک با تیم
            </label>
          )}
          <Button size="sm" variant="gold" disabled={pending || !name.trim()} onClick={save} data-testid="saved-view-save-confirm">
            ذخیره
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setSaving(false)}>
            انصراف
          </Button>
        </span>
      ) : (
        <Button size="sm" variant="secondary" disabled={!hasFilters} onClick={() => setSaving(true)} data-testid="saved-view-save">
          ذخیره این نما
        </Button>
      )}
    </div>
  )
}
