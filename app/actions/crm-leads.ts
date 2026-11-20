'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import type { LeadStage, LostReason } from '@prisma/client'
import { db } from '@/lib/db'
import { logAdminChange } from '@/lib/audit'
import { crmGuard, crmFail, parseIso, type Result } from '@/lib/crm/action-guard'
import { MSG } from '@/lib/crm/errors'
import { changeLeadStage, assignLead, setLeadFollowUp, convertLeadToCustomer, LEAD_STAGES, LOST_REASONS, legacyStatusForStage } from '@/lib/crm/leads'
import { leadsCsv } from '@/lib/crm/export'
import { resolveContact, normalizeContactPhone } from '@/lib/crm/contacts'
import { recordActivity } from '@/lib/crm/activity'

const id = z.string().trim().min(1).max(40)
const stage = z.enum(LEAD_STAGES as unknown as [LeadStage, ...LeadStage[]])
const reason = z.enum(LOST_REASONS as unknown as [LostReason, ...LostReason[]])

function refresh() {
  revalidatePath('/admin/leads')
  revalidatePath('/admin')
}

export async function changeLeadStageAction(leadId: string, to: LeadStage, lostReason?: LostReason): Promise<Result<null>> {
  const g = await crmGuard('EDITOR', 'lead-stage', 90)
  if (!g.ok) return g
  const p = z.object({ id, to: stage, r: reason.optional() }).safeParse({ id: leadId, to, r: lostReason })
  if (!p.success) return { ok: false, error: MSG.badInput }
  try {
    await changeLeadStage(p.data.id, p.data.to, { lostReason: p.data.r, actorUserId: g.userId, actorRole: g.role })
    refresh()
    return { ok: true, data: null }
  } catch (e) {
    return crmFail(e, 'lead-stage')
  }
}

export async function assignLeadAction(leadId: string, ownerId: string | null): Promise<Result<null>> {
  const g = await crmGuard('EDITOR', 'lead-assign', 60)
  if (!g.ok) return g
  const p = z.object({ id, o: id.nullable() }).safeParse({ id: leadId, o: ownerId })
  if (!p.success) return { ok: false, error: MSG.badInput }
  try {
    await assignLead(p.data.id, p.data.o, g.userId)
    refresh()
    return { ok: true, data: null }
  } catch (e) {
    return crmFail(e, 'lead-assign')
  }
}

export async function setLeadFollowUpAction(leadId: string, iso: string | null): Promise<Result<null>> {
  const g = await crmGuard('EDITOR', 'lead-followup', 60)
  if (!g.ok) return g
  if (!id.safeParse(leadId).success) return { ok: false, error: MSG.badInput }
  const when = parseIso(iso)
  if (iso && !when) return { ok: false, error: MSG.badInput }
  try {
    await setLeadFollowUp(leadId, when)
    refresh()
    return { ok: true, data: null }
  } catch (e) {
    return crmFail(e, 'lead-followup')
  }
}

export async function convertLeadToCustomerAction(leadId: string): Promise<Result<{ customerId: string; created: boolean }>> {
  const g = await crmGuard('EDITOR', 'lead-convert', 20)
  if (!g.ok) return g
  if (!id.safeParse(leadId).success) return { ok: false, error: MSG.badInput }
  try {
    const r = await convertLeadToCustomer(leadId, g.userId)
    refresh()
    revalidatePath('/admin/customers')
    return { ok: true, data: r }
  } catch (e) {
    return crmFail(e, 'lead-convert')
  }
}

export async function deleteLeadAction(leadId: string): Promise<Result<null>> {
  const g = await crmGuard('ADMIN', 'lead-delete', 20)
  if (!g.ok) return g
  if (!id.safeParse(leadId).success) return { ok: false, error: MSG.badInput }
  try {
    const res = await db.lead.deleteMany({ where: { id: leadId } })
    if (res.count !== 1) return { ok: false, error: MSG.notFound }
    await logAdminChange({ action: 'DELETE', entity: 'LEAD', entityId: leadId })
    refresh()
    return { ok: true, data: null }
  } catch (e) {
    return crmFail(e, 'lead-delete')
  }
}

const createSchema = z.object({
  name: z.string().trim().max(80).optional(),
  phone: z.string().trim().min(5).max(20),
  email: z.string().trim().email().max(120).optional().or(z.literal('')),
  petType: z.string().trim().max(40).optional(),
  serviceInterest: z.string().trim().max(80).optional(),
  message: z.string().trim().max(1000).optional(),
  source: z.string().trim().max(40).optional(),
  ownerId: id.nullable().optional(),
})

/** Staff-entered lead (phone call, walk-in): same identity rules as the public form. */
export async function createLeadManualAction(input: z.input<typeof createSchema>): Promise<Result<{ id: string }>> {
  const g = await crmGuard('EDITOR', 'lead-create', 40)
  if (!g.ok) return g
  const p = createSchema.safeParse(input)
  if (!p.success) return { ok: false, error: 'نام یا شمارهٔ تماس معتبر نیست.' }
  const normalizedPhone = normalizeContactPhone(p.data.phone)
  if (!normalizedPhone) return { ok: false, error: 'شمارهٔ موبایل معتبر نیست (مثلاً ۰۹۱۲۳۴۵۶۷۸۹).' }
  try {
    const contact = await resolveContact({ phone: normalizedPhone, email: p.data.email || null, name: p.data.name ?? null })
    const lead = await db.lead.create({
      data: {
        name: p.data.name || null,
        phone: normalizedPhone,
        normalizedPhone,
        email: p.data.email || null,
        petType: p.data.petType || null,
        serviceInterest: p.data.serviceInterest || null,
        message: p.data.message || null,
        source: p.data.source || 'MANUAL_ENTRY',
        status: legacyStatusForStage('NEW'),
        stage: 'NEW',
        stageChangedAt: new Date(),
        ownerId: p.data.ownerId ?? g.userId,
        contactId: contact?.id ?? null,
      },
    })
    await recordActivity({ type: 'LEAD_CREATED', summary: 'سرنخ جدید ثبت شد', contactId: contact?.id ?? null, actorUserId: g.userId, refType: 'lead', refId: lead.id })
    refresh()
    return { ok: true, data: { id: lead.id } }
  } catch (e) {
    return crmFail(e, 'lead-create')
  }
}

export async function exportLeadsCsvAction(filters: { q?: string; stage?: LeadStage; owner?: string; source?: string } = {}): Promise<Result<string>> {
  const g = await crmGuard('ADMIN', 'lead-export', 5)
  if (!g.ok) return g
  try {
    const csv = await leadsCsv({
      q: filters.q?.slice(0, 80),
      stage: filters.stage && LEAD_STAGES.includes(filters.stage) ? filters.stage : undefined,
      owner: filters.owner?.slice(0, 40),
      source: filters.source?.slice(0, 40),
    })
    await logAdminChange({ action: 'EXPORT', entity: 'LEAD', entityId: 'bulk' })
    return { ok: true, data: csv }
  } catch (e) {
    return crmFail(e, 'lead-export')
  }
}
