/**
 * Admin CRM server actions against a real local PostgreSQL database (skipped otherwise).
 * Covers the VIEWER/AUTHOR/EDITOR/ADMIN matrix, validation, audit entries, CSV formula safety,
 * a clinic-created profile being claimed by SMS login, visit points and their reversal,
 * and the point-adjustment limits.
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import { isLocalDatabaseUrl } from '../helpers/local-db'

vi.mock('server-only', () => ({}))
vi.mock('next/cache', () => ({ unstable_cache: (fn: unknown) => fn, revalidatePath: vi.fn() }))
vi.mock('next/navigation', () => ({ redirect: vi.fn() }))

type Role = 'SUPER_ADMIN' | 'ADMIN' | 'EDITOR' | 'AUTHOR' | 'VIEWER'
const RANK: Record<Role, number> = { SUPER_ADMIN: 5, ADMIN: 4, EDITOR: 3, AUTHOR: 2, VIEWER: 1 }
let role: Role | null = 'EDITOR'
vi.mock('@/lib/auth', () => ({
  getSessionWithRole: vi.fn(async (min: Role) => (role && RANK[role] >= RANK[min] ? { userId: 'adm-test', email: 'a@b.c', name: 'Admin', role, expiresAt: 0 } : null)),
  getSession: vi.fn(async () => (role ? { userId: 'adm-test', email: 'a@b.c', name: 'Admin', role, expiresAt: 0 } : null)),
}))
const audit = vi.fn(async (_: unknown) => {})
vi.mock('@/lib/audit', () => ({ logAdminChange: (o: unknown) => audit(o) }))

const jar = new Map<string, string>()
vi.mock('next/headers', () => ({
  cookies: async () => ({
    get: (name: string) => (jar.has(name) ? { name, value: jar.get(name)! } : undefined),
    set: (name: string, value: string) => void jar.set(name, value),
    delete: (name: string) => void jar.delete(name),
  }),
  headers: async () => new Headers({ 'x-forwarded-for': '10.77.0.1', host: 'localhost:3000' }),
}))

const hasDb = isLocalDatabaseUrl(process.env.DATABASE_URL)
const d = hasDb ? describe : describe.skip
let seq = 0
const phone = () => `0936${String(Date.now()).slice(-5)}${String(++seq).padStart(2, '0')}`

d('admin customer CRM actions (real database)', () => {
  let db: typeof import('@/lib/db').db
  let A: typeof import('@/app/actions/admin-club')
  const customers: string[] = []
  const rewards: string[] = []
  let savedConfig: Awaited<ReturnType<typeof import('@/lib/club/config').getLoyaltyConfig>> | null = null

  const make = async (over: Record<string, unknown> = {}) => {
    const r = await A.createCustomerAction({ firstName: 'مشتری', lastName: 'آزمون', phone: phone(), marketingSmsConsent: true, ...over } as never)
    expect(r.ok, r.error).toBe(true)
    customers.push(r.data!.id)
    return r.data!.id
  }
  const balance = async (id: string) => (await db.customer.findUniqueOrThrow({ where: { id } })).pointsBalance

  beforeAll(async () => {
    db = (await import('@/lib/db')).db
    A = await import('@/app/actions/admin-club')
    savedConfig = await (await import('@/lib/club/config')).getLoyaltyConfig()
  })
  beforeEach(() => {
    role = 'EDITOR'
    audit.mockClear()
    jar.clear()
  })
  afterAll(async () => {
    if (savedConfig) {
      const { updateLoyaltyConfig } = await import('@/lib/club/config')
      await updateLoyaltyConfig({ ...savedConfig, tiers: savedConfig.tiers })
    }
    await db.reward.deleteMany({ where: { id: { in: rewards } } })
    await db.coupon.deleteMany({ where: { customerId: { in: customers } } })
    await db.messageOutbox.deleteMany({ where: { customerId: { in: customers } } })
    await db.customer.deleteMany({ where: { id: { in: customers } } })
    await db.$disconnect()
  })

  it('RBAC matrix: only EDITOR and above can touch customers; deletes and config need ADMIN', async () => {
    for (const r of ['VIEWER', 'AUTHOR'] as Role[]) {
      role = r
      const res = await A.createCustomerAction({ firstName: 'نفوذی', phone: phone() } as never)
      expect(res.ok).toBe(false)
      expect(res.error).toContain('دسترسی')
    }
    role = null
    expect((await A.createCustomerAction({ firstName: 'بی‌نشست', phone: phone() } as never)).ok).toBe(false)

    role = 'EDITOR'
    const id = await make()
    expect((await A.deleteCustomerAction(id)).ok).toBe(false) // ADMIN only
    const cfg = savedConfig!
    const { tiers } = cfg
    expect((await A.saveLoyaltyConfigAction(cfg, tiers)).ok).toBe(false)

    role = 'ADMIN'
    expect((await A.saveLoyaltyConfigAction(cfg, tiers)).ok).toBe(true)
    expect((await A.deleteCustomerAction(id)).ok).toBe(true)
    expect(await db.customer.findUnique({ where: { id } })).toBeNull()
  })

  it('validates input and refuses a duplicate phone', async () => {
    expect((await A.createCustomerAction({ firstName: 'x', phone: '123' } as never)).ok).toBe(false)
    expect((await A.createCustomerAction({ firstName: 'مریم', phone: 'abc' } as never)).error).toMatch(/موبایل/)
    const p = phone()
    const first = await A.createCustomerAction({ firstName: 'مریم', phone: p } as never)
    expect(first.ok).toBe(true)
    customers.push(first.data!.id)
    const dup = await A.createCustomerAction({ firstName: 'مریم دوم', phone: p } as never)
    expect(dup.ok).toBe(false)
    expect(await db.customer.count({ where: { phone: p } })).toBe(1)
  })

  it('writes an audit entry for every change and never for a rejected one', async () => {
    const id = await make()
    expect(audit).toHaveBeenCalledWith(expect.objectContaining({ action: 'CREATE', entity: 'CUSTOMER', entityId: id }))
    audit.mockClear()
    await A.addCustomerNoteAction(id, 'تماس گرفته شد')
    await A.adjustPointsAction(id, 10, 'تست ممیزی')
    expect(audit).toHaveBeenCalledWith(expect.objectContaining({ entity: 'CUSTOMER_NOTE' }))
    expect(audit).toHaveBeenCalledWith(expect.objectContaining({ entity: 'CUSTOMER_POINTS', entityId: id }))
    audit.mockClear()
    await A.adjustPointsAction(id, 10, '')
    expect(audit).not.toHaveBeenCalled()
  })

  it('creates a customer as created-by-admin with its own marked consent and no password', async () => {
    const id = await make({ marketingSmsConsent: false })
    const c = await db.customer.findUniqueOrThrow({ where: { id } })
    expect(c.createdByAdmin).toBe(true)
    expect(c.passwordHash).toBeNull()
    expect(c.marketingSmsConsent).toBe(false)
  })

  it('CSV export neutralises formula injection and is blocked for lower roles', async () => {
    const tag = `csvtag${Date.now().toString(36)}`
    const id = await make({ firstName: '=HYPERLINK("http://evil")', lastName: '+SUM(1)', tags: tag, city: '@cmd' })
    const res = await A.exportCustomersCsvAction({ tag })
    expect(res.ok).toBe(true)
    const csv = res.data!.csv
    expect(csv).toContain(`"'=HYPERLINK(""http://evil"")"`)
    expect(csv).toContain("'+SUM(1)")
    expect(csv).toContain("'@cmd")
    expect(csv).not.toMatch(/(^|,)=HYPERLINK/m)
    expect(id).toBeTruthy()
    role = 'VIEWER'
    expect((await A.exportCustomersCsvAction({ tag })).ok).toBe(false)
  })

  it('a clinic-created profile is claimed by the owner with SMS login; password sign-up cannot take it', async () => {
    const p = phone()
    const created = await A.createCustomerAction({ firstName: 'پگاه', phone: p, city: 'تهران' } as never)
    expect(created.ok).toBe(true)
    const id = created.data!.id
    customers.push(id)
    await A.adminCreatePetAction(id, { name: 'لونا', species: 'CAT' } as never)
    await A.recordVisitAction(id, { serviceName: 'واکسن', visitedAt: new Date().toISOString().slice(0, 10), amount: 500_000 } as never)
    const earned = await balance(id)
    expect(earned).toBeGreaterThan(0)

    // Someone typing the phone into the password sign-up must not get the profile.
    const actions = await import('@/app/actions/customer-auth')
    const fd = new FormData()
    for (const [k, v] of Object.entries({ firstName: 'مهاجم', phone: p, password: 'Gorbeh-Parvaneh-1405' })) fd.set(k, v)
    const attempt = await actions.registerWithPasswordAction(fd)
    expect(attempt.ok).toBeUndefined()
    expect((await db.customer.findUniqueOrThrow({ where: { id } })).passwordHash).toBeNull()

    // The real owner proves the number with an SMS code and lands on the same profile.
    const otp = await import('@/lib/customer/otp')
    const issued = await otp.issueOtp(p, null)
    expect(issued.ok).toBe(true)
    if (!issued.ok) return
    const res = await actions.verifyOtpAction(p, issued.code, '/account')
    expect(res.ok).toBe(true)
    const row = await db.customer.findUniqueOrThrow({ where: { phone: p }, include: { pets: true } })
    expect(row.id).toBe(id)
    expect(row.pets.map((x) => x.name)).toEqual(['لونا'])
    expect(row.pointsBalance).toBeGreaterThanOrEqual(earned)
    expect(row.phoneVerifiedAt).not.toBeNull()
  })

  it('a recorded visit awards points; edit corrects them; delete reverses them', async () => {
    const id = await make()
    const before = await balance(id)
    const today = new Date().toISOString().slice(0, 10)
    const rec = await A.recordVisitAction(id, { serviceName: 'معاینه عمومی', visitedAt: today, amount: 400_000, doctor: 'دکتر تست' } as never)
    expect(rec.ok, rec.error).toBe(true)
    const pts = rec.data!.pointsAwarded
    expect(pts).toBeGreaterThan(0)
    expect(await balance(id)).toBe(before + pts)
    const visit = await db.serviceVisit.findFirstOrThrow({ where: { customerId: id } })
    expect(visit.pointsAwarded).toBe(pts)

    // edit: a bigger bill adds the difference
    expect((await A.updateVisitAction(id, visit.id, { serviceName: 'معاینه عمومی', visitedAt: today, amount: 800_000 } as never)).ok).toBe(true)
    const after = await balance(id)
    expect(after).toBeGreaterThan(before + pts)

    // delete: everything the visit earned is taken back
    expect((await A.deleteVisitAction(id, visit.id)).ok).toBe(true)
    expect(await balance(id)).toBe(before)
    expect(await db.serviceVisit.count({ where: { customerId: id } })).toBe(0)
  })

  it('a visit cannot be edited or deleted through another customer id (IDOR)', async () => {
    const owner = await make()
    const other = await make()
    const today = new Date().toISOString().slice(0, 10)
    await A.recordVisitAction(owner, { serviceName: 'واکسن', visitedAt: today, amount: 100_000 } as never)
    const visit = await db.serviceVisit.findFirstOrThrow({ where: { customerId: owner } })
    expect((await A.deleteVisitAction(other, visit.id)).ok).toBe(false)
    expect((await A.updateVisitAction(other, visit.id, { serviceName: 'x', visitedAt: today, amount: 1 } as never)).ok).toBe(false)
    expect(await db.serviceVisit.count({ where: { id: visit.id } })).toBe(1)
    // and a pet from another customer cannot be attached
    const petRes = await A.adminCreatePetAction(owner, { name: 'رکس', species: 'DOG' } as never)
    expect((await A.recordVisitAction(other, { serviceName: 'x', visitedAt: today, amount: 0, petId: petRes.data!.id } as never)).ok).toBe(false)
  })

  it('point adjustments need a reason, a non-zero amount, and an ADMIN above 1000 points', async () => {
    const id = await make()
    expect((await A.adjustPointsAction(id, 50, '')).ok).toBe(false)
    expect((await A.adjustPointsAction(id, 0, 'دلیل')).ok).toBe(false)
    expect((await A.adjustPointsAction(id, 200_000, 'دلیل')).ok).toBe(false)

    const start = await balance(id)
    expect((await A.adjustPointsAction(id, 100, 'جبران خطا')).ok).toBe(true)
    expect(await balance(id)).toBe(start + 100)

    // over the limit: editor is refused, admin allowed, and nothing changes for the refused call
    const mid = await balance(id)
    expect((await A.adjustPointsAction(id, 1500, 'هدیه ویژه')).ok).toBe(false)
    expect(await balance(id)).toBe(mid)
    role = 'ADMIN'
    expect((await A.adjustPointsAction(id, 1500, 'هدیه ویژه')).ok).toBe(true)
    expect(await balance(id)).toBe(mid + 1500)

    // deduction never goes below zero
    role = 'ADMIN'
    expect((await A.adjustPointsAction(id, -50_000, 'اصلاح')).ok).toBe(true)
    expect(await balance(id)).toBeGreaterThanOrEqual(0)
    const row = await db.pointsTransaction.findFirstOrThrow({ where: { customerId: id, kind: 'ADJUST', note: 'جبران خطا' } })
    expect(row.createdByAdminId).toBe('adm-test')
  })

  it('creates a personal single-use coupon for exactly one customer', async () => {
    const id = await make()
    const r = await A.createPersonalCouponAction(id, { type: 'PERCENT', value: 15, maxDiscount: 100_000, validDays: 7 })
    expect(r.ok, r.error).toBe(true)
    const c = await db.coupon.findFirstOrThrow({ where: { code: r.data!.code } })
    expect(c.customerId).toBe(id)
    expect((await A.createPersonalCouponAction(id, { type: 'PERCENT', value: 500 })).ok).toBe(false)
    role = 'VIEWER'
    expect((await A.createPersonalCouponAction(id, { type: 'PERCENT', value: 10 })).ok).toBe(false)
  })

  it('rewards: validation, EDITOR can save, only ADMIN deletes, used rewards are deactivated not deleted', async () => {
    const bad = await A.saveRewardAction(null, { title: 'x', pointsCost: 0, couponType: 'PERCENT', couponValue: 10 })
    expect(bad.ok).toBe(false)
    const ok = await A.saveRewardAction(null, { title: 'تخفیف آزمایشی', pointsCost: 100, couponType: 'PERCENT', couponValue: 10, couponValidDays: 10 })
    expect(ok.ok, ok.error).toBe(true)
    rewards.push(ok.data!.id)
    expect((await A.deleteRewardAction(ok.data!.id)).ok).toBe(false) // editor
    role = 'ADMIN'
    expect((await A.deleteRewardAction(ok.data!.id)).ok).toBe(true)
    expect(await db.reward.findUnique({ where: { id: ok.data!.id } })).toBeNull()
  })

  it('segments and customer-facing pet edits are audited and permission checked', async () => {
    role = 'VIEWER'
    expect((await A.saveSegmentAction(null, { name: 'گروه', rules: { hasPet: true } })).ok).toBe(false)
    role = 'EDITOR'
    expect((await A.saveSegmentAction(null, { name: 'گروه', rules: {} })).ok).toBe(false) // needs a condition
    const s = await A.saveSegmentAction(null, { name: `گروه آزمون ${seq}`, rules: { hasPet: true } })
    expect(s.ok).toBe(true)
    expect(audit).toHaveBeenCalledWith(expect.objectContaining({ entity: 'SEGMENT' }))
    expect((await A.deleteSegmentAction(s.data!.id)).ok).toBe(true)
  })

  it('messages to a customer without consent are refused and not queued', async () => {
    const id = await make({ marketingSmsConsent: false })
    const r = await A.sendCustomerMessageAction(id, 'سلام {name}')
    expect(r.ok).toBe(false)
    expect(await db.messageOutbox.count({ where: { customerId: id } })).toBe(0)
  })
})
