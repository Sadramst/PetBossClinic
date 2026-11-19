import { z } from 'zod'
import { db } from '@/lib/db'
import { dateField, firstError, text } from '@/lib/club/input'
import { awardPoints, servicePointsFor } from '@/lib/club/points'
import { addRecordFor, type PetRecordInput } from '@/lib/club/pets'

export const visitSchema = z.object({
  petId: z.string().max(40).nullable().optional(),
  serviceId: z.string().max(40).nullable().optional(),
  serviceName: text(120).pipe(z.string({ message: 'نام خدمت را وارد کنید.' }).min(1, 'نام خدمت را وارد کنید.')),
  visitedAt: dateField({ maxYearsAgo: 10 }).pipe(z.date({ message: 'تاریخ مراجعه را وارد کنید.' })),
  amount: z.coerce.number({ message: 'مبلغ معتبر نیست.' }).int().min(0).max(1_000_000_000).default(0),
  doctor: text(80).optional(),
  notes: text(1000).optional(),
})
export type VisitInput = z.input<typeof visitSchema>

export interface VisitResult {
  ok: boolean
  error?: string
  id?: string
  pointsAwarded?: number
}

/** Records a clinic visit on the customer's behalf, awards SERVICE points and (optionally) a health record. */
export async function recordVisit(
  adminId: string | null,
  customerId: string,
  raw: VisitInput,
  opts: { record?: PetRecordInput } = {}
): Promise<VisitResult> {
  const parsed = visitSchema.safeParse(raw)
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) }
  const d = parsed.data
  const customer = await db.customer.findUnique({ where: { id: customerId }, select: { id: true } })
  if (!customer) return { ok: false, error: 'مشتری پیدا نشد.' }
  if (d.petId) {
    const pet = await db.pet.findFirst({ where: { id: d.petId, customerId }, select: { id: true } })
    if (!pet) return { ok: false, error: 'این حیوان متعلق به این مشتری نیست.' }
  }
  if (d.serviceId) {
    const svc = await db.service.findUnique({ where: { id: d.serviceId }, select: { id: true } })
    if (!svc) return { ok: false, error: 'خدمت انتخاب‌شده پیدا نشد.' }
  }
  const visit = await db.serviceVisit.create({
    data: {
      customerId,
      petId: d.petId ?? null,
      serviceId: d.serviceId ?? null,
      serviceName: d.serviceName,
      visitedAt: d.visitedAt,
      amount: d.amount,
      doctor: d.doctor ?? null,
      notes: d.notes ?? null,
      createdByAdminId: adminId,
    },
  })
  let pointsAwarded = 0
  try {
    const points = await servicePointsFor(db, customerId, d.amount)
    if (points > 0) {
      const r = await awardPoints(db, { customerId, kind: 'SERVICE', points, refType: 'visit', refId: visit.id, note: `خدمت: ${d.serviceName}`, adminId })
      pointsAwarded = r.applied ? r.points : 0
      if (pointsAwarded) await db.serviceVisit.update({ where: { id: visit.id }, data: { pointsAwarded } })
    }
  } catch (err) {
    console.error('club: service points failed', (err as Error)?.name)
  }
  if (opts.record && d.petId) {
    await addRecordFor(customerId, d.petId, opts.record, 'visit', { visitId: visit.id })
  }
  return { ok: true, id: visit.id, pointsAwarded }
}

/** Edits a visit; when the amount changes, points are corrected by the difference. */
export async function updateVisit(adminId: string | null, visitId: string, raw: VisitInput): Promise<VisitResult> {
  const parsed = visitSchema.safeParse(raw)
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) }
  const d = parsed.data
  const visit = await db.serviceVisit.findUnique({ where: { id: visitId } })
  if (!visit) return { ok: false, error: 'سابقهٔ خدمت پیدا نشد.' }
  if (d.petId) {
    const pet = await db.pet.findFirst({ where: { id: d.petId, customerId: visit.customerId }, select: { id: true } })
    if (!pet) return { ok: false, error: 'این حیوان متعلق به این مشتری نیست.' }
  }
  let pointsAwarded = visit.pointsAwarded
  if (d.amount !== visit.amount) {
    const target = await servicePointsFor(db, visit.customerId, d.amount)
    const delta = target - visit.pointsAwarded
    if (delta !== 0) {
      const r = await awardPoints(db, {
        customerId: visit.customerId,
        kind: delta > 0 ? 'SERVICE' : 'ADJUST',
        points: delta,
        refType: 'visit',
        refId: `edit:${visit.id}:${Date.now()}`,
        note: `اصلاح مبلغ خدمت: ${visit.serviceName}`,
        adminId,
      })
      if (r.applied) pointsAwarded = visit.pointsAwarded + r.points
    }
  }
  await db.serviceVisit.update({
    where: { id: visitId },
    data: {
      petId: d.petId ?? null,
      serviceId: d.serviceId ?? null,
      serviceName: d.serviceName,
      visitedAt: d.visitedAt,
      amount: d.amount,
      doctor: d.doctor ?? null,
      notes: d.notes ?? null,
      pointsAwarded,
    },
  })
  return { ok: true, id: visitId, pointsAwarded }
}

/** Deletes a visit and takes its points back. */
export async function deleteVisit(adminId: string | null, visitId: string): Promise<VisitResult> {
  const visit = await db.serviceVisit.findUnique({ where: { id: visitId } })
  if (!visit) return { ok: false, error: 'سابقهٔ خدمت پیدا نشد.' }
  // Take back everything the visit ever gave (original award plus corrections).
  const earned = await db.pointsTransaction.findMany({
    where: { customerId: visit.customerId, refType: 'visit', OR: [{ refId: visit.id }, { refId: { startsWith: `edit:${visit.id}:` } }] },
    select: { points: true },
  })
  const net = earned.reduce((s, t) => s + t.points, 0)
  await db.$transaction(async (tx) => {
    await tx.petRecord.deleteMany({ where: { visitId: visit.id } })
    await tx.serviceVisit.delete({ where: { id: visit.id } })
    if (net > 0) {
      await awardPoints(tx, {
        customerId: visit.customerId,
        kind: 'REVERSAL',
        points: -net,
        refType: 'visit',
        refId: `SERVICE:${visit.id}`,
        note: `حذف سابقهٔ خدمت: ${visit.serviceName}`,
        adminId,
      })
    }
  })
  return { ok: true, id: visitId }
}

export async function listVisits(customerId: string, opts: { petId?: string; take?: number } = {}) {
  return db.serviceVisit.findMany({
    where: { customerId, ...(opts.petId ? { petId: opts.petId } : {}) },
    orderBy: { visitedAt: 'desc' },
    take: Math.min(200, opts.take ?? 100),
    include: { pet: { select: { id: true, name: true, species: true } } },
  })
}
