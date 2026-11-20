import type { Role } from '@prisma/client'
import { db } from '@/lib/db'
import { CrmError, MSG } from '@/lib/crm/errors'
import { roleAtLeast } from '@/lib/crm/roles'

export type SavedViewEntity = 'CUSTOMER' | 'LEAD' | 'TICKET' | 'TASK' | 'ORDER' | 'PRODUCT'
export const SAVED_VIEW_ENTITIES: readonly SavedViewEntity[] = ['CUSTOMER', 'LEAD', 'TICKET', 'TASK', 'ORDER', 'PRODUCT']
export const MAX_VIEWS_PER_USER = 30

export type SavedViewRow = { id: string; entity: SavedViewEntity; name: string; filters: unknown; sort: string | null; ownerId: string | null; shared: boolean; mine: boolean; createdAt: Date }

const isEntity = (e: string): e is SavedViewEntity => (SAVED_VIEW_ENTITIES as readonly string[]).includes(e)

function toRow(v: { id: string; entity: string; name: string; filters: unknown; sort: string | null; ownerId: string | null; shared: boolean; createdAt: Date }, userId: string): SavedViewRow {
  return { id: v.id, entity: v.entity as SavedViewEntity, name: v.name, filters: v.filters, sort: v.sort, ownerId: v.ownerId, shared: v.shared, mine: v.ownerId === userId, createdAt: v.createdAt }
}

/** Own views plus the ones an admin shared with the team. */
export async function listViews(entity: SavedViewEntity, userId: string, _role: Role): Promise<SavedViewRow[]> {
  void _role
  if (!isEntity(entity)) return []
  const rows = await db.savedView.findMany({ where: { entity, OR: [{ ownerId: userId }, { shared: true }] }, orderBy: [{ shared: 'asc' }, { name: 'asc' }], take: 100 })
  return rows.map((r) => toRow(r, userId))
}

/** Only plain JSON objects of reasonable size are stored as filters. */
export function sanitizeFilters(filters: unknown): Record<string, unknown> {
  if (!filters || typeof filters !== 'object' || Array.isArray(filters)) throw new CrmError('BAD_FILTERS', 'فیلترهای ذخیره‌شده معتبر نیستند.')
  const json = JSON.stringify(filters)
  if (json.length > 8000) throw new CrmError('BAD_FILTERS', 'فیلترها بیش از حد بزرگ‌اند.')
  return JSON.parse(json) as Record<string, unknown>
}

/** Sharing with the whole team needs ADMIN; the role is mandatory for that, so a caller cannot forget it. */
export async function saveView(v: { entity: SavedViewEntity; name: string; filters: unknown; sort?: string; shared?: boolean }, userId: string, role?: Role): Promise<SavedViewRow> {
  if (!isEntity(v.entity)) throw new CrmError('BAD_ENTITY', MSG.badInput)
  const name = v.name.trim().slice(0, 60)
  if (!name) throw new CrmError('BAD_NAME', 'برای نمای ذخیره‌شده یک نام بنویسید.')
  const filters = sanitizeFilters(v.filters)
  if (v.shared && !roleAtLeast(role, 'ADMIN')) throw new CrmError('DENIED', 'اشتراک‌گذاری نما با همه فقط برای مدیر مجاز است.')
  const count = await db.savedView.count({ where: { ownerId: userId, entity: v.entity } })
  if (count >= MAX_VIEWS_PER_USER) throw new CrmError('LIMIT', `حداکثر ${MAX_VIEWS_PER_USER} نمای ذخیره‌شده مجاز است.`)
  const dup = await db.savedView.findFirst({ where: { ownerId: userId, entity: v.entity, name }, select: { id: true } })
  const data = { entity: v.entity, name, filters: filters as never, sort: v.sort?.slice(0, 40) ?? null, ownerId: userId, shared: !!v.shared }
  // Saving under an existing name replaces that view (like "Save" in any filter bar).
  const row = dup ? await db.savedView.update({ where: { id: dup.id }, data }) : await db.savedView.create({ data })
  return toRow(row, userId)
}

/** Owners delete their own; ADMIN may delete shared views; SUPER_ADMIN anything. */
export async function deleteView(id: string, userId: string, role: Role): Promise<void> {
  const v = await db.savedView.findUnique({ where: { id }, select: { id: true, ownerId: true, shared: true } })
  if (!v) throw new CrmError('NOT_FOUND', MSG.notFound)
  const allowed = v.ownerId === userId || role === 'SUPER_ADMIN' || (v.shared && roleAtLeast(role, 'ADMIN'))
  if (!allowed) throw new CrmError('DENIED', MSG.denied)
  await db.savedView.delete({ where: { id } })
}
