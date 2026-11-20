'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { db } from '@/lib/db'
import { logAdminChange } from '@/lib/audit'
import { crmGuard, crmFail, type Result } from '@/lib/crm/action-guard'
import { MSG, CrmError } from '@/lib/crm/errors'
import { recordActivity } from '@/lib/crm/activity'
import { addCustomerNote } from '@/lib/club/customers-admin'
import { getCustomerTimeline, type TimelineItem } from '@/lib/crm/timeline'
import { isActivityType, type ActivityType } from '@/lib/crm/activity'
import { TIMELINE_GROUPS } from '@/lib/crm/labels'

const id = z.string().trim().min(1).max(40)
const MAX_BULK = 200

async function assertStaff(ownerId: string | null) {
  if (!ownerId) return
  const u = await db.user.findFirst({ where: { id: ownerId, deletedAt: null }, select: { id: true } })
  if (!u) throw new CrmError('BAD_OWNER', 'کاربر انتخاب‌شده پیدا نشد.')
}

function refresh(customerId?: string) {
  revalidatePath('/admin/customers')
  if (customerId) revalidatePath(`/admin/customers/${customerId}`)
}

export async function assignCustomerOwnerAction(customerId: string, ownerId: string | null): Promise<Result<null>> {
  const g = await crmGuard('EDITOR', 'cust-owner', 60)
  if (!g.ok) return g
  const p = z.object({ c: id, o: id.nullable() }).safeParse({ c: customerId, o: ownerId })
  if (!p.success) return { ok: false, error: MSG.badInput }
  try {
    await assertStaff(p.data.o)
    const cur = await db.customer.findUnique({ where: { id: p.data.c }, select: { id: true, ownerId: true, contactId: true } })
    if (!cur) return { ok: false, error: MSG.notFound }
    if (cur.ownerId !== p.data.o) {
      await db.customer.update({ where: { id: cur.id }, data: { ownerId: p.data.o } })
      await recordActivity({
        type: 'OWNER_CHANGED',
        summary: p.data.o ? 'مسئول مشتری تغییر کرد' : 'مسئول مشتری برداشته شد',
        customerId: cur.id,
        contactId: cur.contactId,
        actorUserId: g.userId,
        refType: 'customer-owner',
        refId: `${cur.id}:${Date.now()}`,
        meta: { from: cur.ownerId, to: p.data.o },
      })
    }
    refresh(cur.id)
    return { ok: true, data: null }
  } catch (e) {
    return crmFail(e, 'cust-owner')
  }
}

export async function bulkAssignCustomersAction(ids: string[], ownerId: string | null): Promise<Result<{ updated: number }>> {
  const g = await crmGuard('EDITOR', 'cust-bulk', 10)
  if (!g.ok) return g
  const p = z.object({ ids: z.array(id).min(1).max(MAX_BULK), o: id.nullable() }).safeParse({ ids, o: ownerId })
  if (!p.success) return { ok: false, error: `هر بار حداکثر ${MAX_BULK} مشتری قابل انتخاب است.` }
  try {
    await assertStaff(p.data.o)
    const res = await db.customer.updateMany({ where: { id: { in: p.data.ids }, mergedIntoId: null }, data: { ownerId: p.data.o } })
    await logAdminChange({ action: 'UPDATE', entity: 'CUSTOMER', entityId: 'bulk', details: { op: 'assign', count: res.count, ownerId: p.data.o } })
    refresh()
    return { ok: true, data: { updated: res.count } }
  } catch (e) {
    return crmFail(e, 'cust-bulk-assign')
  }
}

export async function bulkTagCustomersAction(ids: string[], tag: string, mode: 'add' | 'remove'): Promise<Result<{ updated: number }>> {
  const g = await crmGuard('EDITOR', 'cust-bulk', 10)
  if (!g.ok) return g
  const p = z
    .object({ ids: z.array(id).min(1).max(MAX_BULK), tag: z.string().trim().min(1).max(30), mode: z.enum(['add', 'remove']) })
    .safeParse({ ids, tag, mode })
  if (!p.success) return { ok: false, error: 'برچسب باید بین ۱ تا ۳۰ نویسه باشد.' }
  try {
    const rows = await db.customer.findMany({ where: { id: { in: p.data.ids }, mergedIntoId: null }, select: { id: true, tags: true } })
    let updated = 0
    await db.$transaction(async (tx) => {
      for (const r of rows) {
        const has = r.tags.includes(p.data.tag)
        if (p.data.mode === 'add' && (has || r.tags.length >= 20)) continue
        if (p.data.mode === 'remove' && !has) continue
        const tags = p.data.mode === 'add' ? [...r.tags, p.data.tag] : r.tags.filter((t) => t !== p.data.tag)
        await tx.customer.update({ where: { id: r.id }, data: { tags } })
        updated++
      }
    })
    await logAdminChange({ action: 'UPDATE', entity: 'CUSTOMER', entityId: 'bulk', details: { op: `tag-${p.data.mode}`, tag: p.data.tag, count: updated } })
    refresh()
    return { ok: true, data: { updated } }
  } catch (e) {
    return crmFail(e, 'cust-bulk-tag')
  }
}

export async function quickNoteAction(customerId: string, body: string): Promise<Result<null>> {
  const g = await crmGuard('EDITOR', 'cust-note', 40)
  if (!g.ok) return g
  if (!id.safeParse(customerId).success) return { ok: false, error: MSG.badInput }
  try {
    const r = await addCustomerNote(customerId, g.userId, g.name, body)
    if (!r.ok) return { ok: false, error: r.error ?? MSG.generic }
    const c = await db.customer.findUnique({ where: { id: customerId }, select: { contactId: true } })
    await recordActivity({ type: 'NOTE_ADDED', summary: body.trim().slice(0, 120), customerId, contactId: c?.contactId ?? null, actorUserId: g.userId, refType: 'note', refId: r.id ?? `${customerId}:${Date.now()}` })
    refresh(customerId)
    return { ok: true, data: null }
  } catch (e) {
    return crmFail(e, 'cust-note')
  }
}

/** One page of a customer's unified timeline; `group` limits it to a family of events, `before` is the cursor. */
export async function loadTimelineAction(customerId: string, group: string | null, before: string | null): Promise<Result<{ items: TimelineItem[]; nextCursor: string | null }>> {
  const g = await crmGuard('EDITOR', 'cust-timeline', 120)
  if (!g.ok) return g
  if (!id.safeParse(customerId).success) return { ok: false, error: MSG.badInput }
  const grp = TIMELINE_GROUPS.find((x) => x.id === group)
  const cursor = before ? new Date(before) : undefined
  if (cursor && Number.isNaN(cursor.getTime())) return { ok: false, error: MSG.badInput }
  try {
    const data = await getCustomerTimeline(customerId, { before: cursor, take: 30, types: grp ? (grp.types.filter(isActivityType) as ActivityType[]) : undefined })
    return { ok: true, data }
  } catch (e) {
    return crmFail(e, 'cust-timeline')
  }
}
