/**
 * Pure helpers for the admin audit log view: Persian labels, query parsing
 * and a structural before/after diff. No server-only imports so they are unit testable.
 */

export const AUDIT_ACTION_FA: Record<string, string> = {
  CREATE: 'ایجاد',
  UPDATE: 'ویرایش',
  DELETE: 'حذف',
  BULK_DELETE: 'حذف دسته‌ای',
  MERGE: 'ادغام',
  IMPORT: 'ورود اطلاعات',
  EXPORT: 'خروجی گرفتن',
  LOGIN: 'ورود',
  LOGOUT: 'خروج',
}

export const AUDIT_ENTITY_FA: Record<string, string> = {
  PRODUCT: 'محصول',
  PRODUCT_CATEGORY: 'دسته‌بندی محصول',
  SERVICE: 'خدمت',
  SERVICE_VISIT: 'مراجعه',
  DIVISION: 'بخش درمانی',
  STAFF: 'کادر درمان',
  SITE_SETTING: 'تنظیمات سایت',
  SEO_SETTING: 'تنظیمات سئو',
  THEME: 'پوسته',
  FAQ: 'پرسش متداول',
  POST: 'مقاله',
  TESTIMONIAL: 'نظر مشتری',
  NAVIGATION_MENU: 'منو',
  HOMEPAGE_SECTION: 'بخش صفحه اصلی',
  SOCIAL_LINK: 'شبکه اجتماعی',
  USER: 'کاربر پنل',
  MEDIA: 'رسانه',
  CUSTOMER: 'مشتری',
  CUSTOMER_GROUP: 'گروه مشتریان',
  CUSTOMER_NOTE: 'یادداشت مشتری',
  CUSTOMER_POINTS: 'امتیاز مشتری',
  PET: 'حیوان خانگی',
  PET_RECORD: 'پرونده سلامت',
  ORDER: 'سفارش',
  INVENTORY_BATCH: 'محموله انبار',
  MESSAGE: 'پیام',
  LEAD: 'سرنخ',
  COUPON: 'کوپن',
  COUPON_BATCH: 'دسته کوپن',
  CAMPAIGN: 'کمپین',
  AUTOMATION: 'اتوماسیون',
  SEGMENT: 'بخش‌بندی',
  OUTBOX: 'صف پیامک',
  REWARD: 'جایزه باشگاه',
  LOYALTY_CONFIG: 'تنظیمات باشگاه',
  MARKETING_CONFIG: 'تنظیمات بازاریابی',
  MARKETING_CONTACT: 'مخاطب بازاریابی',
}

export function auditActionLabel(action: string): string {
  return AUDIT_ACTION_FA[action] ?? action
}
export function auditEntityLabel(entity: string): string {
  return AUDIT_ENTITY_FA[entity] ?? entity
}

export type AuditTone = 'ok' | 'warn' | 'danger' | 'info' | 'neutral'
export function auditActionTone(action: string): AuditTone {
  if (action === 'CREATE' || action === 'IMPORT') return 'ok'
  if (action === 'UPDATE') return 'warn'
  if (action === 'DELETE' || action === 'BULK_DELETE') return 'danger'
  if (action === 'MERGE') return 'info'
  return 'neutral'
}

export const AUDIT_PAGE_SIZES = [25, 50, 100] as const

export interface AuditQuery {
  entity: string
  action: string
  user: string
  q: string
  from: string
  to: string
  page: number
  size: number
}

type Raw = Record<string, string | string[] | undefined>
const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? ''
const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/
const TOKEN = /^[A-Za-z0-9_]{1,40}$/

function validDay(s: string): string {
  if (!ISO_DAY.test(s)) return ''
  const d = new Date(`${s}T00:00:00.000Z`)
  if (Number.isNaN(d.getTime())) return ''
  return d.toISOString().slice(0, 10) === s ? s : ''
}

/** Parse and sanitise searchParams. Anything malformed falls back to "no filter". */
export function parseAuditQuery(raw: Raw): AuditQuery {
  const entity = first(raw.entity)
  const action = first(raw.action)
  const user = first(raw.user)
  const page = Math.max(1, Math.min(10000, Math.floor(Number(first(raw.page))) || 1))
  const sizeN = Number(first(raw.size))
  return {
    entity: TOKEN.test(entity) ? entity : '',
    action: TOKEN.test(action) ? action : '',
    user: /^[A-Za-z0-9_-]{1,40}$/.test(user) ? user : '',
    q: first(raw.q).trim().slice(0, 80),
    from: validDay(first(raw.from)),
    to: validDay(first(raw.to)),
    page,
    size: (AUDIT_PAGE_SIZES as readonly number[]).includes(sizeN) ? sizeN : 50,
  }
}

/** Prisma `where` for AuditLog. `to` is inclusive of the whole day. */
export function buildAuditWhere(q: AuditQuery) {
  const where: Record<string, unknown> = {}
  if (q.entity) where.entity = q.entity
  if (q.action) where.action = q.action
  if (q.user) where.userId = q.user
  if (q.from || q.to) {
    const range: Record<string, Date> = {}
    if (q.from) range.gte = new Date(`${q.from}T00:00:00.000Z`)
    if (q.to) range.lt = new Date(new Date(`${q.to}T00:00:00.000Z`).getTime() + 86_400_000)
    where.createdAt = range
  }
  if (q.q) {
    where.OR = [
      { entityId: { contains: q.q, mode: 'insensitive' } },
      { ip: { contains: q.q } },
      { location: { contains: q.q, mode: 'insensitive' } },
    ]
  }
  return where
}

export interface DiffRow {
  path: string
  kind: 'added' | 'removed' | 'changed'
  before?: unknown
  after?: unknown
}

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)

/** Keys that are bookkeeping and not a real change. */
const IGNORED = new Set(['_actor', 'updatedAt', 'createdAt'])

/** Flat structural diff with dotted paths, bounded. Arrays are compared as values. */
export function diffAudit(before: unknown, after: unknown, limit = 200): DiffRow[] {
  const rows: DiffRow[] = []
  const walk = (b: unknown, a: unknown, path: string) => {
    if (rows.length >= limit) return
    if (isObj(b) && isObj(a)) {
      const keys = new Set([...Object.keys(b), ...Object.keys(a)])
      for (const k of [...keys].sort()) {
        if (!path && IGNORED.has(k)) continue
        walk(b[k], a[k], path ? `${path}.${k}` : k)
      }
      return
    }
    if (b == null && isObj(a)) {
      walk({}, a, path)
      return
    }
    if (a == null && isObj(b)) {
      walk(b, {}, path)
      return
    }
    if (JSON.stringify(b) === JSON.stringify(a)) return
    if (b === undefined || b === null) rows.push({ path, kind: 'added', after: a })
    else if (a === undefined || a === null) rows.push({ path, kind: 'removed', before: b })
    else rows.push({ path, kind: 'changed', before: b, after: a })
  }
  walk(before ?? undefined, after ?? undefined, '')
  return rows.map((r) => (r.path === '' ? { ...r, path: 'مقدار' } : r))
}

export function actorOf(after: unknown): { id?: string; email?: string; name?: string } | null {
  if (isObj(after) && isObj(after._actor)) return after._actor as { id?: string; email?: string; name?: string }
  return null
}

/** Human display of a JSON value inside a diff cell. */
export function fmtAuditValue(v: unknown): string {
  if (v === null) return 'خالی'
  if (v === undefined) return '—'
  if (typeof v === 'boolean') return v ? 'بله' : 'خیر'
  if (typeof v === 'string') return v.length > 300 ? `${v.slice(0, 300)}…` : v
  if (typeof v === 'number') return String(v)
  const s = JSON.stringify(v)
  return s.length > 300 ? `${s.slice(0, 300)}…` : s
}

const SENSITIVE = /password|passwd|secret|token|totp|apikey|api_key/i
/** Paths whose values must never be rendered in the audit view. */
export function isSensitivePath(path: string): boolean {
  return SENSITIVE.test(path)
}
