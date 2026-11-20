/** Bulk and inline product edits against a real local PostgreSQL (skipped otherwise). */
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
  getSessionWithRole: vi.fn(async (min: Role) => (role && RANK[role] >= RANK[min] ? { userId: 'prod-adm', email: 'a@b.c', name: 'A', role, expiresAt: 0 } : null)),
  getSession: vi.fn(async () => (role ? { userId: 'prod-adm', email: 'a@b.c', name: 'A', role, expiresAt: 0 } : null)),
}))
vi.mock('@/lib/audit', () => ({ logAdminChange: vi.fn(async () => {}) }))

const d = isLocalDatabaseUrl(process.env.DATABASE_URL) ? describe : describe.skip
const RUN = Date.now().toString(36)

d('Products bulk actions (real database)', () => {
  let db: typeof import('@/lib/db').db
  let act: typeof import('@/app/actions/products')
  const ids: string[] = []
  let cat1 = ''
  let cat2 = ''

  beforeAll(async () => {
    db = (await import('@/lib/db')).db
    act = await import('@/app/actions/products')
    cat1 = (await db.productCategory.create({ data: { slugFa: `b1-${RUN}`, nameFa: `الف ${RUN}`, nameEn: `a ${RUN}` } as never })).id
    cat2 = (await db.productCategory.create({ data: { slugFa: `b2-${RUN}`, nameFa: `ب ${RUN}`, nameEn: `b ${RUN}` } as never })).id
    for (const [i, price] of [100_000, 250_000, 1_000].entries()) {
      ids.push((await db.product.create({ data: { categoryId: cat1, nameFa: `محصول ${i} ${RUN}`, slugFa: `bp-${i}-${RUN}`, sku: `BP-${i}-${RUN}`, price } as never })).id)
    }
  })

  afterAll(async () => {
    await db.product.deleteMany({ where: { id: { in: ids } } })
    await db.productCategory.deleteMany({ where: { id: { in: [cat1, cat2] } } })
  })

  it('preview changes nothing; apply is atomic and refuses if any price becomes invalid', async () => {
    const prev = await act.bulkAdjustPricesAction(ids, { mode: 'amount', value: -5_000 }, true)
    expect(prev.preview?.map((p) => p.after)).toEqual([95_000, 245_000, null])
    expect((await db.product.findUnique({ where: { id: ids[0] } }))?.price).toBe(100_000)
    const refused = await act.bulkAdjustPricesAction(ids, { mode: 'amount', value: -5_000 }, false)
    expect(refused.error).toBeTruthy()
    expect((await db.product.findUnique({ where: { id: ids[0] } }))?.price).toBe(100_000)
    const ok = await act.bulkAdjustPricesAction(ids.slice(0, 2), { mode: 'percent', value: 10, round: 1000 }, false)
    expect(ok.success).toBe(true)
    const rows = await db.product.findMany({ where: { id: { in: ids.slice(0, 2) } }, orderBy: { sku: 'asc' } })
    expect(rows.map((r) => r.price)).toEqual([110_000, 275_000])
  })

  it('price apply needs ADMIN; preview works for editors', async () => {
    role = 'EDITOR'
    expect((await act.bulkAdjustPricesAction(ids, { mode: 'percent', value: 5 }, true)).success).toBe(true)
    expect((await act.bulkAdjustPricesAction(ids, { mode: 'percent', value: 5 }, false)).error).toBe('دسترسی غیرمجاز.')
    role = 'VIEWER'
    expect((await act.bulkSetProductsActiveAction(ids, false)).error).toBe('دسترسی غیرمجاز.')
    role = 'ADMIN'
  })

  it('bulk activate, hide and move category', async () => {
    expect((await act.bulkSetProductsActiveAction(ids, false)).success).toBe(true)
    expect(await db.product.count({ where: { id: { in: ids }, isActive: false } })).toBe(3)
    expect((await act.bulkSetProductsActiveAction(ids, true)).success).toBe(true)
    expect((await act.bulkSetProductsCategoryAction(ids, cat2)).success).toBe(true)
    expect(await db.product.count({ where: { id: { in: ids }, categoryId: cat2 } })).toBe(3)
    expect((await act.bulkSetProductsCategoryAction(ids, 'nope')).error).toBeTruthy()
    expect((await act.bulkSetProductsActiveAction([], true)).error).toBeTruthy()
  })

  it('inline edit validates price and stock status', async () => {
    expect((await act.quickUpdateProductAction(ids[2], { price: 0 })).error).toBeTruthy()
    expect((await act.quickUpdateProductAction(ids[2], { price: 1.5 })).error).toBeTruthy()
    expect((await act.quickUpdateProductAction(ids[2], { stockStatus: 'WHATEVER' })).error).toBeTruthy()
    expect((await act.quickUpdateProductAction(ids[2], { price: 2_000, stockStatus: 'IN_STOCK' })).success).toBe(true)
    const p = await db.product.findUnique({ where: { id: ids[2] } })
    expect(p).toMatchObject({ price: 2_000, stockStatus: 'IN_STOCK' })
    expect((await act.quickUpdateProductAction('missing', { price: 5 })).error).toBeTruthy()
  })
})
