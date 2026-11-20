import type { Prisma, Role, TaskStatus, TaskType } from '@prisma/client'
import { db } from '@/lib/db'
import { CrmError, MSG } from '@/lib/crm/errors'
import { recordActivity } from '@/lib/crm/activity'
import { pageArgs, type Paged } from '@/lib/crm/types'
import { roleAtLeast } from '@/lib/crm/roles'

export const TASK_TYPES: readonly TaskType[] = ['CALL', 'SMS', 'FOLLOW_UP', 'VACCINE_REMINDER', 'WIN_BACK', 'CART', 'OTHER']
export const ACTIVE_TASK_STATUSES: readonly TaskStatus[] = ['OPEN', 'IN_PROGRESS']

export const TASK_TYPE_LABEL_FA: Record<TaskType, string> = {
  CALL: 'تماس',
  SMS: 'پیامک',
  FOLLOW_UP: 'پیگیری',
  VACCINE_REMINDER: 'یادآوری واکسن',
  WIN_BACK: 'بازگرداندن مشتری',
  CART: 'سبد خرید',
  OTHER: 'سایر',
}

export type TaskScope = 'mine' | 'all' | 'overdue' | 'today'

export type TaskListQuery = {
  scope?: TaskScope
  /** Needed for scope "mine" (my tasks and unassigned ones). */
  userId?: string
  owner?: string
  status?: TaskStatus
  type?: TaskType
  page?: number
  size?: number
  now?: Date
}

export type TaskRow = {
  id: string
  title: string
  type: TaskType
  status: TaskStatus
  priority: number
  dueAt: Date | null
  ownerId: string | null
  contactId: string | null
  customerId: string | null
  leadId: string | null
  ticketId: string | null
  system: boolean
  note: string | null
  completedAt: Date | null
  createdAt: Date
  overdue: boolean
  customerName: string | null
  leadName: string | null
}

export function dayBounds(now: Date): { start: Date; end: Date } {
  const start = new Date(now)
  start.setHours(0, 0, 0, 0)
  const end = new Date(now)
  end.setHours(23, 59, 59, 999)
  return { start, end }
}

export function buildTaskWhere(q: TaskListQuery): Prisma.CrmTaskWhereInput {
  const now = q.now ?? new Date()
  const { start, end } = dayBounds(now)
  const and: Prisma.CrmTaskWhereInput[] = []
  const active = { status: { in: [...ACTIVE_TASK_STATUSES] } }
  const scope = q.scope ?? 'all'
  if (scope === 'mine') and.push({ OR: [{ ownerId: q.userId ?? '__none__' }, { ownerId: null }] })
  if (scope === 'overdue') and.push(active, { dueAt: { lt: start } })
  if (scope === 'today') and.push(active, { dueAt: { gte: start, lte: end } })
  if (scope === 'mine' && !q.status) and.push(active)
  if (q.status) and.push({ status: q.status })
  if (q.type) and.push({ type: q.type })
  if (q.owner === 'none') and.push({ ownerId: null })
  else if (q.owner) and.push({ ownerId: q.owner })
  return and.length ? { AND: and } : {}
}

export async function listTasks(q: TaskListQuery): Promise<Paged<TaskRow>> {
  const now = q.now ?? new Date()
  const { page, size, skip } = pageArgs(q)
  const where = buildTaskWhere({ ...q, now })
  const [rows, total] = await Promise.all([
    // Overdue first (oldest due date first), then today, then later, undated last; urgent before relaxed on a tie.
    db.crmTask.findMany({ where, orderBy: [{ dueAt: { sort: 'asc', nulls: 'last' } }, { priority: 'asc' }, { createdAt: 'desc' }], skip, take: size }),
    db.crmTask.count({ where }),
  ])
  const custIds = [...new Set(rows.map((r) => r.customerId).filter((x): x is string => !!x))]
  const leadIds = [...new Set(rows.map((r) => r.leadId).filter((x): x is string => !!x))]
  const [custs, leads] = await Promise.all([
    custIds.length ? db.customer.findMany({ where: { id: { in: custIds } }, select: { id: true, firstName: true, lastName: true, phone: true } }) : [],
    leadIds.length ? db.lead.findMany({ where: { id: { in: leadIds } }, select: { id: true, name: true, phone: true } }) : [],
  ])
  const cn = new Map(custs.map((c) => [c.id, [c.firstName, c.lastName].filter(Boolean).join(' ') || c.phone]))
  const ln = new Map(leads.map((l) => [l.id, l.name || l.phone]))
  const startToday = dayBounds(now).start
  return {
    rows: rows.map((r) => ({
      ...r,
      overdue: ACTIVE_TASK_STATUSES.includes(r.status) && !!r.dueAt && r.dueAt < startToday,
      customerName: r.customerId ? cn.get(r.customerId) ?? null : null,
      leadName: r.leadId ? ln.get(r.leadId) ?? null : null,
    })),
    total,
    page,
    size,
  }
}

export type TaskInput = {
  title: string
  type?: TaskType
  priority?: number
  dueAt?: Date | null
  ownerId?: string | null
  contactId?: string | null
  customerId?: string | null
  leadId?: string | null
  ticketId?: string | null
  note?: string | null
}

function cleanTask(input: Partial<TaskInput>): Partial<TaskInput> {
  const out: Partial<TaskInput> = { ...input }
  if (out.title !== undefined) {
    const t = out.title.trim().slice(0, 140)
    if (!t) throw new CrmError('BAD_TITLE', 'عنوان کار را وارد کنید.')
    out.title = t
  }
  if (out.priority !== undefined) out.priority = Math.min(3, Math.max(1, Math.round(out.priority)))
  if (out.note !== undefined && out.note !== null) out.note = out.note.trim().slice(0, 1000) || null
  return out
}

async function assertOwner(ownerId: string | null | undefined) {
  if (!ownerId) return
  const u = await db.user.findFirst({ where: { id: ownerId, deletedAt: null }, select: { id: true } })
  if (!u) throw new CrmError('BAD_OWNER', 'کاربر انتخاب‌شده پیدا نشد.')
}

export async function createTask(input: TaskInput, actorUserId: string): Promise<{ id: string }> {
  const d = cleanTask(input) as TaskInput
  await assertOwner(d.ownerId)
  const t = await db.crmTask.create({
    data: {
      title: d.title,
      type: d.type ?? 'OTHER',
      priority: d.priority ?? 2,
      dueAt: d.dueAt ?? null,
      ownerId: d.ownerId ?? null,
      contactId: d.contactId ?? null,
      customerId: d.customerId ?? null,
      leadId: d.leadId ?? null,
      ticketId: d.ticketId ?? null,
      note: d.note ?? null,
    },
  })
  await recordActivity({ type: 'TASK_CREATED', summary: t.title, customerId: t.customerId, contactId: t.contactId, actorUserId, refType: 'task', refId: t.id })
  return { id: t.id }
}

/**
 * Edit rules: EDITOR and above may edit any task; system-generated tasks keep their title and type
 * (they are re-created by the generators otherwise) but can be rescheduled, reassigned and noted.
 */
export async function updateTask(id: string, patch: Partial<TaskInput> & { status?: TaskStatus }, actor: { userId: string; role: Role }): Promise<void> {
  if (!roleAtLeast(actor.role, 'EDITOR')) throw new CrmError('DENIED', MSG.denied)
  const cur = await db.crmTask.findUnique({ where: { id } })
  if (!cur) throw new CrmError('NOT_FOUND', MSG.notFound)
  const d = cleanTask(patch)
  if (cur.system && (d.title !== undefined || d.type !== undefined)) throw new CrmError('SYSTEM_TASK', 'عنوان و نوع کارهای خودکار قابل تغییر نیست.')
  if (d.ownerId !== undefined) await assertOwner(d.ownerId)
  const done = patch.status === 'DONE'
  await db.crmTask.update({
    where: { id },
    data: {
      ...(d.title !== undefined ? { title: d.title } : {}),
      ...(d.type !== undefined ? { type: d.type } : {}),
      ...(d.priority !== undefined ? { priority: d.priority } : {}),
      ...(d.dueAt !== undefined ? { dueAt: d.dueAt } : {}),
      ...(d.ownerId !== undefined ? { ownerId: d.ownerId } : {}),
      ...(d.note !== undefined ? { note: d.note } : {}),
      ...(patch.status ? { status: patch.status, completedAt: done ? new Date() : null } : {}),
    },
  })
  if (done && ACTIVE_TASK_STATUSES.includes(cur.status)) {
    await recordActivity({ type: 'TASK_COMPLETED', summary: cur.title, customerId: cur.customerId, contactId: cur.contactId, actorUserId: actor.userId, refType: 'task', refId: cur.id })
  }
}

/** Marks a task done once; a second parallel call finds it already done and does nothing. */
export async function completeTask(id: string, actorUserId: string): Promise<boolean> {
  const cur = await db.crmTask.findUnique({ where: { id } })
  if (!cur) throw new CrmError('NOT_FOUND', MSG.notFound)
  const res = await db.crmTask.updateMany({ where: { id, status: { in: [...ACTIVE_TASK_STATUSES] } }, data: { status: 'DONE', completedAt: new Date() } })
  if (res.count !== 1) return false
  await recordActivity({ type: 'TASK_COMPLETED', summary: cur.title, customerId: cur.customerId, contactId: cur.contactId, actorUserId, refType: 'task', refId: cur.id })
  return true
}

export async function snoozeTask(id: string, until: Date, now: Date = new Date()): Promise<void> {
  if (!(until.getTime() > now.getTime())) throw new CrmError('BAD_DATE', 'زمان انتخاب‌شده باید در آینده باشد.')
  const res = await db.crmTask.updateMany({ where: { id, status: { in: [...ACTIVE_TASK_STATUSES] } }, data: { dueAt: until } })
  if (res.count !== 1) throw new CrmError('NOT_FOUND', 'این کار پیدا نشد یا قبلاً بسته شده است.')
}

export async function deleteTask(id: string): Promise<void> {
  const res = await db.crmTask.deleteMany({ where: { id } })
  if (res.count !== 1) throw new CrmError('NOT_FOUND', MSG.notFound)
}
