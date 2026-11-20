'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import type { TicketPriority, TicketStatus } from '@prisma/client'
import { db } from '@/lib/db'
import { logAdminChange } from '@/lib/audit'
import { crmGuard, crmFail, type Result } from '@/lib/crm/action-guard'
import { MSG } from '@/lib/crm/errors'
import {
  TICKET_PRIORITIES,
  TICKET_STATUSES,
  getTicket,
  setTicketStatus,
  assignTicket,
  setTicketPriority,
  replyToTicket,
  type TicketReplyRow,
  type TicketRow,
} from '@/lib/crm/tickets'
import { ticketsCsv } from '@/lib/crm/export'

const id = z.string().trim().min(1).max(40)
const status = z.enum(TICKET_STATUSES as unknown as [TicketStatus, ...TicketStatus[]])
const priority = z.enum(TICKET_PRIORITIES as unknown as [TicketPriority, ...TicketPriority[]])

function refresh() {
  revalidatePath('/admin/messages')
  revalidatePath('/admin')
}

/** Loads one ticket with its replies; opening it marks it read. */
export async function getTicketAction(ticketId: string): Promise<Result<{ ticket: TicketRow; replies: TicketReplyRow[] }>> {
  const g = await crmGuard('EDITOR', 'ticket-get', 120)
  if (!g.ok) return g
  if (!id.safeParse(ticketId).success) return { ok: false, error: MSG.badInput }
  try {
    const data = await getTicket(ticketId)
    return { ok: true, data }
  } catch (e) {
    return crmFail(e, 'ticket-get')
  }
}

export async function setTicketStatusAction(ticketId: string, to: TicketStatus): Promise<Result<null>> {
  const g = await crmGuard('EDITOR', 'ticket-status', 90)
  if (!g.ok) return g
  const p = z.object({ id, to: status }).safeParse({ id: ticketId, to })
  if (!p.success) return { ok: false, error: MSG.badInput }
  try {
    await setTicketStatus(p.data.id, p.data.to, g.userId)
    refresh()
    return { ok: true, data: null }
  } catch (e) {
    return crmFail(e, 'ticket-status')
  }
}

export async function assignTicketAction(ticketId: string, assigneeId: string | null): Promise<Result<null>> {
  const g = await crmGuard('EDITOR', 'ticket-assign', 60)
  if (!g.ok) return g
  const p = z.object({ id, a: id.nullable() }).safeParse({ id: ticketId, a: assigneeId })
  if (!p.success) return { ok: false, error: MSG.badInput }
  try {
    await assignTicket(p.data.id, p.data.a)
    refresh()
    return { ok: true, data: null }
  } catch (e) {
    return crmFail(e, 'ticket-assign')
  }
}

export async function setTicketPriorityAction(ticketId: string, value: TicketPriority): Promise<Result<null>> {
  const g = await crmGuard('EDITOR', 'ticket-priority', 60)
  if (!g.ok) return g
  const p = z.object({ id, v: priority }).safeParse({ id: ticketId, v: value })
  if (!p.success) return { ok: false, error: MSG.badInput }
  try {
    await setTicketPriority(p.data.id, p.data.v)
    refresh()
    return { ok: true, data: null }
  } catch (e) {
    return crmFail(e, 'ticket-priority')
  }
}

export async function replyTicketAction(ticketId: string, input: { body: string; internal: boolean; sendSms: boolean }): Promise<Result<null>> {
  const g = await crmGuard('EDITOR', 'ticket-reply', 30)
  if (!g.ok) return g
  const p = z.object({ id, body: z.string().max(2000), internal: z.boolean(), sendSms: z.boolean() }).safeParse({ id: ticketId, ...input })
  if (!p.success) return { ok: false, error: MSG.badInput }
  try {
    await replyToTicket(p.data.id, { body: p.data.body, internal: p.data.internal, sendSms: p.data.sendSms, actorUserId: g.userId })
    refresh()
    return { ok: true, data: null }
  } catch (e) {
    return crmFail(e, 'ticket-reply')
  }
}

export async function deleteTicketAction(ticketId: string): Promise<Result<null>> {
  const g = await crmGuard('ADMIN', 'ticket-delete', 20)
  if (!g.ok) return g
  if (!id.safeParse(ticketId).success) return { ok: false, error: MSG.badInput }
  try {
    await db.ticketReply.deleteMany({ where: { messageId: ticketId } })
    const res = await db.contactMessage.deleteMany({ where: { id: ticketId } })
    if (res.count !== 1) return { ok: false, error: MSG.notFound }
    await logAdminChange({ action: 'DELETE', entity: 'TICKET', entityId: ticketId })
    refresh()
    return { ok: true, data: null }
  } catch (e) {
    return crmFail(e, 'ticket-delete')
  }
}

export async function exportTicketsCsvAction(filters: { q?: string; status?: TicketStatus; priority?: TicketPriority } = {}): Promise<Result<string>> {
  const g = await crmGuard('ADMIN', 'ticket-export', 5)
  if (!g.ok) return g
  try {
    const csv = await ticketsCsv({ q: filters.q?.slice(0, 80), status: filters.status, priority: filters.priority })
    await logAdminChange({ action: 'EXPORT', entity: 'TICKET', entityId: 'bulk' })
    return { ok: true, data: csv }
  } catch (e) {
    return crmFail(e, 'ticket-export')
  }
}
