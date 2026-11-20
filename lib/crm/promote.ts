import { db } from '@/lib/db'
import { recordActivity } from '@/lib/crm/activity'

/** Every spelling a lead's phone may have been stored in (leads keep the E.164 form +98...). */
export function phoneVariants(phone: string): string[] {
  const local = phone.replace(/^0/, '')
  return [phone, `+98${local}`, `98${local}`, `0098${local}`]
}

/**
 * A person who registers or orders has won: their open (or lost) leads become WON and point at the customer.
 * Idempotent and race-safe: each lead flips once, so activity and counts are not duplicated.
 */
export async function promoteLeadsForCustomer(customerId: string): Promise<number> {
  const c = await db.customer.findUnique({ where: { id: customerId }, select: { id: true, phone: true, contactId: true } })
  if (!c) return 0
  const leads = await db.lead.findMany({
    where: {
      stage: { not: 'WON' },
      OR: [{ customerId: c.id }, { normalizedPhone: c.phone }, { phone: { in: phoneVariants(c.phone) } }, ...(c.contactId ? [{ contactId: c.contactId }] : [])],
    },
    select: { id: true, stage: true },
    take: 200,
  })
  let promoted = 0
  const now = new Date()
  for (const lead of leads) {
    const res = await db.lead.updateMany({
      where: { id: lead.id, stage: { not: 'WON' } },
      data: { stage: 'WON', status: 'CONVERTED', customerId: c.id, contactId: c.contactId ?? undefined, lostReason: null, stageChangedAt: now },
    })
    if (res.count !== 1) continue
    promoted++
    await db.crmTask.updateMany({ where: { leadId: lead.id, system: true, status: { in: ['OPEN', 'IN_PROGRESS'] } }, data: { status: 'CANCELLED' } })
    await recordActivity({
      type: 'LEAD_PROMOTED',
      summary: 'سرنخ پس از ثبت‌نام یا خرید به مشتری تبدیل شد',
      customerId: c.id,
      contactId: c.contactId,
      refType: 'lead',
      refId: lead.id,
      meta: { from: lead.stage },
      occurredAt: now,
    })
  }
  return promoted
}
