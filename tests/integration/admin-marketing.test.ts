/**
 * Admin marketing server actions against the real local database: RBAC, validation,
 * delete guards, bulk generation, groups, contacts, config and audit entries.
 */
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { isLocalDatabaseUrl } from '../helpers/local-db'

vi.mock('server-only', () => ({}))
vi.mock('next/cache', () => ({ unstable_cache: (fn: unknown) => fn, revalidatePath: vi.fn() }))
vi.mock('next/headers', () => ({
  headers: async () => new Headers({ 'x-forwarded-for': '10.9.8.7' }),
  cookies: async () => ({ get: () => undefined, set: () => {}, delete: () => {} }),
}))

type Role = 'SUPER_ADMIN' | 'ADMIN' | 'EDITOR' | 'AUTHOR' | 'VIEWER'
const RANK: Record<Role, number> = { SUPER_ADMIN: 5, ADMIN: 4, EDITOR: 3, AUTHOR: 2, VIEWER: 1 }
let actor: { userId: string; role: Role } | null = { userId: 'u-editor', role: 'EDITOR' }
vi.mock('@/lib/auth', () => ({
  getSession: async () => (actor ? { ...actor, email: 'a@b.c', name: 'x', expiresAt: 0 } : null),
  getSessionWithRole: async (min: Role) => (actor && RANK[actor.role] >= RANK[min] ? { ...actor, email: 'a@b.c', name: 'x', expiresAt: 0 } : null),
}))
const audit = vi.fn(async (_o: unknown) => {})
vi.mock('@/lib/audit', () => ({ logAdminChange: (o: unknown) => audit(o) }))

const hasDb = isLocalDatabaseUrl(process.env.DATABASE_URL)
const d = hasDb ? describe : describe.skip
const tag = `adm${Date.now().toString(36)}`.toUpperCase()

d('admin marketing actions (real database)', () => {
  let db: typeof import('@/lib/db').db
  let A: typeof import('@/app/actions/admin-marketing')
  const ids = { coupons: [] as string[], groups: [] as string[], customers: [] as string[], contacts: [] as string[], batches: [] as string[] }
  let seq = 0
  const as = (role: Role | null, userId = `u-${role}-${++seq}`) => {
    actor = role ? { userId, role } : null
  }
  const payload = (over: Record<string, unknown> = {}) => ({ title: 'آزمون ادمین', type: 'PERCENT', value: 15, code: `${tag}-${++seq}`, ...over })
  const track = <T extends { ok: boolean; data?: { id: string } }>(r: T): T => {
    if (r.ok && r.data) ids.coupons.push(r.data.id)
    return r
  }

  beforeAll(async () => {
    ;({ db } = await import('@/lib/db'))
    A = await import('@/app/actions/admin-marketing')
  })

  afterAll(async () => {
    if (!hasDb) return
    await db.coupon.deleteMany({ where: { OR: [{ id: { in: ids.coupons } }, { batchId: { in: ids.batches } }] } })
    await db.customerGroup.deleteMany({ where: { id: { in: ids.groups } } })
    await db.marketingContact.deleteMany({ where: { id: { in: ids.contacts } } })
    await db.customer.deleteMany({ where: { id: { in: ids.customers } } })
    await db.$disconnect()
  })

  it('refuses anonymous callers and roles below EDITOR on every write', async () => {
    for (const role of [null, 'VIEWER', 'AUTHOR'] as const) {
      as(role)
      expect((await A.saveCouponAction(null, payload() as never)).error).toBe('دسترسی غیرمجاز.')
      expect((await A.setCouponActiveAction('x', false)).ok).toBe(false)
      expect((await A.duplicateCouponAction('x')).ok).toBe(false)
      expect((await A.deleteCouponAction('x')).ok).toBe(false)
      expect((await A.bulkGenerateCouponsAction({})).ok).toBe(false)
      expect((await A.exportBatchCsvAction('x')).ok).toBe(false)
      expect((await A.createGroupAction({ name: 'ممنوع' })).ok).toBe(false)
      expect((await A.addGroupMembersAction('x', '09120000000')).ok).toBe(false)
      expect((await A.setContactUnsubscribedAction('x', true)).ok).toBe(false)
      expect((await A.exportContactsCsvAction()).ok).toBe(false)
      expect((await A.saveMarketingConfigAction({})).ok).toBe(false)
      expect(await A.searchProductsAction('abc')).toEqual([])
      expect((await A.getGroupMembersAction('x')).ok).toBe(false)
    }
    expect(await db.coupon.count({ where: { code: { startsWith: tag } } })).toBe(0)
  })

  it('creates, audits and edits a coupon; stores the code uppercase', async () => {
    as('EDITOR')
    audit.mockClear()
    const code = `${tag.toLowerCase()}-lower`
    const r = track(await A.saveCouponAction(null, payload({ code, maxDiscount: 50000, startsAt: '2026-01-01T00:00', endsAt: '2036-01-01T23:59' }) as never))
    expect(r.ok).toBe(true)
    const row = await db.coupon.findUniqueOrThrow({ where: { id: r.data!.id } })
    expect(row.code).toBe(code.toUpperCase())
    expect(row.maxDiscount).toBe(50000)
    expect(row.source).toBe('manual')
    expect(row.endsAt?.toISOString()).toBe('2036-01-01T20:29:00.000Z') // 23:59 Tehran
    expect(audit).toHaveBeenCalledWith(expect.objectContaining({ action: 'CREATE', entity: 'COUPON', entityId: row.id }))

    const up = await A.saveCouponAction(row.id, payload({ code: row.code, title: 'عنوان تازه', value: 20 }) as never)
    expect(up.ok).toBe(true)
    expect((await db.coupon.findUniqueOrThrow({ where: { id: row.id } })).title).toBe('عنوان تازه')
    expect(audit).toHaveBeenCalledWith(expect.objectContaining({ action: 'UPDATE', entity: 'COUPON' }))
  })

  it('generates a code when none is given, and rejects duplicates and bad characters', async () => {
    as('EDITOR')
    const auto = track(await A.saveCouponAction(null, payload({ code: '' }) as never))
    expect(auto.data?.code).toMatch(/^PB-[A-Z0-9]{4}-[A-Z0-9]{4}$/)
    const first = track(await A.saveCouponAction(null, payload() as never))
    const dup = await A.saveCouponAction(null, payload({ code: first.data!.code }) as never)
    expect(dup.ok).toBe(false)
    expect(dup.error).toContain('قبلاً')
    expect((await A.saveCouponAction(null, payload({ code: '!!!' }) as never)).ok).toBe(false)
  })

  it('returns Persian validation errors and writes nothing', async () => {
    as('EDITOR')
    const before = await db.coupon.count()
    for (const bad of [{ value: 0 }, { value: 500 }, { title: '' }, { type: 'NOPE' }, { endsAt: '2020-01-01T00:00', startsAt: '2021-01-01T00:00' }, { usageLimit: -1 }]) {
      const r = await A.saveCouponAction(null, payload(bad) as never)
      expect(r.ok).toBe(false)
      expect(r.error).toMatch(/[؀-ۿ]/)
    }
    expect(await db.coupon.count()).toBe(before)
  })

  it('binds personal coupons to a registered customer by mobile, and rejects unknown ones', async () => {
    as('EDITOR')
    const phone = `0937${String(Date.now()).slice(-7)}`
    const cust = await db.customer.create({ data: { phone, firstName: 'ا', lastName: 'ب' } })
    ids.customers.push(cust.id)
    const ok = track(await A.saveCouponAction(null, payload({ customerPhone: phone }) as never))
    expect(ok.ok).toBe(true)
    expect((await db.coupon.findUniqueOrThrow({ where: { id: ok.data!.id } })).customerId).toBe(cust.id)
    expect((await A.saveCouponAction(null, payload({ customerPhone: '09000000000' }) as never)).error).toContain('ثبت‌نام')
    expect((await A.saveCouponAction(null, payload({ customerPhone: '123' }) as never)).error).toContain('معتبر')
  })

  it('protects redeemed coupons: no delete, no code change, no limit below usage; allows deactivate', async () => {
    as('EDITOR')
    const r = track(await A.saveCouponAction(null, payload({ usageLimit: 5 }) as never))
    const id = r.data!.id
    await db.coupon.update({ where: { id }, data: { usedCount: 3 } })
    const del = await A.deleteCouponAction(id)
    expect(del.ok).toBe(false)
    expect(del.error).toContain('غیرفعال')
    expect(await db.coupon.findUnique({ where: { id } })).not.toBeNull()
    expect((await A.saveCouponAction(id, payload({ code: `${tag}-NEWCODE`, usageLimit: 5 }) as never)).error).toContain('قابل تغییر نیست')
    expect((await A.saveCouponAction(id, payload({ code: (await db.coupon.findUniqueOrThrow({ where: { id } })).code, usageLimit: 2 }) as never)).error).toContain('کمتر')
    expect((await A.setCouponActiveAction(id, false)).ok).toBe(true)
    expect((await db.coupon.findUniqueOrThrow({ where: { id } })).isActive).toBe(false)
  })

  it('deletes an unused coupon with an audit entry, and reports a missing one', async () => {
    as('EDITOR')
    const r = track(await A.saveCouponAction(null, payload() as never))
    audit.mockClear()
    expect((await A.deleteCouponAction(r.data!.id)).ok).toBe(true)
    expect(await db.coupon.findUnique({ where: { id: r.data!.id } })).toBeNull()
    expect(audit).toHaveBeenCalledWith(expect.objectContaining({ action: 'DELETE', entity: 'COUPON' }))
    expect((await A.deleteCouponAction(r.data!.id)).ok).toBe(false)
  })

  it('duplicates as an inactive, non-auto copy with a fresh code and zero usage', async () => {
    as('EDITOR')
    const src = track(await A.saveCouponAction(null, payload({ autoApply: true, usageLimit: 9 }) as never))
    await db.coupon.update({ where: { id: src.data!.id }, data: { usedCount: 2 } })
    const copy = track(await A.duplicateCouponAction(src.data!.id))
    expect(copy.ok).toBe(true)
    const row = await db.coupon.findUniqueOrThrow({ where: { id: copy.data!.id } })
    expect(row).toMatchObject({ isActive: false, autoApply: false, usedCount: 0, usageLimit: 9 })
    expect(row.code).not.toBe(src.data!.code)
  })

  it('bulk generates unique single-use codes with a batch id and CSV', async () => {
    as('ADMIN')
    expect((await A.bulkGenerateCouponsAction({ count: 5000, template: { title: 'x', type: 'PERCENT', value: 10 } })).ok).toBe(false)
    const r = await A.bulkGenerateCouponsAction({ count: 40, prefix: 'tst', template: { title: 'هدیه گروهی', type: 'FIXED', value: 25000 } })
    expect(r.ok).toBe(true)
    const { batchId, count, csv } = r.data!
    ids.batches.push(batchId)
    expect(count).toBe(40)
    const rows = await db.coupon.findMany({ where: { batchId } })
    expect(rows).toHaveLength(40)
    expect(new Set(rows.map((x) => x.code)).size).toBe(40)
    expect(rows.every((x) => x.usageLimit === 1 && x.perCustomerLimit === 1 && x.source === 'bulk' && x.code.startsWith('TST-'))).toBe(true)
    expect(csv.startsWith('﻿')).toBe(true)
    expect(csv.split('\r\n').filter(Boolean)).toHaveLength(41)
    const again = await A.exportBatchCsvAction(batchId)
    expect(again.data?.csv.split('\r\n').filter(Boolean)).toHaveLength(41)
  })

  it('manages groups: unique names, members by phone/email, removal, delete guard', async () => {
    as('EDITOR')
    const name = `گروه ${tag}`
    const g = await A.createGroupAction({ name })
    expect(g.ok).toBe(true)
    ids.groups.push(g.data!.id)
    expect((await A.createGroupAction({ name })).error).toContain('وجود دارد')
    expect((await A.createGroupAction({ name: '' })).ok).toBe(false)

    const phone = `0936${String(Date.now()).slice(-7)}`
    const email = `${tag.toLowerCase()}@example.com`
    const c1 = await db.customer.create({ data: { phone, firstName: 'م' } })
    const c2 = await db.customer.create({ data: { phone: `0935${String(Date.now()).slice(-7)}`, email } })
    ids.customers.push(c1.id, c2.id)

    const add = await A.addGroupMembersAction(g.data!.id, `${phone}\n${email.toUpperCase()} 09111111111 ${phone}`)
    expect(add.data).toMatchObject({ added: 2, already: 0 })
    expect(add.data?.missing).toEqual(['09111111111'])
    const again = await A.addGroupMembersAction(g.data!.id, phone)
    expect(again.data).toMatchObject({ added: 0, already: 1 })
    expect((await A.getGroupMembersAction(g.data!.id)).data?.members).toHaveLength(2)

    const withCoupon = track(await A.saveCouponAction(null, payload({ groupId: g.data!.id }) as never))
    expect((await A.deleteGroupAction(g.data!.id)).error).toContain('وابسته')
    await db.coupon.update({ where: { id: withCoupon.data!.id }, data: { groupId: null } })

    expect((await A.removeGroupMemberAction(g.data!.id, c1.id)).ok).toBe(true)
    expect((await A.removeGroupMemberAction(g.data!.id, c1.id)).ok).toBe(false)
    expect((await A.deleteGroupAction(g.data!.id)).ok).toBe(true)
    expect(await db.customerGroupMember.count({ where: { groupId: g.data!.id } })).toBe(0)
  })

  it('toggles unsubscribe and exports contacts as safe CSV with filters', async () => {
    as('EDITOR')
    const ct = await db.marketingContact.create({ data: { email: `=cmd-${tag.toLowerCase()}@example.com`, name: '=1+1', source: 'footer', consentAt: new Date() } })
    ids.contacts.push(ct.id)
    expect((await A.setContactUnsubscribedAction(ct.id, true)).ok).toBe(true)
    expect((await db.marketingContact.findUniqueOrThrow({ where: { id: ct.id } })).unsubscribedAt).not.toBeNull()
    expect((await A.setContactUnsubscribedAction(ct.id, false)).ok).toBe(true)
    expect((await db.marketingContact.findUniqueOrThrow({ where: { id: ct.id } })).unsubscribedAt).toBeNull()
    expect((await A.setContactUnsubscribedAction('missing-id', true)).ok).toBe(false)

    const csv = (await A.exportContactsCsvAction({ q: tag.toLowerCase(), source: 'footer' })).data!
    expect(csv.count).toBe(1)
    expect(csv.csv).toContain(`'=cmd-${tag.toLowerCase()}`)
    expect(csv.csv).toContain("'=1+1")
    expect((await A.exportContactsCsvAction({ q: tag.toLowerCase(), source: 'popup' })).data?.count).toBe(0)
  })

  it('saves campaign config with validation and an audit entry', async () => {
    as('EDITOR')
    const { getMarketingConfig, updateMarketingConfig } = await import('@/lib/marketing/config')
    const original = await getMarketingConfig()
    try {
      const good = {
        popupEnabled: true, popupTitle: 'تخفیف ویژه', popupText: 'شماره خود را وارد کنید', popupDelaySeconds: 5,
        welcomeEnabled: true, welcomeType: 'PERCENT', welcomeValue: 12, welcomeMaxDiscount: 90000, welcomeMinSubtotal: 100000, welcomeValidDays: 30,
        bannerEnabled: true, bannerText: 'ارسال رایگان این هفته', bannerLink: '/shop', bannerEndsAt: '2036-01-01T10:00', bannerCouponCode: '',
      }
      audit.mockClear()
      expect((await A.saveMarketingConfigAction(good)).ok).toBe(true)
      const saved = await getMarketingConfig()
      expect(saved).toMatchObject({ welcomeValue: 12, welcomeMaxDiscount: 90000, welcomeValidDays: 30, popupDelaySeconds: 5, bannerLink: '/shop' })
      expect(saved.bannerEndsAt?.toISOString()).toBe('2036-01-01T06:30:00.000Z')
      expect(audit).toHaveBeenCalledWith(expect.objectContaining({ entity: 'MARKETING_CONFIG' }))

      expect((await A.saveMarketingConfigAction({ ...good, welcomeValue: 400 })).ok).toBe(false)
      expect((await A.saveMarketingConfigAction({ ...good, bannerLink: 'javascript:alert(1)' })).ok).toBe(false)
      expect((await A.saveMarketingConfigAction({ ...good, bannerCouponCode: 'NO-SUCH-CODE-XYZ' })).error).toContain('وجود ندارد')
      // FIXED offers must not keep a percent cap
      expect((await A.saveMarketingConfigAction({ ...good, welcomeType: 'FIXED', welcomeValue: 30000 })).ok).toBe(true)
      expect((await getMarketingConfig()).welcomeMaxDiscount).toBeNull()
    } finally {
      const { id: _id, updatedAt: _u, ...restore } = original
      void _id
      void _u
      await updateMarketingConfig(restore)
    }
  })

  it('searches products only with 2+ characters', async () => {
    as('EDITOR')
    expect(await A.searchProductsAction('a')).toEqual([])
    expect(Array.isArray(await A.searchProductsAction('غذا'))).toBe(true)
  })

  it('report and list queries run against the schema', async () => {
    const q = await import('@/lib/marketing/admin-queries')
    const r = await q.marketingReport()
    expect(r.redemptions).toBeGreaterThanOrEqual(0)
    for (const status of ['active', 'inactive', 'expired', 'scheduled', 'used_up', '']) {
      const list = await q.listCoupons({ status, q: tag })
      expect(list.rows.every((x) => x.code.includes(tag) || x.title.includes(tag))).toBe(true)
    }
    expect((await q.listCoupons({ status: 'used_up', q: tag })).rows.every((x) => x.status === 'used_up')).toBe(true)
    expect((await q.listContacts({ q: tag.toLowerCase() })).total).toBeGreaterThanOrEqual(0)
    expect((await q.couponFormOptions()).batches.length).toBeGreaterThan(0)
  })
})
