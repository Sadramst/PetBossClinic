'use client'

import { useEffect, useState, useTransition } from 'react'
import type { TaskType } from '@prisma/client'
import { Drawer, JalaliDateField } from '@/components/admin/kit'
import { Button } from '@/components/ui/button'
import { Input, Select, Textarea } from '@/components/ui/input'
import { Field } from '@/components/ui/field'
import { toast } from '@/components/ui/toaster'
import { createTaskAction, updateTaskAction } from '@/app/actions/crm-tasks'
import { TASK_PRIORITY_LABEL, TASK_TYPE_LABEL, isoDayOffset } from '@/lib/crm/labels'

export type TaskView = {
  id: string
  title: string
  type: TaskType
  status: 'OPEN' | 'IN_PROGRESS' | 'DONE' | 'CANCELLED'
  priority: number
  dueAt: string | null
  ownerId: string | null
  customerId: string | null
  leadId: string | null
  ticketId: string | null
  system: boolean
  note: string | null
  overdue: boolean
  customerName: string | null
  leadName: string | null
}

export interface TaskDialogProps {
  open: boolean
  /** Editing when set, creating otherwise. */
  task: TaskView | null
  staff: { id: string; name: string }[]
  /** Prefill when created from a customer, lead or ticket. */
  defaults?: { customerId?: string; leadId?: string; ticketId?: string; title?: string }
  currentUserId: string
  onClose: () => void
  onSaved: () => void
}

/** Create or edit a task. System tasks keep their title and type (the server refuses changes). */
export function TaskDialog({ open, task, staff, defaults, currentUserId, onClose, onSaved }: TaskDialogProps) {
  const [pending, start] = useTransition()
  const [title, setTitle] = useState('')
  const [type, setType] = useState<TaskType>('FOLLOW_UP')
  const [priority, setPriority] = useState(2)
  const [dueAt, setDueAt] = useState<string | null>(null)
  const [ownerId, setOwnerId] = useState('')
  const [note, setNote] = useState('')

  useEffect(() => {
    if (!open) return
    setTitle(task?.title ?? defaults?.title ?? '')
    setType(task?.type ?? 'FOLLOW_UP')
    setPriority(task?.priority ?? 2)
    setDueAt(task?.dueAt ?? isoDayOffset(1))
    setOwnerId(task ? task.ownerId ?? '' : currentUserId)
    setNote(task?.note ?? '')
  }, [open, task, defaults, currentUserId])

  function save() {
    start(async () => {
      const base = { priority, dueAt, ownerId: ownerId || null, note: note || null }
      const r = task
        ? await updateTaskAction(task.id, task.system ? base : { ...base, title, type })
        : await createTaskAction({ ...base, title, type, customerId: defaults?.customerId ?? null, leadId: defaults?.leadId ?? null, ticketId: defaults?.ticketId ?? null })
      if (!r.ok) return void toast.error(r.error)
      toast.success(task ? 'کار ذخیره شد' : 'کار ثبت شد')
      onSaved()
      onClose()
    })
  }

  return (
    <Drawer open={open} onOpenChange={(o) => !o && onClose()} title={task ? 'ویرایش کار' : 'کار جدید'} description={task?.system ? 'عنوان و نوع کارهای خودکار قابل تغییر نیست؛ زمان و مسئول را می‌توانید عوض کنید.' : undefined}>
      <form
        className="space-y-4"
        data-testid="task-form"
        onSubmit={(e) => {
          e.preventDefault()
          save()
        }}
      >
        <Field label="عنوان" required>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={140} disabled={task?.system} data-testid="task-form-title" />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="نوع">
            <Select value={type} onChange={(e) => setType(e.target.value as TaskType)} disabled={task?.system} data-testid="task-form-type">
              {Object.entries(TASK_TYPE_LABEL).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="اولویت">
            <Select value={String(priority)} onChange={(e) => setPriority(Number(e.target.value))}>
              {Object.entries(TASK_PRIORITY_LABEL).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <div>
          <JalaliDateField label="موعد" value={dueAt} onChange={setDueAt} data-testid="task-form-due" />
          <div className="mt-2 flex gap-2">
            {[
              ['امروز', 0],
              ['فردا', 1],
              ['هفتهٔ بعد', 7],
            ].map(([l, d]) => (
              <Button key={String(l)} type="button" size="sm" variant="ghost" onClick={() => setDueAt(isoDayOffset(Number(d)))}>
                {l}
              </Button>
            ))}
          </div>
        </div>
        <Field label="مسئول">
          <Select value={ownerId} onChange={(e) => setOwnerId(e.target.value)} data-testid="task-form-owner">
            <option value="">بدون مسئول</option>
            {staff.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="یادداشت" optional>
          <Textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} maxLength={1000} />
        </Field>
        <Button type="submit" variant="gold" disabled={pending || !title.trim()} data-testid="task-form-submit">
          {task ? 'ذخیره' : 'ثبت کار'}
        </Button>
      </form>
    </Drawer>
  )
}
