/**
 * Club messaging against a real PostgreSQL database (skipped unless DATABASE_URL is local).
 * Covers the outbox rules (consent, quiet hours, daily cap, dedupe), double-cron safety with a fake
 * provider, campaign launch (snapshot, per-recipient coupons, cancel, stats), every automation rule
 * generating its rows exactly once, the abandoned-cart flow and the AI helper (fallback and no PII).
 */
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { isLocalDatabaseUrl } from '../helpers/local-db'

vi.mock('server-only', () => ({}))
vi.mock('next/cache', () => ({ unstable_cache: (fn: unknown) => fn, revalidatePath: vi.fn() }))

const hasDb = isLocalDatabaseUrl(process.env.DATABASE_URL)
const d = hasDb ? describe : describe.skip
const tag = `msg${Date.now().toString(36)}`
const TAG_SEGMENT = `tag-${tag}`
// 11:30 Tehran on a fixed day: never a quiet hour, so scheduling is predictable.
const NOON = new Date('2026-11-18T08:00:00Z')
const minutes = (d: Date, m: number) => new Date(d.getTime() + m * 60_000)
const days = (d: Date, n: number) => new Date(d.getTime() + n * 86_400_000)

d('club messaging (real database)', () => {
  let db: typeof import('@/lib/db').db
  const started = new Date()
  const ids = { customers: [] as string[], products: [] as string[], categories: [] as string[], brands: [] as string[], campaigns: [] as string[], contacts: [] as string[] }
  const ruleBackup = new Map<string, boolean>()
  let seq = 0

  const newCustomer = async (over: Record<string, unknown> = {}) => {
    seq++
    const c = await db.customer.create({
      data: { phone: `0936${String(Date.now() + seq).slice(-7)}`, firstName: 'آزمون', lastName: 'پیامک', phoneVerifiedAt: new Date(), marketingSmsConsent: true, ...over } as never,
    })
    ids.customers.push(c.id)
    return c
  }
  const sender = () => {
    const calls: Array<{ phone: string; text: string }> = []
    return { calls, send: async (phone: string, text: string) => { calls.push({ phone, text }); return { ok: true, ref: 'fake' } } }
  }

  beforeAll(async () => {
    db = (await import('@/lib/db')).db
    const { getAutomationRules } = await import('@/lib/club/automations')
    for (const r of await getAutomationRules()) ruleBackup.set(r.kind, r.enabled)
    const { updateLoyaltyConfig } = await import('@/lib/club/config')
    await updateLoyaltyConfig({ enabled: true, birthdayBonus: 100 })
  })

  afterAll(async () => {
    // Rules go back to how they were; whatever the scans created for other local rows is removed too.
    for (const [kind, enabled] of ruleBackup) await db.automationRule.update({ where: { kind }, data: { enabled } })
    const mine = { OR: [{ customerId: { in: ids.customers } }, { createdAt: { gte: started } }] }
    await db.messageOutbox.deleteMany({ where: mine })
    await db.coupon.deleteMany({ where: { OR: [{ customerId: { in: ids.customers } }, { source: { in: ['automation', 'campaign'] }, createdAt: { gte: started } }] } })
    await db.messageCampaign.deleteMany({ where: { id: { in: ids.campaigns } } })
    await db.order.deleteMany({ where: { customerId: { in: ids.customers } } })
    await db.marketingContact.deleteMany({ where: { id: { in: ids.contacts } } })
    await db.customer.deleteMany({ where: { id: { in: ids.customers } } })
    await db.product.deleteMany({ where: { id: { in: ids.products } } })
    await db.productCategory.deleteMany({ where: { id: { in: ids.categories } } })
    await db.brand.deleteMany({ where: { id: { in: ids.brands } } })
    await db.$disconnect()
  })

  // ─── Outbox rules ──────────────────────────────────────────────────────────

  it('enforces consent, unsubscribe, valid numbers, footer and system exemption', async () => {
    const { enqueueMessage } = await import('@/lib/club/messaging/outbox')
    const yes = await newCustomer()
    const no = await newCustomer({ marketingSmsConsent: false })
    const blocked = await newCustomer({ isBlocked: true })
    const unsub = await newCustomer()
    const contact = await db.marketingContact.create({ data: { phone: unsub.phone, source: 'footer', consentAt: new Date(), unsubscribedAt: new Date() } })
    ids.contacts.push(contact.id)

    expect(await enqueueMessage({ customerId: no.id, body: 'سلام', kind: 'campaign', now: NOON })).toEqual({ ok: false, reason: 'no_consent' })
    expect(await enqueueMessage({ customerId: blocked.id, body: 'سلام', kind: 'campaign', now: NOON })).toEqual({ ok: false, reason: 'blocked' })
    expect(await enqueueMessage({ customerId: unsub.id, body: 'سلام', kind: 'campaign', now: NOON })).toEqual({ ok: false, reason: 'unsubscribed' })
    expect(await enqueueMessage({ phone: '12345', body: 'سلام', kind: 'campaign', now: NOON })).toEqual({ ok: false, reason: 'invalid_phone' })
    expect(await enqueueMessage({ customerId: yes.id, body: '   ', kind: 'campaign', now: NOON })).toEqual({ ok: false, reason: 'empty' })
    expect(await enqueueMessage({ customerId: yes.id, body: 'ا'.repeat(700), kind: 'campaign', now: NOON })).toEqual({ ok: false, reason: 'too_long' })

    const ok = await enqueueMessage({ customerId: yes.id, body: 'سلام دوست عزیز', kind: 'campaign', now: NOON })
    expect(ok.ok).toBe(true)
    if (ok.ok) expect(ok.body).toContain('لغو: ارسال ۱')

    // Transactional messages ignore consent and get no footer.
    const sys = await enqueueMessage({ customerId: no.id, body: 'کد ورود شما', kind: 'system', now: NOON })
    expect(sys.ok).toBe(true)
    if (sys.ok) expect(sys.body).toBe('کد ورود شما')

    // A phone that is neither a customer nor an opted-in contact is refused.
    expect(await enqueueMessage({ phone: '09361111111', body: 'سلام', kind: 'campaign', now: NOON })).toEqual({ ok: false, reason: 'no_consent' })
  })

  it('holds marketing messages during quiet hours until 09:30 Tehran', async () => {
    const { enqueueMessage } = await import('@/lib/club/messaging/outbox')
    const c = await newCustomer()
    const res = await enqueueMessage({ customerId: c.id, body: 'سلام', kind: 'campaign', now: new Date('2026-11-18T18:30:00Z') }) // 22:00 Tehran
    expect(res.ok).toBe(true)
    if (res.ok) {
      expect(res.delayedByQuietHours).toBe(true)
      expect(res.scheduledFor.toISOString()).toBe('2026-11-19T06:00:00.000Z')
    }
    const s = await newCustomer()
    const sys = await enqueueMessage({ customerId: s.id, body: 'کد', kind: 'system', now: new Date('2026-11-18T18:30:00Z') })
    if (sys.ok) expect(sys.delayedByQuietHours).toBe(false)
  })

  it('allows one marketing SMS per customer per 24 hours (admin may override, system is exempt)', async () => {
    const { enqueueMessage } = await import('@/lib/club/messaging/outbox')
    const c = await newCustomer()
    const results = await Promise.all(Array.from({ length: 5 }, (_, i) => enqueueMessage({ customerId: c.id, body: `پیام ${i}`, kind: 'campaign', now: NOON })))
    expect(results.filter((r) => r.ok)).toHaveLength(1)
    expect(results.filter((r) => !r.ok && r.reason === 'daily_cap')).toHaveLength(4)
    expect((await enqueueMessage({ customerId: c.id, body: 'دستی', kind: 'admin', bypassDailyCap: true, now: NOON })).ok).toBe(true)
    expect((await enqueueMessage({ customerId: c.id, body: 'کد ورود', kind: 'system', now: NOON })).ok).toBe(true)
    // Not marketing: still blocked without the override flag.
    expect(await enqueueMessage({ customerId: c.id, body: 'دستی', kind: 'admin', now: NOON })).toEqual({ ok: false, reason: 'daily_cap' })
  })

  it('never queues the same dedupe key twice, even in parallel', async () => {
    const { enqueueMessage } = await import('@/lib/club/messaging/outbox')
    const c = await newCustomer()
    const key = `test:${tag}:dedupe`
    const results = await Promise.all(Array.from({ length: 6 }, () => enqueueMessage({ customerId: c.id, body: 'سلام', kind: 'automation:vaccine', dedupeKey: key, now: NOON })))
    expect(results.filter((r) => r.ok)).toHaveLength(1)
    expect(await db.messageOutbox.count({ where: { dedupeKey: key } })).toBe(1)
  })

  // ─── Sending ───────────────────────────────────────────────────────────────

  it('two overlapping cron runs send each message exactly once', async () => {
    const { enqueueMessage, processOutbox } = await import('@/lib/club/messaging/outbox')
    const rowIds: string[] = []
    for (let i = 0; i < 8; i++) {
      const c = await newCustomer()
      const r = await enqueueMessage({ customerId: c.id, body: `پیام ${i}`, kind: 'campaign', now: NOON })
      if (r.ok) rowIds.push(r.id)
    }
    expect(rowIds).toHaveLength(8)
    const fake = sender()
    const at = minutes(NOON, 5)
    const [a, b] = await Promise.all([processOutbox({ ids: rowIds, now: at, send: fake.send }), processOutbox({ ids: rowIds, now: at, send: fake.send })])
    expect(a.sent + b.sent).toBe(8)
    expect(fake.calls).toHaveLength(8)
    expect(new Set(fake.calls.map((c) => c.phone)).size).toBe(8)
    const rows = await db.messageOutbox.findMany({ where: { id: { in: rowIds } } })
    expect(rows.every((r) => r.status === 'SENT' && r.attempts === 1 && r.sentAt && r.providerRef === 'fake')).toBe(true)
  })

  it('retries failures with backoff and gives up after three attempts', async () => {
    const { enqueueMessage, processOutbox, retryMessage } = await import('@/lib/club/messaging/outbox')
    const c = await newCustomer()
    const r = await enqueueMessage({ customerId: c.id, body: 'سلام', kind: 'campaign', now: NOON })
    if (!r.ok) throw new Error('not queued')
    const failing = async () => ({ ok: false as const, error: 'provider down' })
    let t = minutes(NOON, 1)
    await processOutbox({ ids: [r.id], now: t, send: failing })
    let row = await db.messageOutbox.findUniqueOrThrow({ where: { id: r.id } })
    expect(row).toMatchObject({ status: 'QUEUED', attempts: 1, error: 'provider down' })
    expect(row.scheduledFor.getTime()).toBeGreaterThan(t.getTime())
    // Not due yet: nothing happens.
    expect((await processOutbox({ ids: [r.id], now: t, send: failing })).claimed).toBe(0)
    t = minutes(NOON, 30)
    await processOutbox({ ids: [r.id], now: t, send: failing })
    t = minutes(NOON, 200)
    await processOutbox({ ids: [r.id], now: t, send: failing })
    row = await db.messageOutbox.findUniqueOrThrow({ where: { id: r.id } })
    expect(row).toMatchObject({ status: 'FAILED', attempts: 3 })
    expect(await retryMessage(r.id, NOON)).toBe(true)
    expect((await db.messageOutbox.findUniqueOrThrow({ where: { id: r.id } })).status).toBe('QUEUED')
  })

  it('re-checks consent and quiet hours when the message is actually sent', async () => {
    const { enqueueMessage, processOutbox, unsubscribePhone } = await import('@/lib/club/messaging/outbox')
    const a = await newCustomer()
    const b = await newCustomer()
    const ra = await enqueueMessage({ customerId: a.id, body: 'سلام', kind: 'campaign', now: NOON })
    const rb = await enqueueMessage({ customerId: b.id, body: 'سلام', kind: 'campaign', now: NOON })
    if (!ra.ok || !rb.ok) throw new Error('not queued')
    await unsubscribePhone(a.phone)
    // unsubscribe already cancels queued marketing rows for that phone
    expect((await db.messageOutbox.findUniqueOrThrow({ where: { id: ra.id } })).status).toBe('CANCELLED')
    expect((await db.customer.findUniqueOrThrow({ where: { id: a.id } })).marketingSmsConsent).toBe(false)

    const fake = sender()
    const night = new Date('2026-11-18T19:00:00Z') // 22:30 Tehran
    const res = await processOutbox({ ids: [rb.id], now: night, send: fake.send })
    expect(res.deferred).toBe(1)
    expect(fake.calls).toHaveLength(0)
    const row = await db.messageOutbox.findUniqueOrThrow({ where: { id: rb.id } })
    expect(row.status).toBe('QUEUED')
    expect(row.attempts).toBe(0)
    expect(row.scheduledFor.toISOString()).toBe('2026-11-19T06:00:00.000Z')

    // Consent withdrawn after queuing (without the cancel step): skipped at send time.
    await db.customer.update({ where: { id: b.id }, data: { marketingSmsConsent: false } })
    const res2 = await processOutbox({ ids: [rb.id], now: new Date('2026-11-19T08:00:00Z'), send: fake.send })
    expect(res2.skipped).toBe(1)
    expect(fake.calls).toHaveLength(0)
  })

  it('leaves rows queued, untouched, when no provider is configured in production', async () => {
    const { enqueueMessage, processOutbox } = await import('@/lib/club/messaging/outbox')
    const c = await newCustomer()
    const r = await enqueueMessage({ customerId: c.id, body: 'سلام', kind: 'campaign', now: NOON })
    if (!r.ok) throw new Error('not queued')
    vi.stubEnv('NODE_ENV', 'production')
    vi.stubEnv('SMS_PROVIDER', '')
    try {
      const res = await processOutbox({ ids: [r.id], now: minutes(NOON, 5) })
      expect(res.configured).toBe(false)
      const row = await db.messageOutbox.findUniqueOrThrow({ where: { id: r.id } })
      expect(row).toMatchObject({ status: 'QUEUED', attempts: 0 })
    } finally {
      vi.unstubAllEnvs()
    }
  })

  // ─── Campaigns ─────────────────────────────────────────────────────────────

  it('launches a campaign: consent filter, snapshot, per-recipient brand coupons, once only, stats and cancel', async () => {
    const { createCampaignDraft, launchCampaign, previewCampaign, getCampaignStats, cancelCampaign } = await import('@/lib/club/campaigns')
    const { processOutbox } = await import('@/lib/club/messaging/outbox')

    const brand = await db.brand.create({ data: { nameFa: `رویال کنین ${tag}`, slugFa: `${tag}-brand` } })
    ids.brands.push(brand.id)
    const mk = async (over: Record<string, unknown>, pet?: Record<string, unknown>) => {
      const c = await newCustomer({ tags: [TAG_SEGMENT], ...over })
      if (pet) await db.pet.create({ data: { customerId: c.id, name: 'لونا', species: 'DOG', ...pet } as never })
      return c
    }
    const withBrand1 = await mk({ firstName: 'سارا' }, { foodBrand: `رویال کنین ${tag}` })
    const withBrand2 = await mk({ firstName: 'نیما' }, { foodBrand: `رویال کنین ${tag}`, name: 'رکس' })
    const unknownBrand = await mk({}, { foodBrand: 'برند ناشناخته xyz' })
    const noConsent = await mk({ marketingSmsConsent: false }, { foodBrand: `رویال کنین ${tag}` })

    const body = 'سلام {name}، برای {petName} کد {code} تا {expiry} روی {petBreed}'
    const couponTemplate = { type: 'PERCENT', value: 15, maxDiscount: 100_000, minSubtotal: 200_000, validDays: 7, restrictToPetBrand: true }
    const rules = { tagsAny: [TAG_SEGMENT] }

    const preview = await previewCampaign({ rules, body, couponTemplate })
    expect(preview.count).toBe(3)
    expect(preview.consentExcluded).toBe(1)
    expect(preview.sample.some((s) => s.wouldSkip === 'no_pet_brand')).toBe(true)
    expect(preview.sample.find((s) => s.name.startsWith('سارا'))?.text).toContain('PB-XXXXXX')

    expect((await createCampaignDraft({ name: 'x', body: 'سلام {zzz}', rules })).ok).toBe(false)
    expect((await createCampaignDraft({ name: 'x', body: 'کد {code}', rules })).ok).toBe(false)
    const draft = await createCampaignDraft({ name: `کمپین ${tag}`, body, rules, couponTemplate })
    if (!draft.ok) throw new Error(draft.error)
    ids.campaigns.push(draft.id)

    // Parallel launches: exactly one wins.
    const [l1, l2] = await Promise.all([launchCampaign(draft.id, NOON), launchCampaign(draft.id, NOON)])
    const winner = [l1, l2].find((l) => l.ok)!
    expect([l1, l2].filter((l) => l.ok)).toHaveLength(1)
    expect(winner).toMatchObject({ audience: 3, enqueued: 2 })
    expect(winner.skipped).toEqual({ no_pet_brand: 1 })

    const rows = await db.messageOutbox.findMany({ where: { campaignId: draft.id } })
    expect(rows).toHaveLength(2)
    expect(new Set(rows.map((r) => r.customerId))).toEqual(new Set([withBrand1.id, withBrand2.id]))
    for (const r of rows) {
      expect(r.dedupeKey).toBe(`campaign:${draft.id}:${r.customerId}`)
      expect(r.kind).toBe('campaign')
      const coupon = await db.coupon.findUniqueOrThrow({ where: { id: r.couponId! } })
      expect(coupon).toMatchObject({ customerId: r.customerId, usageLimit: 1, type: 'PERCENT', value: 15, source: 'campaign', brandIds: [brand.id] })
      expect(r.body).toContain(coupon.code)
      expect(r.body).toContain('لغو: ارسال ۱')
    }
    expect(rows.find((r) => r.customerId === withBrand1.id)!.body).toContain('سارا')
    expect(await db.messageOutbox.count({ where: { customerId: unknownBrand.id, campaignId: draft.id } })).toBe(0)
    expect(await db.coupon.count({ where: { customerId: unknownBrand.id } })).toBe(0)
    const camp = await db.messageCampaign.findUniqueOrThrow({ where: { id: draft.id } })
    expect(camp).toMatchObject({ status: 'RUNNING', recipientsCount: 2 })

    // Send one, then cancel the rest.
    const fake = sender()
    await processOutbox({ ids: [rows[0].id], now: minutes(NOON, 5), send: fake.send })
    const cancelled = await cancelCampaign(draft.id)
    expect(cancelled).toMatchObject({ ok: true, cancelledMessages: 1 })
    const left = rows[1]
    expect((await db.messageOutbox.findUniqueOrThrow({ where: { id: left.id } })).status).toBe('CANCELLED')
    expect((await db.coupon.findUniqueOrThrow({ where: { id: left.couponId! } })).isActive).toBe(false)
    expect((await db.coupon.findUniqueOrThrow({ where: { id: rows[0].couponId! } })).isActive).toBe(true)

    // Conversion: an order from the customer whose message was sent, after it was sent.
    const sentCustomer = rows[0].customerId!
    const order = await db.order.create({
      data: { number: `T-${tag}-1`, customerId: sentCustomer, status: 'CONFIRMED', paymentMethod: 'COD', subtotal: 400_000, shippingFee: 0, total: 400_000, couponId: rows[0].couponId, shipName: 'x', shipPhone: '09120000000', shipProvince: 'تهران', shipCity: 'تهران', shipAddress: 'x', shipPostal: '1938973111' },
    })
    expect(order.id).toBeTruthy()
    const stats = await getCampaignStats(draft.id)
    expect(stats).toMatchObject({ recipients: 2, sent: 1, cancelled: 1, converted: 1, couponRedeemed: 1, revenue: 400_000 })
    expect(noConsent.id).toBeTruthy()
  })

  it('campaign messages finish as DONE once everything is sent', async () => {
    const { createCampaignDraft, launchCampaign } = await import('@/lib/club/campaigns')
    const { processOutbox } = await import('@/lib/club/messaging/outbox')
    const tg = `${TAG_SEGMENT}-b`
    for (let i = 0; i < 3; i++) await newCustomer({ tags: [tg] })
    const draft = await createCampaignDraft({ name: `ساده ${tag}`, body: 'سلام {name}', rules: { tagsAny: [tg] } })
    if (!draft.ok) throw new Error(draft.error)
    ids.campaigns.push(draft.id)
    const res = await launchCampaign(draft.id, NOON)
    expect(res).toMatchObject({ ok: true, audience: 3, enqueued: 3 })
    const fake = sender()
    const rowIds = (await db.messageOutbox.findMany({ where: { campaignId: draft.id }, select: { id: true } })).map((r) => r.id)
    await processOutbox({ ids: rowIds, now: minutes(NOON, 5), send: fake.send })
    const camp = await db.messageCampaign.findUniqueOrThrow({ where: { id: draft.id } })
    expect(camp).toMatchObject({ status: 'DONE', sentCount: 3, failedCount: 0 })
    expect(camp.finishedAt).not.toBeNull()
  })

  // ─── Automations ───────────────────────────────────────────────────────────

  const enableOnly = async (kind: string, extra: Record<string, unknown> = {}) => {
    const { updateAutomationRule } = await import('@/lib/club/automations')
    const r = await updateAutomationRule(kind, { enabled: true, ...extra })
    if (!r.ok) throw new Error(r.error)
  }
  const keysFor = async (prefix: string) => (await db.messageOutbox.findMany({ where: { dedupeKey: { startsWith: prefix } } }))

  it('seeds every rule disabled and validates edits', async () => {
    const { getAutomationRules, updateAutomationRule, AUTOMATION_KINDS } = await import('@/lib/club/automations')
    const rules = await getAutomationRules()
    expect(rules.map((r) => r.kind)).toEqual([...AUTOMATION_KINDS])
    expect((await updateAutomationRule('vaccine', { bodyTemplate: 'سلام {nope}' })).ok).toBe(false)
    expect((await updateAutomationRule('vaccine', { bodyTemplate: 'کد {code}', couponTemplate: null })).ok).toBe(false)
    expect((await updateAutomationRule('nonsense', {})).ok).toBe(false)
    const r = await updateAutomationRule('vaccine', { params: { daysBefore: 9999 } })
    expect(r.ok && (r.rule.params as { daysBefore: number }).daysBefore).toBe(60)
    await db.automationRule.update({ where: { kind: 'vaccine' }, data: { enabled: false } })
  })

  it('vaccine reminders: once per record and due date, skipping renewed ones and non-consenting owners', async () => {
    const { generateAutomationMessages } = await import('@/lib/club/automations')
    const ok = await newCustomer()
    const noc = await newCustomer({ marketingSmsConsent: false })
    const mkPet = (customerId: string) => db.pet.create({ data: { customerId, name: 'مکس', species: 'DOG' } })
    const pet = await mkPet(ok.id)
    const petRenewed = await mkPet(ok.id)
    const petNoc = await mkPet(noc.id)
    const due = days(NOON, 3)
    const rec = await db.petRecord.create({ data: { petId: pet.id, kind: 'VACCINE', title: 'واکسن هاری', doneAt: days(NOON, -360), nextDueAt: due } })
    const old = await db.petRecord.create({ data: { petId: petRenewed.id, kind: 'VACCINE', title: 'واکسن قدیمی', doneAt: days(NOON, -360), nextDueAt: due } })
    await db.petRecord.create({ data: { petId: petRenewed.id, kind: 'VACCINE', title: 'واکسن جدید', doneAt: days(NOON, -2) } })
    const recNoc = await db.petRecord.create({ data: { petId: petNoc.id, kind: 'VACCINE', title: 'واکسن', doneAt: days(NOON, -360), nextDueAt: due } })

    await enableOnly('vaccine')
    // Disabled rules do nothing; dry run lists without writing.
    const dry = await generateAutomationMessages({ now: NOON, kinds: ['vaccine'], dryRun: true, limitPerRule: 500 })
    expect(dry[0].preview.some((p) => p.customerId === ok.id && p.text.includes('واکسن هاری') && p.text.includes('مکس') && !p.wouldSkip)).toBe(true)
    expect(await keysFor(`vaccine:${rec.id}`)).toHaveLength(0)

    const run1 = await generateAutomationMessages({ now: NOON, kinds: ['vaccine'], limitPerRule: 500 })
    expect(run1[0].queued).toBeGreaterThanOrEqual(1)
    const rows = await keysFor(`vaccine:${rec.id}`)
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ customerId: ok.id, kind: 'automation:vaccine' })
    expect(rows[0].body).toContain('واکسن هاری')
    expect(rows[0].body).toContain('مکس')
    expect((await db.petRecord.findUniqueOrThrow({ where: { id: rec.id } })).reminderSentAt).not.toBeNull()
    expect(await keysFor(`vaccine:${old.id}`)).toHaveLength(0)
    expect(await keysFor(`vaccine:${recNoc.id}`)).toHaveLength(0)

    await generateAutomationMessages({ now: NOON, kinds: ['vaccine'], limitPerRule: 500 })
    expect(await keysFor(`vaccine:${rec.id}`)).toHaveLength(1)
    await db.automationRule.update({ where: { kind: 'vaccine' }, data: { enabled: false } })
  })

  it('pet birthday: one message with a personal coupon per pet and year', async () => {
    const { generateAutomationMessages } = await import('@/lib/club/automations')
    const c = await newCustomer()
    const pet = await db.pet.create({ data: { customerId: c.id, name: 'بیتا', species: 'CAT', birthDate: new Date('2021-11-18T12:00:00Z') } })
    await enableOnly('petBirthday')
    await Promise.all([generateAutomationMessages({ now: NOON, kinds: ['petBirthday'], limitPerRule: 500 }), generateAutomationMessages({ now: NOON, kinds: ['petBirthday'], limitPerRule: 500 })])
    const rows = await keysFor(`petBirthday:${pet.id}:`)
    expect(rows).toHaveLength(1)
    expect(rows[0].body).toContain('بیتا')
    const coupon = await db.coupon.findUniqueOrThrow({ where: { id: rows[0].couponId! } })
    expect(coupon).toMatchObject({ customerId: c.id, usageLimit: 1, source: 'automation' })
    expect(rows[0].body).toContain(coupon.code)
    await db.automationRule.update({ where: { kind: 'petBirthday' }, data: { enabled: false } })
  })

  it('owner birthday: points once per year and one message', async () => {
    const { generateAutomationMessages } = await import('@/lib/club/automations')
    const c = await newCustomer({ birthDate: new Date('1990-11-18T12:00:00Z') })
    await enableOnly('ownerBirthday')
    await generateAutomationMessages({ now: NOON, kinds: ['ownerBirthday'], limitPerRule: 500 })
    await generateAutomationMessages({ now: NOON, kinds: ['ownerBirthday'], limitPerRule: 500 })
    expect((await db.customer.findUniqueOrThrow({ where: { id: c.id } })).pointsBalance).toBe(100)
    expect(await db.pointsTransaction.count({ where: { customerId: c.id, kind: 'BIRTHDAY' } })).toBe(1)
    expect(await keysFor(`ownerBirthday:${c.id}:`)).toHaveLength(1)
    await db.automationRule.update({ where: { kind: 'ownerBirthday' }, data: { enabled: false } })
  })

  it('repeat purchase: reminds when the pack runs out, not after a reorder', async () => {
    const { generateAutomationMessages } = await import('@/lib/club/automations')
    const cat = await db.productCategory.create({ data: { slugFa: `${tag}-rc`, nameFa: 'دسته' } })
    ids.categories.push(cat.id)
    const prod = await db.product.create({ data: { categoryId: cat.id, slugFa: `${tag}-rp`, nameFa: 'غذای خشک آزمون', price: 500_000, stockStatus: 'IN_STOCK', consumeDays: 30 } })
    ids.products.push(prod.id)
    const mkOrder = async (customerId: string, createdAt: Date, n: number) =>
      db.order.create({
        data: {
          number: `T-${tag}-r${n}`, customerId, status: 'DELIVERED', paymentMethod: 'COD', subtotal: 500_000, shippingFee: 0, total: 500_000, createdAt,
          shipName: 'x', shipPhone: '09120000000', shipProvince: 'تهران', shipCity: 'تهران', shipAddress: 'x', shipPostal: '1938973111',
          items: { create: [{ productId: prod.id, nameFa: 'غذای خشک آزمون', unitPrice: 500_000, quantity: 1, lineTotal: 500_000 }] },
        },
        include: { items: true },
      })
    const due = await newCustomer()
    const reordered = await newCustomer()
    const early = await newCustomer()
    await db.pet.create({ data: { customerId: due.id, name: 'پنیر', species: 'CAT', foodProductId: prod.id } })
    const o1 = await mkOrder(due.id, days(NOON, -27), 1)
    const o2 = await mkOrder(reordered.id, days(NOON, -27), 2)
    await mkOrder(reordered.id, days(NOON, -3), 3)
    const o4 = await mkOrder(early.id, days(NOON, -5), 4)

    await enableOnly('repeatPurchase')
    await generateAutomationMessages({ now: NOON, kinds: ['repeatPurchase'], limitPerRule: 500 })
    const rows = await keysFor(`repeat:${o1.items[0].id}`)
    expect(rows).toHaveLength(1)
    expect(rows[0].body).toContain('غذای خشک آزمون')
    expect(rows[0].body).toContain('پنیر')
    expect(await keysFor(`repeat:${o2.items[0].id}`)).toHaveLength(0)
    expect(await keysFor(`repeat:${o4.items[0].id}`)).toHaveLength(0)
    await generateAutomationMessages({ now: NOON, kinds: ['repeatPurchase'], limitPerRule: 500 })
    expect(await keysFor(`repeat:${o1.items[0].id}`)).toHaveLength(1)
    await db.automationRule.update({ where: { kind: 'repeatPurchase' }, data: { enabled: false } })
  })

  it('win-back: lapsed customers get one message with a coupon; recent buyers do not', async () => {
    const { generateAutomationMessages } = await import('@/lib/club/automations')
    const lapsed = await newCustomer({ ordersCount: 2, lastOrderAt: days(NOON, -90) })
    const recent = await newCustomer({ ordersCount: 2, lastOrderAt: days(NOON, -10) })
    const never = await newCustomer({ ordersCount: 0 })
    await enableOnly('winback')
    await generateAutomationMessages({ now: NOON, kinds: ['winback'], limitPerRule: 500 })
    await generateAutomationMessages({ now: NOON, kinds: ['winback'], limitPerRule: 500 })
    const rows = await keysFor(`winback:${lapsed.id}:`)
    expect(rows).toHaveLength(1)
    expect(rows[0].couponId).toBeTruthy()
    expect(await keysFor(`winback:${recent.id}:`)).toHaveLength(0)
    expect(await keysFor(`winback:${never.id}:`)).toHaveLength(0)
    await db.automationRule.update({ where: { kind: 'winback' }, data: { enabled: false } })
  })

  it('abandoned cart: idle cart gets one reminder naming the top item; ordered or fresh carts do not', async () => {
    const { generateAutomationMessages } = await import('@/lib/club/automations')
    const mkCart = async (customerId: string, updatedAt: Date) =>
      db.cartSnapshot.create({
        data: {
          customerId, itemCount: 3, subtotal: 900_000, updatedAt,
          items: [{ productId: 'p1', quantity: 1, name: 'ارزان', price: 100_000 }, { productId: 'p2', quantity: 1, name: 'غذای گران قیمت', price: 800_000 }],
        },
      })
    const idle = await newCustomer()
    const fresh = await newCustomer()
    const ordered = await newCustomer()
    const snap = await mkCart(idle.id, minutes(NOON, -5 * 60))
    await mkCart(fresh.id, minutes(NOON, -30))
    await mkCart(ordered.id, minutes(NOON, -5 * 60))
    await db.order.create({
      data: { number: `T-${tag}-ab`, customerId: ordered.id, status: 'CONFIRMED', paymentMethod: 'COD', subtotal: 1, shippingFee: 0, total: 1, createdAt: minutes(NOON, -60), shipName: 'x', shipPhone: '09120000000', shipProvince: 'تهران', shipCity: 'تهران', shipAddress: 'x', shipPostal: '1938973111' },
    })

    await enableOnly('abandonedCart')
    await generateAutomationMessages({ now: NOON, kinds: ['abandonedCart'], limitPerRule: 500 })
    await generateAutomationMessages({ now: NOON, kinds: ['abandonedCart'], limitPerRule: 500 })
    const rows = await db.messageOutbox.findMany({ where: { dedupeKey: { startsWith: `cart:${idle.id}:` } } })
    expect(rows).toHaveLength(1)
    expect(rows[0].body).toContain('غذای گران قیمت')
    expect((await db.cartSnapshot.findUniqueOrThrow({ where: { id: snap.id } })).lastReminderAt).not.toBeNull()
    expect(await db.messageOutbox.count({ where: { customerId: fresh.id } })).toBe(0)
    expect(await db.messageOutbox.count({ where: { customerId: ordered.id } })).toBe(0)

    // The cart changes and idles again after the 3-day gap: a new reminder is allowed.
    await db.messageOutbox.updateMany({ where: { customerId: idle.id }, data: { status: 'SENT', sentAt: NOON } })
    await db.cartSnapshot.update({ where: { id: snap.id }, data: { updatedAt: days(NOON, 4) } })
    await generateAutomationMessages({ now: days(NOON, 4.5), kinds: ['abandonedCart'], limitPerRule: 500 })
    expect(await db.messageOutbox.count({ where: { dedupeKey: { startsWith: `cart:${idle.id}:` } } })).toBe(2)
    await db.automationRule.update({ where: { kind: 'abandonedCart' }, data: { enabled: false } })
  })

  // ─── AI ────────────────────────────────────────────────────────────────────

  it('draftMessage falls back to three good templates without an API key', async () => {
    vi.stubEnv('ANTHROPIC_API_KEY', '')
    try {
      const { draftMessage } = await import('@/lib/club/ai')
      const res = await draftMessage({ goal: 'winback', tone: 'friendly' })
      expect(res.source).toBe('fallback')
      expect(res.options).toHaveLength(3)
      res.options.forEach((o) => expect(o.length).toBeGreaterThan(20))
    } finally {
      vi.unstubAllEnvs()
    }
  })

  it('draftMessage sends only anonymised facts to the API and parses the answer; failures fall back', async () => {
    const { draftMessage, factsForCustomer } = await import('@/lib/club/ai')
    const c = await newCustomer({ firstName: 'فرهاد', lastName: 'یگانه', email: `secret.${tag}@example.com`, tier: 'GOLD', lastOrderAt: days(new Date(), -45) })
    await db.pet.create({ data: { customerId: c.id, name: 'شاهین', species: 'DOG', breed: 'ژرمن شپرد', foodBrand: 'پرو پلن' } })
    const facts = await factsForCustomer(c.id)
    expect(facts).toMatchObject({ species: 'سگ', breed: 'ژرمن شپرد', foodBrand: 'پرو پلن', tier: 'GOLD', daysSinceLastOrder: 45 })

    vi.stubEnv('ANTHROPIC_API_KEY', 'test-key')
    const fetchMock = vi.fn(async (_url: unknown, init?: { body?: string }) => {
      void init
      return new Response(JSON.stringify({ content: [{ type: 'text', text: '["سلام {name}، برای {petName} یک پیشنهاد ویژه داریم، کد {code} را فراموش نکنید.","پیام دوم برای {name} و {petName} با کد {code}.","پیام سوم کوتاه و مهربان برای {name}."]' }] }), { status: 200 })
    })
    vi.stubGlobal('fetch', fetchMock)
    try {
      const res = await draftMessage({ goal: 'winback', tone: 'playful', facts })
      expect(res.source).toBe('ai')
      expect(res.options).toHaveLength(3)
      expect(fetchMock).toHaveBeenCalledTimes(1)
      const [url, init] = fetchMock.mock.calls[0] as unknown as [string, { body: string; headers: Record<string, string> }]
      expect(url).toBe('https://api.anthropic.com/v1/messages')
      expect(init.headers['x-api-key']).toBe('test-key')
      const sent = init.body
      expect(JSON.parse(sent).model).toBe('claude-sonnet-5-5')
      for (const secret of ['فرهاد', 'یگانه', 'شاهین', c.phone, `secret.${tag}`, '@']) expect(sent).not.toContain(secret)
      expect(sent).toContain('ژرمن شپرد')

      fetchMock.mockImplementationOnce(async () => new Response('nope', { status: 500 }))
      expect((await draftMessage({ goal: 'winback', facts })).source).toBe('fallback')
      fetchMock.mockImplementationOnce(async () => {
        throw new Error('network')
      })
      expect((await draftMessage({ goal: 'winback', facts })).options).toHaveLength(3)
      fetchMock.mockImplementationOnce(async () => new Response(JSON.stringify({ content: [{ type: 'text', text: 'not json' }] }), { status: 200 }))
      expect((await draftMessage({ goal: 'winback', facts })).source).toBe('fallback')
    } finally {
      vi.unstubAllGlobals()
      vi.unstubAllEnvs()
    }
  })

  it('buildInsights suggests brand coupon, overdue vaccine and win-back from real data', async () => {
    const { buildInsights } = await import('@/lib/club/ai')
    const c = await newCustomer({ ordersCount: 3, lastOrderAt: days(new Date(), -80), birthDate: null })
    const pet = await db.pet.create({ data: { customerId: c.id, name: 'آرتا', species: 'DOG', foodBrand: 'رویال کنین' } })
    await db.petRecord.create({ data: { petId: pet.id, kind: 'VACCINE', title: 'واکسن سه‌گانه', doneAt: days(new Date(), -400), nextDueAt: days(new Date(), -10) } })
    const insights = await buildInsights(c.id)
    const byId = (p: string) => insights.find((i) => i.id.startsWith(p))
    expect(byId('brand-')?.action).toMatchObject({ type: 'coupon', couponTemplate: { restrictToPetBrand: true } })
    expect(byId('vaccine-')?.action.type).toBe('message')
    expect(byId('winback')?.action.type).toBe('coupon')
    expect(insights.map((i) => i.priority)).toEqual([...insights.map((i) => i.priority)].sort((a, b) => b - a))

    const none = await newCustomer({ marketingSmsConsent: false })
    expect((await buildInsights(none.id)).some((i) => i.id === 'no-consent')).toBe(true)
  })
})
