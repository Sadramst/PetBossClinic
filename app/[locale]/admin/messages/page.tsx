import type { TicketPriority, TicketStatus } from '@prisma/client'
import { db } from '@/lib/db'
import { requireAdmin } from '@/lib/auth/guard'
import { listTickets, TICKET_PRIORITIES, TICKET_STATUSES } from '@/lib/crm/tickets'
import { listStaffOptions } from '@/lib/crm/staff'
import { roleAtLeast } from '@/lib/crm/roles'
import { normalizeFa } from '@/lib/text/persian'
import { Inbox } from '@/components/admin/crm/inbox'

export const dynamic = 'force-dynamic'

type SP = { q?: string; status?: string; assignee?: string; priority?: string; breached?: string; page?: string; id?: string }

export default async function AdminMessagesPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<SP> }) {
  const { locale } = await params
  const session = await requireAdmin('EDITOR', locale)
  const sp = await searchParams
  const status = (TICKET_STATUSES as readonly string[]).includes(sp.status ?? '') ? (sp.status as TicketStatus) : undefined
  const priority = (TICKET_PRIORITIES as readonly string[]).includes(sp.priority ?? '') ? (sp.priority as TicketPriority) : undefined
  const activeStatuses: TicketStatus[] = ['OPEN', 'PENDING']
  const [list, staff, open, pending, unassigned, breached] = await Promise.all([
    listTickets({
      q: normalizeFa(sp.q ?? '').slice(0, 60),
      status,
      priority,
      assignee: sp.assignee?.slice(0, 40) || undefined,
      breached: sp.breached === '1',
      page: Math.max(1, Number.parseInt(sp.page ?? '1', 10) || 1),
      size: 25,
    }),
    listStaffOptions(),
    db.contactMessage.count({ where: { status: 'OPEN' } }),
    db.contactMessage.count({ where: { status: 'PENDING' } }),
    db.contactMessage.count({ where: { status: { in: activeStatuses }, assigneeId: null } }),
    listTickets({ breached: true, size: 1 }).then((r) => r.total),
  ])
  return (
    <Inbox
      tickets={list.rows.map((t) => ({
        id: t.id,
        name: t.name,
        phone: t.phone,
        subject: t.subject,
        message: t.message.slice(0, 200),
        isRead: t.isRead,
        status: t.status,
        priority: t.priority,
        assigneeId: t.assigneeId,
        customerId: t.customerId,
        createdAt: t.createdAt.toISOString(),
        sla: t.sla,
      }))}
      total={list.total}
      page={list.page}
      size={list.size}
      counts={{ open, pending, unassigned, breached }}
      staff={staff}
      isAdmin={roleAtLeast(session.role, 'ADMIN')}
      canEdit={roleAtLeast(session.role, 'EDITOR')}
      initialId={sp.id?.slice(0, 40)}
    />
  )
}
