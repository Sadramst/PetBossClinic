/**
 * CRM v2 backfill: links existing customers, leads, contact messages and marketing contacts
 * to the Contact spine, then computes lifecycle stage and health score. Idempotent.
 *
 *   npx tsx scripts/backfill-crm.ts
 */
import { db } from '../lib/db'
import { stageForLegacyStatus } from '../lib/crm/leads'
import { resolveContact, linkCustomerToContact } from '../lib/crm/contacts'
import { recomputeAllLifecycles } from '../lib/crm/lifecycle'
import { recomputeAllHealth } from '../lib/crm/health'

async function main() {
  // Legacy mapping (idempotent: only rows never touched by CRM v2 have stageChangedAt null).
  for (const l of await db.lead.findMany({ where: { stageChangedAt: null }, select: { id: true, status: true, assignedTo: true, ownerId: true, updatedAt: true } })) {
    await db.lead.updateMany({
      where: { id: l.id, stageChangedAt: null },
      data: { stage: stageForLegacyStatus(l.status), ownerId: l.ownerId ?? l.assignedTo, stageChangedAt: l.updatedAt },
    })
  }
  const replied = (await db.ticketReply.findMany({ select: { messageId: true }, distinct: ['messageId'] })).map((r) => r.messageId)
  await db.contactMessage.updateMany({
    where: {
      id: { notIn: replied },
      status: 'OPEN',
      resolvedAt: null,
      firstResponseAt: null,
      OR: [{ isRead: true }, { createdAt: { lt: new Date(Date.now() - 14 * 86_400_000) } }],
    },
    data: { status: 'RESOLVED', resolvedAt: new Date(), firstResponseAt: new Date() },
  })

  let customers = 0
  for (;;) {
    const batch = await db.customer.findMany({ where: { contactId: null, mergedIntoId: null }, select: { id: true }, take: 200 })
    if (batch.length === 0) break
    for (const c of batch) {
      try { await linkCustomerToContact(c.id); customers++ } catch (e) { console.warn('[backfill] customer', c.id, (e as Error).message) }
    }
    // customers that cannot be linked (no usable phone/email) would loop forever; stop when no progress
    const left = await db.customer.count({ where: { contactId: null, mergedIntoId: null } })
    if (left === 0 || customers === 0) break
    if (batch.length < 200) break
  }

  let leads = 0
  for (const l of await db.lead.findMany({ where: { contactId: null }, select: { id: true, phone: true, email: true, name: true } })) {
    const r = await resolveContact({ phone: l.phone, email: l.email, name: l.name })
    if (r) { await db.lead.update({ where: { id: l.id }, data: { contactId: r.id } }); leads++ }
  }

  let messages = 0
  for (const m of await db.contactMessage.findMany({ where: { contactId: null }, select: { id: true, phone: true, email: true, name: true } })) {
    const r = await resolveContact({ phone: m.phone, email: m.email, name: m.name })
    if (r) { await db.contactMessage.update({ where: { id: m.id }, data: { contactId: r.id } }); messages++ }
  }

  let marketing = 0
  for (const m of await db.marketingContact.findMany({ where: { contactId: null }, select: { id: true, phone: true, email: true, name: true } })) {
    const r = await resolveContact({ phone: m.phone, email: m.email, name: m.name })
    if (r) { await db.marketingContact.update({ where: { id: m.id }, data: { contactId: r.id } }); marketing++ }
  }

  const lc = await recomputeAllLifecycles()
  const h = await recomputeAllHealth()
  console.log(`[backfill-crm] customers=${customers} leads=${leads} messages=${messages} marketing=${marketing} lifecycle=${lc.updated} health=${h.updated}`)
}

main().catch((e) => { console.error(e); process.exit(1) }).finally(() => db.$disconnect())
