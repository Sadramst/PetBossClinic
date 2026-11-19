/**
 * Customer club against a real PostgreSQL database (skipped unless DATABASE_URL is local).
 * Covers idempotent and parallel point awards, no negative balances, reward redemption (bound
 * single-use coupon, no overspend, last-unit race), referrals credited once on both sides, the
 * real admin order action awarding and reversing points, pet IDOR/limits, visits and segments.
 */
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { isLocalDatabaseUrl } from '../helpers/local-db'

vi.mock('server-only', () => ({}))
vi.mock('next/cache', () => ({ unstable_cache: (fn: unknown) => fn, revalidatePath: vi.fn() }))
vi.mock('next/headers', () => ({
  headers: async () => new Headers({ 'x-forwarded-for': '10.9.8.7', host: 'localhost:3000' }),
  cookies: async () => ({ get: () => undefined, set: () => {}, delete: () => {} }),
}))
let currentCustomerId: string | null = null
vi.mock('@/lib/customer/session', () => ({
  getCustomer: async () => {
    if (!currentCustomerId) return null
    const { db } = await import('@/lib/db')
    return db.customer.findUnique({ where: { id: currentCustomerId } })
  },
  safeNext: (n: string | null | undefined, fallback = '/account') => (n && n.startsWith('/') ? n : fallback),
  setCustomerCookie: async () => {},
  clearCustomerCookie: async () => {},
}))
vi.mock('@/lib/auth', () => ({
  getSessionWithRole: async () => ({ role: 'ADMIN', userId: 'test-admin' }),
  getSession: async () => ({ role: 'ADMIN', userId: 'test-admin' }),
}))
vi.mock('@/lib/audit', () => ({ logAdminChange: vi.fn(async () => {}) }))

const hasDb = isLocalDatabaseUrl(process.env.DATABASE_URL)
const d = hasDb ? describe : describe.skip
const tag = `clb${Date.now().toString(36)}`

d('customer club (real database)', () => {
  let db: typeof import('@/lib/db').db
  const ids = { customers: [] as string[], rewards: [] as string[], orders: [] as string[], segments: [] as string[] }
  let seq = 0

  const newCustomer = async (over: Record<string, unknown> = {}) => {
    seq++
    const c = await db.customer.create({ data: { phone: `0937${String(Date.now() + seq).slice(-7)}`, firstName: 'آزمون', lastName: 'باشگاه', phoneVerifiedAt: new Date(), ...over } as never })
    ids.customers.push(c.id)
    return c
  }
  const balance = async (id: string) => (await db.customer.findUniqueOrThrow({ where: { id } })).pointsBalance
  const newOrder = async (customerId: string, over: Record<string, unknown> = {}) => {
    seq++
    const o = await db.order.create({
      data: {
        number: `TEST-${tag}-${seq}`,
        customerId,
        status: 'CONFIRMED',
        paymentMethod: 'COD',
        subtotal: 500_000,
        shippingFee: 0,
        total: 500_000,
        shipName: 'x',
        shipPhone: '09120000000',
        shipProvince: 'تهران',
        shipCity: 'تهران',
        shipAddress: 'x',
        shipPostal: '1938973111',
        ...over,
      } as never,
    })
    ids.orders.push(o.id)
    return o
  }

  beforeAll(async () => {
    db = (await import('@/lib/db')).db
    // Predictable rules for the whole file.
    const { updateLoyaltyConfig } = await import('@/lib/club/config')
    await updateLoyaltyConfig({
      enabled: true, pointsPerThousandToman: 1, serviceMultiplier: 1.5, signupBonus: 50, firstPetBonus: 30, petProfileBonus: 20,
      referralGiven: 150, referralJoined: 100, pointValueToman: 100,
    })
  })

  afterAll(async () => {
    await db.order.deleteMany({ where: { OR: [{ id: { in: ids.orders } }, { customerId: { in: ids.customers } }] } })
    const couponIds = (await db.rewardRedemption.findMany({ where: { customerId: { in: ids.customers } }, select: { couponId: true } })).flatMap((r) => (r.couponId ? [r.couponId] : []))
    await db.rewardRedemption.deleteMany({ where: { customerId: { in: ids.customers } } })
    await db.coupon.deleteMany({ where: { OR: [{ id: { in: couponIds } }, { customerId: { in: ids.customers } }] } })
    await db.reward.deleteMany({ where: { id: { in: ids.rewards } } })
    await db.segment.deleteMany({ where: { id: { in: ids.segments } } })
    await db.customer.deleteMany({ where: { id: { in: ids.customers } } })
    await db.$disconnect()
  })

  // ─── Points ────────────────────────────────────────────────────────────────

  it('awards a given reference exactly once, even under parallel requests', async () => {
    const { awardPoints } = await import('@/lib/club/points')
    const c = await newCustomer()
    const results = await Promise.all(Array.from({ length: 12 }, () => awardPoints(db, { customerId: c.id, kind: 'ORDER', points: 40, refType: 'order', refId: `o-${tag}-1` })))
    expect(results.filter((r) => r.applied)).toHaveLength(1)
    expect(await balance(c.id)).toBe(40)
    expect(await db.pointsTransaction.count({ where: { customerId: c.id } })).toBe(1)
    // Different references stack.
    await awardPoints(db, { customerId: c.id, kind: 'ORDER', points: 10, refId: `o-${tag}-2` })
    expect(await balance(c.id)).toBe(50)
  })

  it('keeps balance and ledger consistent and moves the tier with lifetime points', async () => {
    const { awardPoints } = await import('@/lib/club/points')
    const c = await newCustomer()
    await Promise.all(Array.from({ length: 10 }, (_, i) => awardPoints(db, { customerId: c.id, kind: 'ORDER', points: 150, refId: `big-${tag}-${i}` })))
    const fresh = await db.customer.findUniqueOrThrow({ where: { id: c.id } })
    expect(fresh.pointsBalance).toBe(1500)
    expect(fresh.lifetimePoints).toBe(1500)
    expect(fresh.tier).toBe('SILVER')
    const sum = await db.pointsTransaction.aggregate({ where: { customerId: c.id }, _sum: { points: true } })
    expect(sum._sum.points).toBe(1500)
  })

  it('never lets the balance go negative (adjustments and reversals are clipped)', async () => {
    const { awardPoints, adjustPoints, spendPoints } = await import('@/lib/club/points')
    const c = await newCustomer()
    await awardPoints(db, { customerId: c.id, kind: 'ORDER', points: 30, refId: `neg-${tag}` })
    const adj = await adjustPoints(db, { customerId: c.id, points: -500, note: 'اصلاح آزمون' })
    expect(adj.points).toBe(-30)
    expect(await balance(c.id)).toBe(0)
    expect((await adjustPoints(db, { customerId: c.id, points: -5, note: 'x' })).applied).toBe(false)
    expect((await adjustPoints(db, { customerId: c.id, points: 5, note: '  ' })).ok).toBe(false)
    expect((await spendPoints(db, { customerId: c.id, points: 1 })).error).toBe('insufficient')
    expect(await balance(c.id)).toBe(0)
  })

  it('refuses negative awards for earning kinds', async () => {
    const { awardPoints } = await import('@/lib/club/points')
    const c = await newCustomer()
    expect((await awardPoints(db, { customerId: c.id, kind: 'ORDER', points: -10, refId: `n-${tag}` })).ok).toBe(false)
  })

  // ─── Rewards ───────────────────────────────────────────────────────────────

  const makeReward = async (over: Record<string, unknown> = {}) => {
    const r = await db.reward.create({
      data: { title: `جایزه ${tag}`, pointsCost: 100, couponType: 'FIXED', couponValue: 50_000, couponMinSubtotal: 200_000, couponValidDays: 10, ...over } as never,
    })
    ids.rewards.push(r.id)
    return r
  }

  it('redeems a reward into a personal single-use coupon', async () => {
    const { awardPoints } = await import('@/lib/club/points')
    const { redeemRewardAction } = await import('@/app/actions/club')
    const c = await newCustomer()
    await awardPoints(db, { customerId: c.id, kind: 'ORDER', points: 250, refId: `rw-${tag}` })
    const reward = await makeReward()
    currentCustomerId = c.id
    const res = await redeemRewardAction(reward.id)
    expect(res.ok).toBe(true)
    expect(res.balance).toBe(150)
    const coupon = await db.coupon.findUniqueOrThrow({ where: { code: res.couponCode! } })
    expect(coupon).toMatchObject({ customerId: c.id, usageLimit: 1, perCustomerLimit: 1, source: 'reward', type: 'FIXED', value: 50_000, minSubtotal: 200_000 })
    expect(coupon.endsAt!.getTime()).toBeGreaterThan(Date.now() + 9 * 86_400_000)
    expect(await balance(c.id)).toBe(150)
    expect(await db.rewardRedemption.count({ where: { customerId: c.id, couponId: coupon.id } })).toBe(1)
    expect((await db.reward.findUniqueOrThrow({ where: { id: reward.id } })).redeemedCount).toBe(1)
    const ledger = await db.pointsTransaction.findFirstOrThrow({ where: { customerId: c.id, kind: 'REDEEM' } })
    expect(ledger.points).toBe(-100)
    currentCustomerId = null
  })

  it('cannot overspend: parallel redemptions with points for only two succeed twice', async () => {
    const { awardPoints } = await import('@/lib/club/points')
    const { redeemReward } = await import('@/lib/club/rewards')
    const c = await newCustomer()
    await awardPoints(db, { customerId: c.id, kind: 'ORDER', points: 250, refId: `os-${tag}` })
    const reward = await makeReward()
    const results = await Promise.all(Array.from({ length: 8 }, () => redeemReward(c.id, reward.id)))
    expect(results.filter((r) => r.ok)).toHaveLength(2)
    expect(await balance(c.id)).toBe(50)
    expect(await db.coupon.count({ where: { customerId: c.id, source: 'reward' } })).toBe(2)
    expect(await db.rewardRedemption.count({ where: { customerId: c.id } })).toBe(2)
    expect((await db.reward.findUniqueOrThrow({ where: { id: reward.id } })).redeemedCount).toBe(2)
  })

  it('last unit of stock goes to one person and the loser keeps their points', async () => {
    const { awardPoints } = await import('@/lib/club/points')
    const { redeemReward } = await import('@/lib/club/rewards')
    const a = await newCustomer()
    const b = await newCustomer()
    await awardPoints(db, { customerId: a.id, kind: 'ORDER', points: 200, refId: `st-a-${tag}` })
    await awardPoints(db, { customerId: b.id, kind: 'ORDER', points: 200, refId: `st-b-${tag}` })
    const reward = await makeReward({ stock: 1 })
    const [ra, rb] = await Promise.all([redeemReward(a.id, reward.id), redeemReward(b.id, reward.id)])
    expect([ra.ok, rb.ok].filter(Boolean)).toHaveLength(1)
    const loser = ra.ok ? b : a
    expect(await balance(loser.id)).toBe(200)
    expect(await db.coupon.count({ where: { customerId: loser.id } })).toBe(0)
    expect((await redeemReward(loser.id, reward.id)).error).toMatch(/موجودی/)
  })

  it('enforces the minimum tier and inactive rewards', async () => {
    const { awardPoints } = await import('@/lib/club/points')
    const { redeemReward } = await import('@/lib/club/rewards')
    const c = await newCustomer()
    await awardPoints(db, { customerId: c.id, kind: 'ORDER', points: 500, refId: `tr-${tag}` })
    const gold = await makeReward({ minTier: 'GOLD' })
    const off = await makeReward({ isActive: false })
    expect((await redeemReward(c.id, gold.id)).ok).toBe(false)
    expect((await redeemReward(c.id, off.id)).ok).toBe(false)
    expect(await balance(c.id)).toBe(500)
  })

  // ─── Referrals, signup, orders ─────────────────────────────────────────────

  it('signup hook: code, bonus once, timestamped consent; referral attaches only for new accounts', async () => {
    const { onCustomerCreated } = await import('@/lib/club/hooks')
    const { ensureReferralCode } = await import('@/lib/club/referrals')
    const referrer = await newCustomer()
    await onCustomerCreated(referrer.id)
    const code = (await db.customer.findUniqueOrThrow({ where: { id: referrer.id } })).referralCode!
    expect(code).toMatch(/^[A-Z2-9]{7}$/)
    expect(await ensureReferralCode(referrer.id)).toBe(code)

    const friend = await newCustomer()
    await Promise.all([onCustomerCreated(friend.id, { referralCode: code }), onCustomerCreated(friend.id, { referralCode: code })])
    const f = await db.customer.findUniqueOrThrow({ where: { id: friend.id } })
    expect(f.referredById).toBe(referrer.id)
    expect(f.pointsBalance).toBe(50)
    expect(f.marketingConsentAt).toBeNull() // signing up is not consent
    expect(f.marketingSmsConsent).toBe(false)
    expect(await db.pointsTransaction.count({ where: { customerId: friend.id, kind: 'SIGNUP' } })).toBe(1)

    // Self-referral and old accounts are refused.
    const loner = await newCustomer()
    await onCustomerCreated(loner.id)
    const ownCode = (await db.customer.findUniqueOrThrow({ where: { id: loner.id } })).referralCode!
    await onCustomerCreated(loner.id, { referralCode: ownCode })
    expect((await db.customer.findUniqueOrThrow({ where: { id: loner.id } })).referredById).toBeNull()
    const old = await newCustomer({ createdAt: new Date(Date.now() - 3 * 86_400_000) })
    const { attachReferral } = await import('@/lib/club/referrals')
    expect(await attachReferral(old.id, code)).toBe(false)
    expect(await attachReferral(friend.id, 'ZZZZZZZ')).toBe(false)
  })

  it('admin-created profiles skip the signup bonus until the owner signs in', async () => {
    const { createCustomerByAdmin } = await import('@/lib/club/customers-admin')
    const phone = `0936${String(Math.floor(Math.random() * 1e7)).padStart(7, '0')}`
    const res = await createCustomerByAdmin({ firstName: 'مشتری', lastName: 'حضوری', phone, tags: 'vip، کلینیک', city: 'تهران' })
    expect(res, JSON.stringify(res)).toMatchObject({ ok: true })
    ids.customers.push(res.id!)
    const c = await db.customer.findUniqueOrThrow({ where: { id: res.id! } })
    expect(c).toMatchObject({ createdByAdmin: true, pointsBalance: 0, marketingSmsConsent: false, tags: ['vip', 'کلینیک'] })
    expect(c.referralCode).toBeTruthy()
    const dup = await createCustomerByAdmin({ firstName: 'مشتری', phone })
    expect(dup.ok).toBe(false)
    expect((await createCustomerByAdmin({ firstName: 'x', phone: '123' })).ok).toBe(false)
  })

  it('delivered orders award points, update counters and credit the referral on both sides once; cancelling reverses', async () => {
    const { onCustomerCreated } = await import('@/lib/club/hooks')
    const { updateOrderAction } = await import('@/app/actions/admin-orders')
    const referrer = await newCustomer()
    await onCustomerCreated(referrer.id)
    const code = (await db.customer.findUniqueOrThrow({ where: { id: referrer.id } })).referralCode!
    const friend = await newCustomer()
    await onCustomerCreated(friend.id, { referralCode: code })
    const startFriend = await balance(friend.id) // 50 signup
    const startReferrer = await balance(referrer.id)

    const order = await newOrder(friend.id, { subtotal: 500_000, discount: 100_000, total: 400_000 })
    expect((await updateOrderAction(order.id, { status: 'PROCESSING' })).error).toBeUndefined()
    expect((await updateOrderAction(order.id, { status: 'SHIPPED' })).error).toBeUndefined()
    const delivered = await Promise.all([updateOrderAction(order.id, { status: 'DELIVERED' }), updateOrderAction(order.id, { status: 'DELIVERED' })])
    expect(delivered.filter((r) => r.ok)).toHaveLength(1)

    const f = await db.customer.findUniqueOrThrow({ where: { id: friend.id } })
    // 400 points from the order (500k - 100k discount) + 100 referral joined bonus
    expect(f.pointsBalance).toBe(startFriend + 400 + 100)
    expect(f).toMatchObject({ ordersCount: 1, totalSpent: 400_000 })
    expect(f.lastOrderAt).not.toBeNull()
    expect(await balance(referrer.id)).toBe(startReferrer + 150)

    // A second delivered order does not credit the referral again.
    const second = await newOrder(friend.id, { subtotal: 100_000, total: 100_000 })
    for (const s of ['PROCESSING', 'SHIPPED', 'DELIVERED'] as const) await updateOrderAction(second.id, { status: s })
    expect(await balance(referrer.id)).toBe(startReferrer + 150)
    expect(await db.pointsTransaction.count({ where: { customerId: referrer.id, kind: 'REFERRAL_GIVEN' } })).toBe(1)
    expect(await db.pointsTransaction.count({ where: { customerId: friend.id, kind: 'ORDER' } })).toBe(2)

    // Cancelling the first order takes its points back and fixes the counters.
    const cancel = await updateOrderAction(order.id, { status: 'CANCELLED' })
    if (cancel.ok) {
      const after = await db.customer.findUniqueOrThrow({ where: { id: friend.id } })
      expect(after.pointsBalance).toBe(startFriend + 100) // second order only: order + referral rewards were taken back
      expect(await balance(referrer.id)).toBe(startReferrer)
      expect(after.ordersCount).toBe(1)
      expect(await db.pointsTransaction.count({ where: { customerId: friend.id, kind: 'REVERSAL' } })).toBe(2)
      // Reversal is idempotent.
      const { onOrderUndelivered } = await import('@/lib/club/hooks')
      await onOrderUndelivered(order.id)
      expect(await balance(friend.id)).toBe(startFriend + 100)
      // Delivered again: the order earns again (new ledger cycle); the referral is not re-credited.
      const { onOrderDelivered } = await import('@/lib/club/hooks')
      await db.order.update({ where: { id: order.id }, data: { status: 'DELIVERED' } })
      await onOrderDelivered(order.id)
      await onOrderDelivered(order.id)
      expect(await balance(friend.id)).toBe(startFriend + 100 + 400)
      await db.order.update({ where: { id: order.id }, data: { status: 'CANCELLED' } })
      await onOrderUndelivered(order.id)
      expect(await balance(friend.id)).toBe(startFriend + 100)
    } else {
      // The status machine may forbid leaving DELIVERED; the reversal hook itself is still checked.
      const { onOrderUndelivered } = await import('@/lib/club/hooks')
      await db.order.update({ where: { id: order.id }, data: { status: 'CANCELLED' } })
      await onOrderUndelivered(order.id)
      await onOrderUndelivered(order.id)
      expect(await balance(friend.id)).toBe(startFriend + 100)
    }
  })

  // ─── Pets ──────────────────────────────────────────────────────────────────

  it('pet actions: ownership is enforced on every operation (IDOR)', async () => {
    const actions = await import('@/app/actions/pets')
    const owner = await newCustomer()
    const intruder = await newCustomer()
    currentCustomerId = owner.id
    const created = await actions.createPetAction({ name: '  مانی ', species: 'CAT', breed: 'پرشین' })
    expect(created.ok).toBe(true)
    const petId = created.id!
    const rec = await actions.addPetRecordAction(petId, { kind: 'VACCINE', title: 'سه‌گانه', doneAt: '2026-05-01', nextDueAt: '2027-05-01' })
    expect(rec.ok).toBe(true)

    currentCustomerId = intruder.id
    expect((await actions.updatePetAction(petId, { name: 'هک', species: 'DOG' })).ok).toBe(false)
    expect((await actions.deletePetAction(petId)).ok).toBe(false)
    expect((await actions.addPetRecordAction(petId, { kind: 'NOTE', title: 'x', doneAt: '2026-05-01' })).ok).toBe(false)
    expect((await actions.deletePetRecordAction(rec.id!)).ok).toBe(false)
    expect((await actions.setPetPhotoAction(petId, null)).ok).toBe(false)

    const pet = await db.pet.findUniqueOrThrow({ where: { id: petId } })
    expect(pet).toMatchObject({ name: 'مانی', species: 'CAT', isActive: true, customerId: owner.id })
    expect(await db.petRecord.count({ where: { petId } })).toBe(1)

    currentCustomerId = null
    expect((await actions.createPetAction({ name: 'x', species: 'DOG' })).needsLogin).toBe(true)
  })

  it('pet bonuses: first pet once, complete profile once per pet, records clear', async () => {
    const actions = await import('@/app/actions/pets')
    const c = await newCustomer()
    currentCustomerId = c.id
    const first = await actions.createPetAction({ name: 'رکس', species: 'DOG' })
    expect(first.bonus).toBe(30)
    const second = await actions.createPetAction({ name: 'لونا', species: 'DOG', breed: 'شیتزو', birthDate: '2023-02-01', weightKg: 6.5 })
    expect(second.bonus).toBe(20) // profile bonus only; first-pet bonus already given
    // Completing the first pet's profile later pays out once.
    const upd = await actions.updatePetAction(first.id!, { name: 'رکس', species: 'DOG', breed: 'لابرادور', birthDate: '2022-01-01', weightKg: 20 })
    expect(upd.bonus).toBe(20)
    const again = await actions.updatePetAction(first.id!, { name: 'رکس', species: 'DOG', breed: 'لابرادور', birthDate: '2022-01-01', weightKg: 21 })
    expect(again.bonus).toBe(0)
    expect(await balance(c.id)).toBe(70)
    // A weight record updates the pet's current weight.
    await actions.addPetRecordAction(first.id!, { kind: 'WEIGHT', title: 'وزن', doneAt: new Date().toISOString().slice(0, 10), valueNumber: 22.4 })
    expect((await db.pet.findUniqueOrThrow({ where: { id: first.id! } })).weightKg).toBe(22.4)
    currentCustomerId = null
  })

  it('validates pet input and enforces limits', async () => {
    const actions = await import('@/app/actions/pets')
    const { MAX_PETS, MAX_RECORDS_PER_PET } = await import('@/lib/club/pets')
    const c = await newCustomer()
    currentCustomerId = c.id
    expect((await actions.createPetAction({ name: '', species: 'DOG' })).ok).toBe(false)
    expect((await actions.createPetAction({ name: 'a'.repeat(41), species: 'DOG' })).ok).toBe(false)
    expect((await actions.createPetAction({ name: 'x', species: 'ALIEN' as never })).ok).toBe(false)
    expect((await actions.createPetAction({ name: 'x', species: 'DOG', birthDate: '2999-01-01' })).ok).toBe(false)
    expect((await actions.createPetAction({ name: 'x', species: 'DOG', weightKg: 9999 })).ok).toBe(false)
    expect((await actions.createPetAction({ name: 'x', species: 'DOG', microchip: '12ab' })).ok).toBe(false)

    const pet = await actions.createPetAction({ name: 'یک', species: 'DOG' })
    const past = (await actions.addPetRecordAction(pet.id!, { kind: 'CHECKUP', title: 't', doneAt: '2026-05-01', nextDueAt: '2026-04-01' })).error
    expect(past).toMatch(/موعد/)
    // Bulk-insert up to the cap directly, then the action refuses the next one.
    await db.petRecord.createMany({ data: Array.from({ length: MAX_RECORDS_PER_PET }, (_, i) => ({ petId: pet.id!, kind: 'NOTE' as const, title: `n${i}`, doneAt: new Date() })) })
    expect((await actions.addPetRecordAction(pet.id!, { kind: 'NOTE', title: 'extra', doneAt: '2026-05-01' })).ok).toBe(false)

    await db.pet.createMany({ data: Array.from({ length: MAX_PETS - 1 }, (_, i) => ({ customerId: c.id, name: `p${i}`, species: 'CAT' as const })) })
    const over = await actions.createPetAction({ name: 'خیلی', species: 'DOG' })
    expect(over.ok).toBe(false)
    expect(over.error).toMatch(/حداکثر/)
    currentCustomerId = null
  })

  it('photo upload validates type, signature and size; clinic records cannot be deleted by customers', async () => {
    const { createPetFor, setPetPhotoFor, addRecordFor, deleteRecordFor } = await import('@/lib/club/pets')
    const c = await newCustomer()
    const pet = await createPetFor(c.id, { name: 'عکس', species: 'DOG' })
    const png = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(100)]).toString('base64')
    expect((await setPetPhotoFor(c.id, pet.id!, `data:image/png;base64,${png}`)).ok).toBe(true)
    expect((await setPetPhotoFor(c.id, pet.id!, `data:image/png;base64,${Buffer.from('<script>alert(1)</script>').toString('base64')}`)).ok).toBe(false)
    expect((await setPetPhotoFor(c.id, pet.id!, 'data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=')).ok).toBe(false)
    expect((await setPetPhotoFor(c.id, pet.id!, 'https://evil.example/x.png')).ok).toBe(false)
    const big = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff]), Buffer.alloc(210 * 1024)]).toString('base64')
    expect((await setPetPhotoFor(c.id, pet.id!, `data:image/jpeg;base64,${big}`)).ok).toBe(false)
    expect((await setPetPhotoFor(c.id, pet.id!, null)).ok).toBe(true)

    const rec = await addRecordFor(c.id, pet.id!, { kind: 'SURGERY', title: 'عقیم‌سازی', doneAt: '2026-03-03' }, 'admin')
    expect((await deleteRecordFor(c.id, rec.id!)).ok).toBe(false)
    expect((await deleteRecordFor(c.id, rec.id!, { allowVisitRecords: true })).ok).toBe(true)
  })

  it('soft-deleted pets disappear from lists but keep their history; lifetime cap blocks bonus farming', async () => {
    const { createPetFor, deletePetFor, listPets, MAX_PETS } = await import('@/lib/club/pets')
    const c = await newCustomer()
    const p = await createPetFor(c.id, { name: 'موقت', species: 'CAT' })
    expect((await deletePetFor(c.id, p.id!)).ok).toBe(true)
    expect(await listPets(c.id)).toHaveLength(0)
    expect(await db.pet.count({ where: { id: p.id! } })).toBe(1)
    await db.pet.createMany({ data: Array.from({ length: MAX_PETS * 2 - 1 }, (_, i) => ({ customerId: c.id, name: `old${i}`, species: 'CAT' as const, isActive: false })) })
    expect((await createPetFor(c.id, { name: 'تازه', species: 'DOG' })).ok).toBe(false)
  })

  // ─── Visits ────────────────────────────────────────────────────────────────

  it('clinic visits award service points, correct them on edit and take them back on delete', async () => {
    const { recordVisit, updateVisit, deleteVisit } = await import('@/lib/club/visits')
    const { createPetFor } = await import('@/lib/club/pets')
    const c = await newCustomer()
    const other = await newCustomer()
    const pet = await createPetFor(c.id, { name: 'ویزیت', species: 'DOG' })
    const otherPet = await createPetFor(other.id, { name: 'دیگری', species: 'DOG' })

    expect((await recordVisit('adm', c.id, { serviceName: 'x', visitedAt: '2026-06-01', petId: otherPet.id })).ok).toBe(false)
    const before = await balance(c.id)
    const v = await recordVisit('adm', c.id, { serviceName: 'واکسیناسیون', visitedAt: '2026-06-01', amount: 400_000, petId: pet.id, doctor: 'دکتر آزمون' }, {
      record: { kind: 'VACCINE', title: 'هاری', doneAt: '2026-06-01', nextDueAt: '2027-06-01' },
    })
    expect(v.ok).toBe(true)
    expect(v.pointsAwarded).toBe(600) // 400 x 1.5
    expect(await balance(c.id)).toBe(before + 600)
    expect(await db.petRecord.count({ where: { visitId: v.id!, source: 'visit' } })).toBe(1)

    const up = await updateVisit('adm', v.id!, { serviceName: 'واکسیناسیون', visitedAt: '2026-06-01', amount: 200_000, petId: pet.id })
    expect(up.pointsAwarded).toBe(300)
    expect(await balance(c.id)).toBe(before + 300)

    expect((await deleteVisit('adm', v.id!)).ok).toBe(true)
    expect(await balance(c.id)).toBe(before)
    expect(await db.serviceVisit.count({ where: { id: v.id! } })).toBe(0)
    expect(await db.petRecord.count({ where: { visitId: v.id! } })).toBe(0)
  })

  // ─── Segments, cart, profile ───────────────────────────────────────────────

  it('segments find the right customers and report consent exclusions', async () => {
    const { previewSegment, segmentCustomerIds } = await import('@/lib/club/segments')
    const { createPetFor } = await import('@/lib/club/pets')
    const city = `شهر${tag}`
    const yes = await newCustomer({ city, tags: [tag], marketingSmsConsent: true })
    const no = await newCustomer({ city, tags: [tag], marketingSmsConsent: false })
    const blocked = await newCustomer({ city, tags: [tag], isBlocked: true })
    await createPetFor(yes.id, { name: 'رکس', species: 'DOG', breed: 'شیتزو', foodBrand: 'رویال کنین' })
    await createPetFor(no.id, { name: 'مینا', species: 'CAT' })
    void blocked

    const all = await previewSegment({ city })
    expect(all.count).toBe(1)
    expect(all.consentExcluded).toBe(1)
    expect(all.sample[0]).toMatchObject({ id: yes.id, petNames: ['رکس'] })
    expect((await previewSegment({ city, smsConsentOnly: false })).count).toBe(2)
    expect((await previewSegment({ city, species: ['DOG'], breedContains: 'شیت', foodBrandContains: 'رویال' })).count).toBe(1)
    expect((await previewSegment({ city, species: ['CAT'], breedContains: 'شیت' })).count).toBe(0)
    expect((await previewSegment({ city, tagsAny: [tag], hasPet: true })).count).toBe(1)
    expect(await segmentCustomerIds({ city, smsConsentOnly: false })).toHaveLength(2)

    // Birthday month (needs SQL) and the never-ordered flag.
    const bday = await newCustomer({ city, birthDate: new Date(Date.UTC(1990, 6, 15, 12)) })
    const hit = await previewSegment({ city, smsConsentOnly: false, birthdayMonth: 7 })
    expect(hit.sample.map((s) => s.id)).toEqual([bday.id])
    expect((await previewSegment({ city, smsConsentOnly: false, neverOrdered: true })).count).toBe(3)
  })

  it('cart snapshot: server prices, drops unknown products, ignores unchanged syncs, clears on order', async () => {
    const { syncCartSnapshot, clearCartSnapshot, getCartSnapshot, topCartedProducts } = await import('@/lib/club/cart')
    const cat = await db.productCategory.create({ data: { slugFa: `${tag}-cat`, nameFa: 'دسته آزمون باشگاه' } })
    const p = await db.product.create({ data: { categoryId: cat.id, slugFa: `${tag}-p`, nameFa: 'غذای آزمون', price: 250_000, stockStatus: 'IN_STOCK', isPurchasable: true } })
    const hidden = await db.product.create({ data: { categoryId: cat.id, slugFa: `${tag}-h`, nameFa: 'پنهان', price: 1, isActive: false, stockStatus: 'IN_STOCK' } })
    try {
      const c = await newCustomer()
      const res = await syncCartSnapshot(c.id, [
        { productId: p.id, quantity: 2 },
        { productId: p.id, quantity: 1 },
        { productId: hidden.id, quantity: 1 },
        { productId: 'nope', quantity: 1 },
      ])
      expect(res).toMatchObject({ ok: true, itemCount: 3, subtotal: 750_000 })
      const snap = await getCartSnapshot(c.id)
      expect(snap!.items).toEqual([{ productId: p.id, quantity: 3, name: 'غذای آزمون', price: 250_000, image: null }])
      const stamp = snap!.updatedAt.getTime()
      await syncCartSnapshot(c.id, [{ productId: p.id, quantity: 3 }])
      expect((await getCartSnapshot(c.id))!.updatedAt.getTime()).toBe(stamp)
      expect((await syncCartSnapshot(c.id, 'garbage')).ok).toBe(false)
      expect((await syncCartSnapshot(c.id, [{ productId: p.id, quantity: 0 }])).ok).toBe(false)
      expect((await topCartedProducts(500)).find((t) => t.productId === p.id)?.quantity).toBeGreaterThanOrEqual(3)

      await db.cartSnapshot.update({ where: { customerId: c.id }, data: { lastReminderAt: new Date() } })
      await clearCartSnapshot(c.id, 'order-1')
      expect(await getCartSnapshot(c.id)).toMatchObject({ itemCount: 0, recoveredOrderId: 'order-1' })
      await syncCartSnapshot(c.id, [])
      expect(await getCartSnapshot(c.id)).toBeNull()
    } finally {
      await db.product.deleteMany({ where: { id: { in: [p.id, hidden.id] } } })
      await db.productCategory.delete({ where: { id: cat.id } }).catch(() => {})
    }
  })

  it('marketing consent changes are timestamped; profile fields are saved; withdrawing is honoured', async () => {
    const { updateMarketingPrefsAction } = await import('@/app/actions/club')
    const { updateProfileAction } = await import('@/app/actions/customer-auth')
    const c = await newCustomer({ marketingSmsConsent: true })
    currentCustomerId = c.id
    expect((await updateMarketingPrefsAction(false)).ok).toBe(true)
    const off = await db.customer.findUniqueOrThrow({ where: { id: c.id } })
    expect(off.marketingSmsConsent).toBe(false)
    expect(off.marketingConsentAt).not.toBeNull()

    const form = new FormData()
    form.set('firstName', 'سارا')
    form.set('lastName', 'نمونه')
    form.set('birthDate', '1375/05/15')
    form.set('city', 'شیراز')
    form.set('gender', 'FEMALE')
    form.set('marketingSmsConsent', 'true')
    const res = await updateProfileAction(form)
    expect(res.error).toBeUndefined()
    const on = await db.customer.findUniqueOrThrow({ where: { id: c.id } })
    expect(on).toMatchObject({ city: 'شیراز', gender: 'FEMALE', marketingSmsConsent: true })
    expect(on.birthDate!.toISOString().slice(0, 10)).toBe('1996-08-05')
    expect(on.marketingConsentAt!.getTime()).toBeGreaterThanOrEqual(off.marketingConsentAt!.getTime())

    // A form without the optional fields leaves them alone.
    const plain = new FormData()
    plain.set('firstName', 'سارا')
    plain.set('lastName', 'نمونه')
    await updateProfileAction(plain)
    expect(await db.customer.findUniqueOrThrow({ where: { id: c.id } })).toMatchObject({ city: 'شیراز', marketingSmsConsent: true })
    currentCustomerId = null
  })
})
