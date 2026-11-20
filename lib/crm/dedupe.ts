import { db } from '@/lib/db'
import { normalizeFa } from '@/lib/text/persian'

export type CustomerBrief = {
  id: string
  name: string
  phone: string
  email: string | null
  city: string | null
  ordersCount: number
  totalSpent: number
  pointsBalance: number
  createdAt: Date
  petNames: string[]
}

export type DuplicateReason = 'PHONE' | 'EMAIL' | 'NAME_PET'
export type DuplicateCandidate = { a: CustomerBrief; b: CustomerBrief; reasons: DuplicateReason[]; score: number }

/** Name reduced to letters only: Persian forms unified, spaces, ZWNJ, diacritics and punctuation gone. */
export function nameKey(raw: string | null | undefined): string {
  if (!raw) return ''
  return normalizeFa(raw)
    .toLowerCase()
    .replace(/[‌‏‎\s]+/g, '')
    .replace(/[ً-ٰٟ]/g, '')
    .replace(/[^\p{L}\p{N}]/gu, '')
}

function trigrams(s: string): Set<string> {
  const padded = `  ${s} `
  const out = new Set<string>()
  for (let i = 0; i + 3 <= padded.length; i++) out.add(padded.slice(i, i + 3))
  return out
}

/** Dice coefficient over trigrams, 0..1 (1 = identical). */
export function trigramSimilarity(a: string, b: string): number {
  if (!a || !b) return 0
  if (a === b) return 1
  const A = trigrams(a)
  const B = trigrams(b)
  let shared = 0
  for (const t of A) if (B.has(t)) shared++
  return (2 * shared) / (A.size + B.size)
}

export const NAME_SIMILARITY_MIN = 0.8

type Row = { id: string; firstName: string | null; lastName: string | null; phone: string; email: string | null; city: string | null; ordersCount: number; totalSpent: number; pointsBalance: number; createdAt: Date }

const fullName = (r: Pick<Row, 'firstName' | 'lastName'>) => [r.firstName, r.lastName].filter(Boolean).join(' ')

/** Pure core of fuzzy matching: pairs of customers whose names are similar AND who share a pet name or city. */
export function fuzzyNamePairs(
  rows: Array<{ id: string; name: string; city: string | null; pets: string[] }>
): Array<{ aId: string; bId: string; similarity: number }> {
  const prepared = rows.map((r) => ({ id: r.id, key: nameKey(r.name), city: nameKey(r.city), pets: new Set(r.pets.map(nameKey).filter(Boolean)) })).filter((r) => r.key.length >= 4)
  // Bucket on the first two letters so the comparison stays near-linear; typos in the first letters are missed on purpose.
  const buckets = new Map<string, typeof prepared>()
  for (const p of prepared) {
    const k = p.key.slice(0, 2)
    buckets.set(k, [...(buckets.get(k) ?? []), p])
  }
  const out: Array<{ aId: string; bId: string; similarity: number }> = []
  for (const list of buckets.values()) {
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        const a = list[i]
        const b = list[j]
        const sim = trigramSimilarity(a.key, b.key)
        if (sim < NAME_SIMILARITY_MIN) continue
        const samePet = [...a.pets].some((p) => b.pets.has(p))
        const sameCity = !!a.city && a.city === b.city
        if (samePet || sameCity) out.push({ aId: a.id, bId: b.id, similarity: sim })
      }
    }
  }
  return out
}

async function briefs(ids: string[]): Promise<Map<string, CustomerBrief>> {
  const [rows, pets] = await Promise.all([
    db.customer.findMany({ where: { id: { in: ids } }, select: { id: true, firstName: true, lastName: true, phone: true, email: true, city: true, ordersCount: true, totalSpent: true, pointsBalance: true, createdAt: true } }),
    db.pet.findMany({ where: { customerId: { in: ids }, isActive: true }, select: { customerId: true, name: true }, take: 5000 }),
  ])
  const petMap = new Map<string, string[]>()
  for (const p of pets) petMap.set(p.customerId, [...(petMap.get(p.customerId) ?? []), p.name])
  return new Map(rows.map((r) => [r.id, { id: r.id, name: fullName(r) || r.phone, phone: r.phone, email: r.email, city: r.city, ordersCount: r.ordersCount, totalSpent: r.totalSpent, pointsBalance: r.pointsBalance, createdAt: r.createdAt, petNames: petMap.get(r.id) ?? [] }]))
}

const SCORE = { PHONE: 100, EMAIL: 90, NAME_PET: 70 } as const

/** Likely duplicate customers, most certain first. Already-merged customers are never offered again. */
export async function findDuplicates(opts: { limit?: number } = {}): Promise<DuplicateCandidate[]> {
  const limit = Math.min(200, Math.max(1, Math.floor(opts.limit ?? 50)))
  const pairs = new Map<string, { a: string; b: string; reasons: Set<DuplicateReason>; sim: number }>()
  const add = (x: string, y: string, reason: DuplicateReason, sim = 0) => {
    const [a, b] = x < y ? [x, y] : [y, x]
    const key = `${a}|${b}`
    const cur = pairs.get(key) ?? { a, b, reasons: new Set<DuplicateReason>(), sim: 0 }
    cur.reasons.add(reason)
    cur.sim = Math.max(cur.sim, sim)
    pairs.set(key, cur)
  }

  // 1 + 2: the same last 10 digits of the phone (handles +98 / 0098 / 0 spellings) or the same e-mail ignoring case.
  const [byPhone, byEmail] = await Promise.all([
    db.$queryRaw<Array<{ ids: string[] }>>`
      SELECT array_agg("id") AS ids FROM "Customer" WHERE "mergedIntoId" IS NULL
      GROUP BY right(regexp_replace("phone", '[^0-9]', '', 'g'), 10) HAVING COUNT(*) > 1 LIMIT 500`,
    db.$queryRaw<Array<{ ids: string[] }>>`
      SELECT array_agg("id") AS ids FROM "Customer" WHERE "mergedIntoId" IS NULL AND "email" IS NOT NULL
      GROUP BY lower("email") HAVING COUNT(*) > 1 LIMIT 500`,
  ])
  const pairUp = (groups: Array<{ ids: string[] }>, reason: DuplicateReason) => {
    for (const g of groups) for (let i = 0; i < g.ids.length; i++) for (let j = i + 1; j < g.ids.length; j++) add(g.ids[i], g.ids[j], reason)
  }
  pairUp(byPhone, 'PHONE')
  pairUp(byEmail, 'EMAIL')

  // 3: similar name plus the same pet name or city, over the most recent 5000 live customers.
  const recent = await db.customer.findMany({
    where: { mergedIntoId: null, OR: [{ firstName: { not: null } }, { lastName: { not: null } }] },
    select: { id: true, firstName: true, lastName: true, city: true },
    orderBy: { createdAt: 'desc' },
    take: 5000,
  })
  const pets = await db.pet.findMany({ where: { customerId: { in: recent.map((r) => r.id) }, isActive: true }, select: { customerId: true, name: true }, take: 20_000 })
  const petMap = new Map<string, string[]>()
  for (const p of pets) petMap.set(p.customerId, [...(petMap.get(p.customerId) ?? []), p.name])
  for (const f of fuzzyNamePairs(recent.map((r) => ({ id: r.id, name: fullName(r), city: r.city, pets: petMap.get(r.id) ?? [] })))) add(f.aId, f.bId, 'NAME_PET', f.similarity)

  const scored = [...pairs.values()]
    .map((p) => {
      const reasons = [...p.reasons]
      const score = Math.min(100, Math.max(...reasons.map((r) => SCORE[r])) + (reasons.length - 1) * 5 + (p.reasons.has('NAME_PET') && reasons.length === 1 ? Math.round((p.sim - NAME_SIMILARITY_MIN) * 50) : 0))
      return { ...p, reasons, score }
    })
    .sort((x, y) => y.score - x.score)
    .slice(0, limit)
  if (scored.length === 0) return []
  const map = await briefs([...new Set(scored.flatMap((s) => [s.a, s.b]))])
  return scored
    .filter((s) => map.has(s.a) && map.has(s.b))
    .map((s) => ({ a: map.get(s.a)!, b: map.get(s.b)!, reasons: s.reasons, score: s.score }))
}
