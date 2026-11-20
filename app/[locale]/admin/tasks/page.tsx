import type { TaskStatus, TaskType } from '@prisma/client'
import { db } from '@/lib/db'
import { requireAdmin } from '@/lib/auth/guard'
import { listTasks, buildTaskWhere, TASK_TYPES, type TaskScope } from '@/lib/crm/tasks'
import { listStaffOptions } from '@/lib/crm/staff'
import { roleAtLeast } from '@/lib/crm/roles'
import { TasksManager } from '@/components/admin/crm/tasks-manager'

export const dynamic = 'force-dynamic'

type SP = { scope?: string; status?: string; type?: string; page?: string; new?: string }
const SCOPES: TaskScope[] = ['mine', 'today', 'overdue', 'all']
const STATUSES = ['OPEN', 'IN_PROGRESS', 'DONE', 'CANCELLED']

export default async function AdminTasksPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<SP> }) {
  const { locale } = await params
  const session = await requireAdmin('EDITOR', locale)
  const sp = await searchParams
  const scope = (SCOPES as string[]).includes(sp.scope ?? '') ? (sp.scope as TaskScope) : 'mine'
  const status = STATUSES.includes(sp.status ?? '') ? (sp.status as TaskStatus) : undefined
  const type = (TASK_TYPES as readonly string[]).includes(sp.type ?? '') ? (sp.type as TaskType) : undefined
  const userId = session.userId
  const [list, staff, mine, today, overdue] = await Promise.all([
    listTasks({ scope, userId, status, type, page: Math.max(1, Number.parseInt(sp.page ?? '1', 10) || 1), size: 25 }),
    listStaffOptions(),
    db.crmTask.count({ where: buildTaskWhere({ scope: 'mine', userId }) }),
    db.crmTask.count({ where: buildTaskWhere({ scope: 'today' }) }),
    db.crmTask.count({ where: buildTaskWhere({ scope: 'overdue' }) }),
  ])
  return (
    <TasksManager
      tasks={list.rows.map((t) => ({
        id: t.id,
        title: t.title,
        type: t.type,
        status: t.status,
        priority: t.priority,
        dueAt: t.dueAt ? t.dueAt.toISOString() : null,
        ownerId: t.ownerId,
        customerId: t.customerId,
        leadId: t.leadId,
        ticketId: t.ticketId,
        system: t.system,
        note: t.note,
        overdue: t.overdue,
        customerName: t.customerName,
        leadName: t.leadName,
      }))}
      total={list.total}
      page={list.page}
      size={list.size}
      scope={scope}
      counts={{ mine, today, overdue }}
      staff={staff}
      currentUserId={userId}
      isAdmin={roleAtLeast(session.role, 'ADMIN')}
      openNew={sp.new === '1'}
    />
  )
}
