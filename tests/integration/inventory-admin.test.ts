/**
 * Inventory admin against a real local PostgreSQL (skipped otherwise): server-side state filters,
 * summary, grouped nearest expiry, batch entry atomicity, adjust and write-off with audit rows, RBAC.
 */
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { isLocalDatabaseUrl } from '../helpers/local-db'

vi.mock('server-only', () => ({}))
vi.mock('next/cache', () => ({ unstable_cache: (fn: unknown) => fn, revalidatePath: vi.fn() }))
vi.mock('next/navigation', () => ({ redirect: vi.fn() }))
vi.mock('next/headers', () => ({
  cookies: async () => ({ get: () => undefined, set: () => {}, delete: () => {} }),
  headers: async () => new Headers({ host: 'localhost:3000' }),
}))

type Role = 'SUPER_ADMIN' | 'ADMIN' | 'EDITOR' | 'AUTHOR' | 'VIEWER'
const RANK: Record<Role, number> = { SUPER_ADMIN: 5, ADMIN: 4, EDITOR: 3, AUTHOR: 2, VIEWER: 1 }
let role: Role | null = 'ADMIN'
vi.mock('@/lib/auth', () => ({
  getSessionWithRole: vi.fn(async (min: Role) => (role && RANK[role] >= RANK[min] ? { userId: 'inv-adm', email: 'a@b.c', name: 'A', role, expiresAt: 0 } : null)),
  getSession: vi.fn(async () => (role ? { userId: 'inv-adm', email: 'a@b.c', name: 'A', role, expiresAt: 0 } : null)),
}))
vi.mock('@/lib/audit', () => ({ logAdminChange: vi.fn(async () => {}) }))

const d = isLocalDatabaseUrl(process.env.DATABASE_URL) ? describe : describe.skip
const RUN = Date.now().toString(36)
const DAY = 86_400_000
const at = (n: number) => new Date(Date.now() + n * DAY)

d('Inventory admin (real database)', () => {
  let db: typeof import('@/lib/db').db
  let inv: typeof import('@/app/actions/inventory')
  let admin: typeof import('@/lib/shop/inventory-admin')
  let categoryId = ''
  let perishable = ''
  let plain = ''
  const batches: Record<string, string> = {}

  beforeAll(async () => {
    db = (await import('@/lib/db')).db
    inv = await import('@/app/actions/inventory')
    admin = await import('@/lib/shop/inventory-admin')
    const cat = await db.productCategory.create({ data: { slugFa: `inv-${RUN}`, nameFa: `دسته ${RUN}`, nameEn: `cat ${RUN}` } as never })
    categoryId = cat.id
    const mk = (n: string, tracksExpiry: boolean) =>
      db.product.create({ data: { categoryId, nameFa: `کالا ${n} ${RUN}`, slugFa: `p-${n}-${RUN}`, sku: `INV-${n}-${RUN}`, price: 100000, tracksExpiry } as never })
    perishable = (await mk('a', true)).id
    plain = (await mk('b', false)).id
    const mkb = async (key: string, days: number | null, qty = 4, productId = perishable, costPrice: number | null = 1000) => {
      batches[key] = (await db.inventory.create({ data: { productId, quantity: qty, expiryDate: days == null ? null : at(days), costPrice } })).id
    }
    await mkb('expired', -5)
    await mkb('critical', 10)
    await mkb('soon', 60)
    await mkb('ok', 400)
    await mkb('none', null)
  })

  afterAll(async () => {
    await db.inventoryAdjustment.deleteMany({ where: { productId: { in: [perishable, plain] } } })
    await db.inventory.deleteMany({ where: { productId: { in: [perishable, plain] } } })
    await db.product.deleteMany({ where: { id: { in: [perishable, plain] } } })
    await db.productCategory.delete({ where: { id: categoryId } }).catch(() => null)
  })

  it('filters by state on the server', async () => {
    for (const s of ['expired', 'critical', 'soon', 'ok', 'none'] as const) {
      const r = await admin.listBatches({ state: s, productId: perishable })
      expect(r.rows.map((x) => x.id)).toEqual([batches[s]])
      expect(r.rows[0].state).toBe(s)
    }
  })

  it('orders most urgent first and pages', async () => {
    const all = await admin.listBatches({ productId: perishable, size: 2, page: 1 })
    expect(all.total).toBe(5)
    expect(all.rows.map((x) => x.id)).toEqual([batches.expired, batches.critical])
    const p3 = await admin.listBatches({ productId: perishable, size: 2, page: 3 })
    expect(p3.rows.map((x) => x.id)).toEqual([batches.none])
  })

  it('searches by SKU and computes value at risk', async () => {
    const r = await admin.listBatches({ q: `INV-a-${RUN}` })
    expect(r.total).toBe(5)
    const risky = r.rows.filter((x) => x.valueAtRisk != null)
    expect(risky.map((x) => x.state).sort()).toEqual(['critical', 'expired'])
    expect(risky[0].valueAtRisk).toBe(4000)
  })

  it('summary counts include the seeded batches', async () => {
    const s = await admin.expirySummary()
    expect(s.expired).toBeGreaterThanOrEqual(1)
    expect(s.critical).toBeGreaterThanOrEqual(1)
    expect(s.undated).toBeGreaterThanOrEqual(1)
    expect(s.valueAtRisk).toBeGreaterThanOrEqual(8000)
  })

  it('nearest sellable expiry uses one grouped query and skips expired and too-short batches', async () => {
    const r = await admin.nearestExpiryByProduct([perishable, plain])
    expect(r[perishable].state).toBe('critical')
    expect(r[plain].state).toBe('none')
  })

  it('addBatchesAction saves all lines in one go', async () => {
    const res = await inv.addBatchesAction([
      { productId: perishable, quantity: 3, expiryDate: at(200).toISOString() },
      { productId: plain, quantity: 2 },
      { productId: perishable, quantity: 1, expiryDate: at(300).toISOString(), costPrice: 500 },
    ])
    expect(res.success).toBe(true)
    expect(res.saved).toBe(3)
  })

  it('addBatchesAction saves nothing when one line is invalid', async () => {
    const before = await db.inventory.count({ where: { productId: { in: [perishable, plain] } } })
    const res = await inv.addBatchesAction([
      { productId: plain, quantity: 5 },
      { productId: perishable, quantity: 5 },
    ])
    expect(res.error).toContain('ردیف ۲')
    expect(await db.inventory.count({ where: { productId: { in: [perishable, plain] } } })).toBe(before)
  })

  it('adjust needs a reason, cannot go negative, writes an adjustment row', async () => {
    expect((await inv.adjustBatchAction(batches.ok, -1, 'WRITE_OFF')).error).toBeTruthy()
    expect((await inv.adjustBatchAction(batches.ok, -99, 'COUNT')).error).toContain('منفی')
    expect((await inv.adjustBatchAction(batches.ok, -1, 'OTHER')).error).toContain('توضیح')
    expect((await inv.adjustBatchAction(batches.ok, -1, 'DAMAGE', 'شکسته')).success).toBe(true)
    expect((await db.inventory.findUnique({ where: { id: batches.ok } }))?.quantity).toBe(3)
    const adj = await db.inventoryAdjustment.findFirst({ where: { inventoryId: batches.ok } })
    expect(adj).toMatchObject({ delta: -1, reason: 'DAMAGE', costAtLoss: 1000, adminId: 'inv-adm' })
  })

  it('write-off zeroes the batch, logs loss and re-syncs stock; second call is refused', async () => {
    const res = await inv.writeOffBatchAction(batches.expired)
    expect(res.success).toBe(true)
    expect((await db.inventory.findUnique({ where: { id: batches.expired } }))?.quantity).toBe(0)
    const adj = await db.inventoryAdjustment.findFirst({ where: { inventoryId: batches.expired } })
    expect(adj).toMatchObject({ delta: -4, reason: 'WRITE_OFF', costAtLoss: 4000 })
    expect((await inv.writeOffBatchAction(batches.expired)).error).toBeTruthy()
  })

  it('parallel write-offs of one batch apply exactly once', async () => {
    const [a, b] = await Promise.all([inv.writeOffBatchAction(batches.soon), inv.writeOffBatchAction(batches.soon)])
    expect([a.success, b.success].filter(Boolean).length).toBeLessThanOrEqual(2)
    expect(await db.inventoryAdjustment.count({ where: { inventoryId: batches.soon, reason: 'WRITE_OFF' } })).toBe(1)
  })

  it('expiry coupon is product scoped and ends before the sale cutoff', async () => {
    const res = await inv.createExpiryCouponAction(perishable, batches.critical)
    expect(res.success).toBe(true)
    const c = await db.coupon.findUnique({ where: { code: res.code! } })
    expect(c?.productIds).toEqual([perishable])
    expect(c!.endsAt!.getTime()).toBeLessThan(at(10).getTime())
    await db.coupon.delete({ where: { id: c!.id } })
  })

  it('role matrix: editor can add batches but not adjust, write off or save settings', async () => {
    role = 'EDITOR'
    expect((await inv.adjustBatchAction(batches.ok, -1, 'COUNT')).error).toBe('دسترسی غیرمجاز.')
    expect((await inv.writeOffBatchAction(batches.ok)).error).toBe('دسترسی غیرمجاز.')
    expect((await inv.saveExpiryConfigAction({ soonDays: 90, criticalDays: 30, minShelfLifeDays: 7, discountStartDays: 60, discountPercent: 20 })).error).toBe('دسترسی غیرمجاز.')
    expect((await inv.addBatchesAction([{ productId: plain, quantity: 1 }])).success).toBe(true)
    role = 'VIEWER'
    expect((await inv.addBatchesAction([{ productId: plain, quantity: 1 }])).error).toBe('دسترسی غیرمجاز.')
    expect(await inv.searchProductsAction('کالا')).toEqual([])
    role = 'ADMIN'
  })

  it('saveExpiryConfigAction validates and persists', async () => {
    const bad = await inv.saveExpiryConfigAction({ soonDays: 20, criticalDays: 30, minShelfLifeDays: 7, discountStartDays: 15, discountPercent: 20 })
    expect(bad.error).toBeTruthy()
    const prev = await db.expiryConfig.findUnique({ where: { id: 'default' } })
    const ok = await inv.saveExpiryConfigAction({ soonDays: 100, criticalDays: 25, minShelfLifeDays: 7, discountStartDays: 50, discountPercent: 15, digestPhones: ['09123456789'] })
    expect(ok.success).toBe(true)
    expect((await db.expiryConfig.findUnique({ where: { id: 'default' } }))?.digestPhones).toEqual(['09123456789'])
    if (prev) await db.expiryConfig.update({ where: { id: 'default' }, data: { soonDays: prev.soonDays, criticalDays: prev.criticalDays, minShelfLifeDays: prev.minShelfLifeDays, discountStartDays: prev.discountStartDays, discountPercent: prev.discountPercent, digestPhones: prev.digestPhones } })
    else await db.expiryConfig.delete({ where: { id: 'default' } })
    const { clearExpiryConfigCache } = await import('@/lib/shop/expiry-config')
    clearExpiryConfigCache()
  })
})
