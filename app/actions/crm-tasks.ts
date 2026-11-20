'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import type { TaskStatus, TaskType } from '@prisma/client'
import { logAdminChange } from '@/lib/audit'
import { crmGuard, crmFail, parseIso, type Result } from '@/lib/crm/action-guard'
import { MSG } from '@/lib/crm/errors'
import { createTask, updateTask, completeTask, snoozeTask, deleteTask, TASK_TYPES, type TaskScope } from '@/lib/crm/tasks'
import { tasksCsv } from '@/lib/crm/export'

const id = z.string().trim().min(1).max(40)
const type = z.enum(TASK_TYPES as unknown as [TaskType, ...TaskType[]])
const taskSchema = z.object({
  title: z.string().trim().min(1).max(140),
  type: type.optional(),
  priority: z.number().int().min(1).max(3).optional(),
  dueAt: z.string().nullable().optional(),
  ownerId: id.nullable().optional(),
  customerId: id.nullable().optional(),
  leadId: id.nullable().optional(),
  ticketId: id.nullable().optional(),
  note: z.string().max(1000).nullable().optional(),
})
export type TaskFormInput = z.input<typeof taskSchema>

function refresh() {
  revalidatePath('/admin/tasks')
  revalidatePath('/admin')
}

export async function createTaskAction(input: TaskFormInput): Promise<Result<{ id: string }>> {
  const g = await crmGuard('EDITOR', 'task-create', 60)
  if (!g.ok) return g
  const p = taskSchema.safeParse(input)
  if (!p.success) return { ok: false, error: 'عنوان کار را وارد کنید.' }
  try {
    const r = await createTask({ ...p.data, dueAt: parseIso(p.data.dueAt) }, g.userId)
    refresh()
    return { ok: true, data: r }
  } catch (e) {
    return crmFail(e, 'task-create')
  }
}

export async function updateTaskAction(taskId: string, patch: Partial<TaskFormInput> & { status?: TaskStatus }): Promise<Result<null>> {
  const g = await crmGuard('EDITOR', 'task-update', 90)
  if (!g.ok) return g
  const p = taskSchema.partial().extend({ status: z.enum(['OPEN', 'IN_PROGRESS', 'DONE', 'CANCELLED']).optional() }).safeParse(patch)
  if (!id.safeParse(taskId).success || !p.success) return { ok: false, error: MSG.badInput }
  try {
    const { dueAt, ...rest } = p.data
    await updateTask(taskId, { ...rest, ...(dueAt !== undefined ? { dueAt: parseIso(dueAt) } : {}) }, { userId: g.userId, role: g.role })
    refresh()
    return { ok: true, data: null }
  } catch (e) {
    return crmFail(e, 'task-update')
  }
}

export async function completeTaskAction(taskId: string): Promise<Result<null>> {
  const g = await crmGuard('EDITOR', 'task-complete', 120)
  if (!g.ok) return g
  if (!id.safeParse(taskId).success) return { ok: false, error: MSG.badInput }
  try {
    await completeTask(taskId, g.userId)
    refresh()
    return { ok: true, data: null }
  } catch (e) {
    return crmFail(e, 'task-complete')
  }
}

export async function snoozeTaskAction(taskId: string, iso: string): Promise<Result<null>> {
  const g = await crmGuard('EDITOR', 'task-snooze', 90)
  if (!g.ok) return g
  const when = parseIso(iso)
  if (!id.safeParse(taskId).success || !when) return { ok: false, error: MSG.badInput }
  try {
    await snoozeTask(taskId, when)
    refresh()
    return { ok: true, data: null }
  } catch (e) {
    return crmFail(e, 'task-snooze')
  }
}

export async function deleteTaskAction(taskId: string): Promise<Result<null>> {
  const g = await crmGuard('ADMIN', 'task-delete', 30)
  if (!g.ok) return g
  if (!id.safeParse(taskId).success) return { ok: false, error: MSG.badInput }
  try {
    await deleteTask(taskId)
    await logAdminChange({ action: 'DELETE', entity: 'CRM_TASK', entityId: taskId })
    refresh()
    return { ok: true, data: null }
  } catch (e) {
    return crmFail(e, 'task-delete')
  }
}

export async function exportTasksCsvAction(filters: { scope?: TaskScope; status?: TaskStatus; type?: TaskType } = {}): Promise<Result<string>> {
  const g = await crmGuard('ADMIN', 'task-export', 5)
  if (!g.ok) return g
  try {
    const csv = await tasksCsv({ ...filters, userId: g.userId })
    await logAdminChange({ action: 'EXPORT', entity: 'CRM_TASK', entityId: 'bulk' })
    return { ok: true, data: csv }
  } catch (e) {
    return crmFail(e, 'task-export')
  }
}
