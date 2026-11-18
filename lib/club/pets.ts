import { z } from 'zod'
import { db } from '@/lib/db'
import { dateField, firstError, text } from '@/lib/club/input'
import { isProfileBonusComplete } from '@/lib/club/pet-math'

/**
 * Pet data layer. Every function takes the OWNER's customerId and scopes the query by it, so a
 * pet or record id from another customer simply is not found (no IDOR). Customer actions pass the
 * session's id; admin actions pass the id of the customer being edited.
 */

export const MAX_PETS = 20
export const MAX_RECORDS_PER_PET = 200
export const PHOTO_MAX_BYTES = 200 * 1024

const SPECIES = ['DOG', 'CAT', 'BIRD', 'RABBIT', 'FISH', 'REPTILE', 'RODENT', 'OTHER'] as const
const SEX = ['MALE', 'FEMALE', 'UNKNOWN'] as const
const KINDS = ['VACCINE', 'DEWORMING', 'CHECKUP', 'SURGERY', 'GROOMING', 'DENTAL', 'WEIGHT', 'TREATMENT', 'NOTE'] as const

const optionalBool = z.union([z.boolean(), z.null(), z.undefined()]).transform((v) => (v == null ? null : v))
const optionalWeight = z
  .union([z.number(), z.string(), z.null(), z.undefined()])
  .transform((v, ctx) => {
    if (v == null || v === '') return null
    const n = typeof v === 'number' ? v : Number(String(v).replace(/[٠-٩۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹٠١٢٣٤٥٦٧٨٩'.indexOf(d) % 10)).replace('٫', '.'))
    if (!Number.isFinite(n) || n <= 0 || n > 200) {
      ctx.addIssue({ code: 'custom', message: 'وزن باید عددی بین ۰٫۰۱ تا ۲۰۰ کیلوگرم باشد.' })
      return z.NEVER
    }
    return Math.round(n * 100) / 100
  })

export const petSchema = z.object({
  name: text(40).pipe(z.string({ message: 'نام حیوان خانگی را وارد کنید.' }).min(1, 'نام حیوان خانگی را وارد کنید.')),
  species: z.enum(SPECIES, { message: 'نوع حیوان را انتخاب کنید.' }),
  breed: text(40).optional(),
  sex: z.enum(SEX).default('UNKNOWN'),
  birthDate: dateField({ maxYearsAgo: 45 }).optional(),
  adoptedAt: dateField({ maxYearsAgo: 45 }).optional(),
  weightKg: optionalWeight.optional(),
  neutered: optionalBool.optional(),
  color: text(30).optional(),
  microchip: text(20)
    .refine((v) => v == null || /^\d{9,15}$/.test(v.replace(/\s/g, '')), 'شماره میکروچیپ باید ۹ تا ۱۵ رقم باشد.')
    .optional(),
  foodBrand: text(60).optional(),
  foodProductId: z.string().max(40).nullable().optional(),
  allergies: text(300).optional(),
  medicalNotes: text(1000).optional(),
})
export type PetInput = z.input<typeof petSchema>

export const recordSchema = z.object({
  kind: z.enum(KINDS, { message: 'نوع سابقه را انتخاب کنید.' }),
  title: text(80).pipe(z.string({ message: 'عنوان را وارد کنید.' }).min(1, 'عنوان را وارد کنید.')),
  doneAt: dateField({ maxYearsAgo: 45 }).pipe(z.date({ message: 'تاریخ انجام را وارد کنید.' })),
  nextDueAt: dateField({ allowFuture: true, maxYearsAgo: 1 }).optional(),
  valueNumber: optionalWeight.optional(),
  notes: text(500).optional(),
})
export type PetRecordInput = z.input<typeof recordSchema>

export interface PetOpResult {
  ok: boolean
  error?: string
  id?: string
  /** Points awarded as a side effect (first pet, complete profile) */
  bonus?: number
}

const NOT_FOUND = 'حیوان خانگی پیدا نشد.'

/** Strips undefined so partial updates never blank a field by accident. */
function definedOnly<T extends Record<string, unknown>>(o: T): Partial<T> {
  return Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as Partial<T>
}

export async function listPets(customerId: string, opts: { includeInactive?: boolean } = {}) {
  return db.pet.findMany({
    where: { customerId, ...(opts.includeInactive ? {} : { isActive: true }) },
    orderBy: { createdAt: 'asc' },
  })
}

/** One pet, only if it belongs to the customer. */
export async function getPetFor(customerId: string, petId: string) {
  return db.pet.findFirst({ where: { id: petId, customerId } })
}

export async function createPetFor(customerId: string, raw: PetInput): Promise<PetOpResult> {
  const parsed = petSchema.safeParse(raw)
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) }
  const [count, everCount] = await Promise.all([db.pet.count({ where: { customerId, isActive: true } }), db.pet.count({ where: { customerId } })])
  // Removed pets still count toward a lifetime cap, so delete-and-recreate cannot farm profile bonuses.
  if (count >= MAX_PETS || everCount >= MAX_PETS * 2) return { ok: false, error: `حداکثر ${MAX_PETS} حیوان خانگی می‌توانید ثبت کنید.` }
  const d = parsed.data
  const pet = await db.pet.create({
    data: {
      customerId,
      name: d.name,
      species: d.species,
      breed: d.breed ?? null,
      sex: d.sex,
      birthDate: d.birthDate ?? null,
      adoptedAt: d.adoptedAt ?? null,
      weightKg: d.weightKg ?? null,
      neutered: d.neutered ?? null,
      color: d.color ?? null,
      microchip: d.microchip ? d.microchip.replace(/\s/g, '') : null,
      foodBrand: d.foodBrand ?? null,
      foodProductId: d.foodProductId ?? null,
      allergies: d.allergies ?? null,
      medicalNotes: d.medicalNotes ?? null,
    },
  })
  if (d.weightKg) {
    await db.petRecord.create({ data: { petId: pet.id, kind: 'WEIGHT', title: 'وزن اولیه', doneAt: new Date(), valueNumber: d.weightKg, source: 'customer' } })
  }
  const bonus = await petBonuses(customerId, pet.id)
  return { ok: true, id: pet.id, bonus }
}

export async function updatePetFor(customerId: string, petId: string, raw: PetInput): Promise<PetOpResult> {
  const parsed = petSchema.safeParse(raw)
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) }
  const d = parsed.data
  const data = definedOnly({
    name: d.name,
    species: d.species,
    breed: d.breed,
    sex: d.sex,
    birthDate: d.birthDate,
    adoptedAt: d.adoptedAt,
    weightKg: d.weightKg,
    neutered: d.neutered,
    color: d.color,
    microchip: d.microchip === undefined ? undefined : d.microchip ? d.microchip.replace(/\s/g, '') : null,
    foodBrand: d.foodBrand,
    foodProductId: d.foodProductId,
    allergies: d.allergies,
    medicalNotes: d.medicalNotes,
  })
  const done = await db.pet.updateMany({ where: { id: petId, customerId }, data })
  if (done.count !== 1) return { ok: false, error: NOT_FOUND }
  const bonus = await petBonuses(customerId, petId)
  return { ok: true, id: petId, bonus }
}

/** Soft delete by default (the pet disappears for the customer, history stays for the clinic). */
export async function deletePetFor(customerId: string, petId: string, opts: { hard?: boolean } = {}): Promise<PetOpResult> {
  const done = opts.hard
    ? await db.pet.deleteMany({ where: { id: petId, customerId } })
    : await db.pet.updateMany({ where: { id: petId, customerId, isActive: true }, data: { isActive: false } })
  return done.count === 1 ? { ok: true, id: petId } : { ok: false, error: NOT_FOUND }
}

export async function addRecordFor(
  customerId: string,
  petId: string,
  raw: PetRecordInput,
  source: 'customer' | 'admin' | 'visit' = 'customer',
  extra: { visitId?: string | null } = {}
): Promise<PetOpResult> {
  const parsed = recordSchema.safeParse(raw)
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) }
  const d = parsed.data
  const pet = await db.pet.findFirst({ where: { id: petId, customerId }, select: { id: true } })
  if (!pet) return { ok: false, error: NOT_FOUND }
  if (d.kind === 'WEIGHT' && !d.valueNumber) return { ok: false, error: 'وزن را وارد کنید.' }
  if (d.nextDueAt && d.nextDueAt.getTime() <= d.doneAt.getTime()) return { ok: false, error: 'موعد بعدی باید بعد از تاریخ انجام باشد.' }
  const count = await db.petRecord.count({ where: { petId } })
  if (count >= MAX_RECORDS_PER_PET) return { ok: false, error: `هر حیوان حداکثر ${MAX_RECORDS_PER_PET} سابقه می‌تواند داشته باشد.` }
  const rec = await db.petRecord.create({
    data: {
      petId,
      kind: d.kind,
      title: d.title,
      doneAt: d.doneAt,
      nextDueAt: d.nextDueAt ?? null,
      valueNumber: d.valueNumber ?? null,
      notes: d.notes ?? null,
      source,
      visitId: extra.visitId ?? null,
    },
  })
  // The newest weight entry is the pet's current weight.
  if (d.kind === 'WEIGHT' && d.valueNumber) {
    const newer = await db.petRecord.count({ where: { petId, kind: 'WEIGHT', doneAt: { gt: d.doneAt } } })
    if (newer === 0) await db.pet.updateMany({ where: { id: petId, customerId }, data: { weightKg: d.valueNumber } })
  }
  const bonus = await petBonuses(customerId, petId)
  return { ok: true, id: rec.id, bonus }
}

export async function deleteRecordFor(customerId: string, recordId: string, opts: { allowVisitRecords?: boolean } = {}): Promise<PetOpResult> {
  const rec = await db.petRecord.findFirst({ where: { id: recordId, pet: { customerId } }, select: { id: true, source: true } })
  if (!rec) return { ok: false, error: 'سابقه پیدا نشد.' }
  // What the clinic recorded stays; customers can only remove their own entries.
  if (rec.source !== 'customer' && !opts.allowVisitRecords) return { ok: false, error: 'سوابق ثبت‌شده توسط کلینیک قابل حذف نیست.' }
  await db.petRecord.deleteMany({ where: { id: recordId } })
  return { ok: true, id: recordId }
}

/** Stores a small validated image (data URL) as the pet's photo; null removes it. */
export async function setPetPhotoFor(customerId: string, petId: string, dataUrl: string | null): Promise<PetOpResult> {
  if (dataUrl !== null) {
    const m = /^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl)
    if (!m) return { ok: false, error: 'فقط تصویر JPG، PNG یا WebP پذیرفته می‌شود.' }
    const bytes = Buffer.from(m[2], 'base64')
    if (bytes.length === 0 || bytes.length > PHOTO_MAX_BYTES) return { ok: false, error: 'حجم عکس باید کمتر از ۲۰۰ کیلوبایت باشد.' }
    const sig = bytes.subarray(0, 12)
    const isJpeg = sig[0] === 0xff && sig[1] === 0xd8
    const isPng = sig[0] === 0x89 && sig[1] === 0x50 && sig[2] === 0x4e && sig[3] === 0x47
    const isWebp = sig.subarray(0, 4).toString() === 'RIFF' && sig.subarray(8, 12).toString() === 'WEBP'
    if (!(isJpeg || isPng || isWebp)) return { ok: false, error: 'فایل انتخاب‌شده تصویر معتبر نیست.' }
  }
  const done = await db.pet.updateMany({ where: { id: petId, customerId }, data: { photoUrl: dataUrl } })
  if (done.count !== 1) return { ok: false, error: NOT_FOUND }
  const bonus = await petBonuses(customerId, petId)
  return { ok: true, id: petId, bonus }
}

/**
 * First-pet and complete-profile bonuses. Each is awarded once (ledger unique key), and a failure
 * never breaks the pet save. Returns the points awarded now.
 */
export async function petBonuses(customerId: string, petId: string): Promise<number> {
  try {
    const { awardPoints } = await import('@/lib/club/points')
    const { getLoyaltyConfig } = await import('@/lib/club/config')
    const cfg = await getLoyaltyConfig()
    if (!cfg.enabled) return 0
    let total = 0
    if (cfg.firstPetBonus > 0) {
      const r = await awardPoints(db, { customerId, kind: 'FIRST_PET', points: cfg.firstPetBonus, refType: 'pet', refId: customerId, note: 'ثبت اولین حیوان خانگی' })
      if (r.applied) total += r.points
    }
    const pet = await db.pet.findFirst({ where: { id: petId, customerId }, select: { breed: true, birthDate: true, photoUrl: true, weightKg: true } })
    if (pet && cfg.petProfileBonus > 0 && isProfileBonusComplete(pet)) {
      const r = await awardPoints(db, { customerId, kind: 'PET_PROFILE', points: cfg.petProfileBonus, refType: 'pet', refId: petId, note: 'تکمیل پروفایل حیوان خانگی' })
      if (r.applied) total += r.points
    }
    return total
  } catch (err) {
    console.error('club: pet bonus failed', (err as Error)?.name)
    return 0
  }
}
