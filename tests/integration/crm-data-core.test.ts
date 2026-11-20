/**
 * CRM data core against a real local PostgreSQL (skipped otherwise): safe customer merge (moves, points,
 * uniqueness conflicts, audit, dry run, parallel merges), import commit, lead promotion, parallel lead
 * transitions, timeline ordering and the RBAC matrix of the crm-data actions.
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import { isLocalDatabaseUrl } from '../helpers/local-db'

vi.mock('server-only', () => ({}))
vi.mock('next/cache', () => ({ unstable_cache: (fn: unknown) => fn, revalidatePath: vi.fn() }))
vi.mock('next/navigation', () => ({ redirect: vi.fn() }))
vi.mock('next/headers', () => ({
  cookies: async () => ({ get: () => undefined, set: () => {}, delete: () => {} }),
  headers: async () => new Headers({ 'x-forwarded-for': '10.88.0.1', host: 'localhost:3000' }),
}))

type Role = 'SUPER_ADMIN' | 'ADMIN' | 'EDITOR' | 'AUTHOR' | 'VIEWER'
const RANK: Record<Role, number> = { SUPER_ADMIN: 5, ADMIN: 4, EDITOR: 3, AUTHOR: 2, VIEWER: 1 }
let role: Role | null = 'ADMIN'
let uid = 'crm-adm-1'
vi.mock('@/lib/auth', () => ({
  getSessionWithRole: vi.fn(async (min: Role) => (role && RANK[role] >= RANK[min] ? { userId: uid, email: 'a@b.c', name: 'Admin', role, expiresAt: 0 } : null)),
  getSession: vi.fn(async () => (role ? { userId: uid, email: 'a@b.c', name: 'Admin', role, expiresAt: 0 } : null)),
}))
vi.mock('@/lib/audit', () => ({ logAdminChange: vi.fn(async () => {}) }))

const hasDb = isLocalDatabaseUrl(process.env.DATABASE_URL)
const d = hasDb ? describe : describe.skip
let seq = 0
const RUN = String(Date.now()).slice(-6)
const uniquePhone = () => {
  seq += 1
  return `0937${RUN.slice(-4)}${String(seq).padStart(3, '0')}`
}

d('CRM data core (real database)', () => {
  let db: typeof import('@/lib/db').db
  const customers: string[] = []
  const leadIds: string[] = []
  const contactIds: string[] = []
  const viewIds: string[] = []

  const mk = async (data: Record<string, unknown> = {}) => {
    const c = await db.customer.create({ data: { phone: uniquePhone(), firstName: 'تست', ...data } as never })
    customers.push(c.id)
    return c
  }

  beforeAll(async () => {
    db = (await import('@/lib/db')).db
  })

  afterAll(async () => {
    if (!hasDb) return
    await db.crmActivity.deleteMany({ where: { OR: [{ customerId: { in: customers } }, { contactId: { in: contactIds } }] } }).catch(() => {})
    await db.crmTask.deleteMany({ where: { customerId: { in: customers } } }).catch(() => {})
    await db.lead.deleteMany({ where: { id: { in: leadIds } } }).catch(() => {})
    await db.savedView.deleteMany({ where: { id: { in: viewIds } } }).catch(() => {})
    await db.savedView.deleteMany({ where: { ownerId: { startsWith: 'crm-test-' } } }).catch(() => {})
    await db.auditLog.deleteMany({ where: { entity: 'CUSTOMER', action: 'MERGE', entityId: { in: customers } } }).catch(() => {})
    await db.customer.deleteMany({ where: { id: { in: customers } } }).catch(() => {})
    await db.contact.deleteMany({ where: { OR: [{ id: { in: contactIds } }, { customerId: { in: customers } }] } }).catch(() => {})
    await db.customer.deleteMany({ where: { source: 'IMPORT', phone: { startsWith: '0938' + RUN.slice(-4) } } }).catch(() => {})
    await db.$disconnect()
  })

  beforeEach(() => {
    role = 'ADMIN'
    uid = 'crm-adm-1'
  })

  /* ------------------------------------------------------------------ merge */

  describe('mergeCustomers', () => {
    it('moves everything, rebuilds counters and leaves an audited shell', async () => {
      const { mergeCustomers } = await import('@/lib/crm/merge')
      const s = await mk({ email: null, city: null, tags: ['a'], notes: 'یادداشت اصلی' })
      const l = await mk({ email: `l${RUN}${seq}@example.com`, city: 'تهران', tags: ['a', 'b'], notes: 'یادداشت تکراری', pointsBalance: 30, lifetimePoints: 30 })
      await db.pet.create({ data: { customerId: l.id, name: 'پوپک', species: 'CAT' } as never })
      await db.address.create({ data: { customerId: l.id, recipientName: 'x', recipientPhone: l.phone, province: 'تهران', city: 'تهران', addressLine: 'خیابان', postalCode: '1234567890' } })
      await db.adminCustomerNote.create({ data: { customerId: l.id, body: 'یادداشت' } })
      await db.pointsTransaction.create({ data: { customerId: l.id, kind: 'SERVICE', points: 30, balanceAfter: 30, refId: 'r1' } as never })
      await db.pointsTransaction.create({ data: { customerId: s.id, kind: 'SERVICE', points: 20, balanceAfter: 20, refId: 'r1' } as never })
      await db.customer.update({ where: { id: s.id }, data: { pointsBalance: 20, lifetimePoints: 20 } })

      const report = await mergeCustomers(s.id, l.id, 'crm-adm-1')
      expect(report.moved.pets).toBe(1)
      expect(report.moved.addresses).toBe(1)
      expect(report.moved.notes).toBe(1)
      expect(report.pointsRefsRenamed).toBe(1)
      expect(report.pointsBalance).toBe(50)

      const [sAfter, lAfter] = await Promise.all([db.customer.findUnique({ where: { id: s.id } }), db.customer.findUnique({ where: { id: l.id } })])
      expect(sAfter!.pointsBalance).toBe(50)
      expect(sAfter!.lifetimePoints).toBe(50)
      expect(sAfter!.email).toBe(l.email)
      expect(sAfter!.city).toBe('تهران')
      expect(sAfter!.tags.sort()).toEqual(['a', 'b'])
      expect(sAfter!.notes).toContain('یادداشت اصلی')
      expect(sAfter!.notes).toContain('یادداشت تکراری')
      expect(lAfter!.mergedIntoId).toBe(s.id)
      expect(lAfter!.isBlocked).toBe(true)
      expect(lAfter!.pointsBalance).toBe(0)
      expect(await db.pet.count({ where: { customerId: s.id } })).toBe(1)
      expect(await db.pet.count({ where: { customerId: l.id } })).toBe(0)
      const ledger = await db.pointsTransaction.findMany({ where: { customerId: s.id }, orderBy: [{ createdAt: 'asc' }, { id: 'asc' }] })
      expect(ledger).toHaveLength(2)
      expect(ledger[ledger.length - 1].balanceAfter).toBe(50)
      const audit = await db.auditLog.findFirst({ where: { action: 'MERGE', entityId: s.id } })
      expect(audit).toBeTruthy()
    })

    it('dry run reports exactly but changes nothing', async () => {
      const { mergeCustomers } = await import('@/lib/crm/merge')
      const s = await mk()
      const l = await mk()
      await db.pet.create({ data: { customerId: l.id, name: 'رکس', species: 'DOG' } as never })
      const r = await mergeCustomers(s.id, l.id, 'crm-adm-1', { dryRun: true })
      expect(r.dryRun).toBe(true)
      expect(r.moved.pets).toBe(1)
      expect(await db.pet.count({ where: { customerId: l.id } })).toBe(1)
      expect((await db.customer.findUnique({ where: { id: l.id } }))!.mergedIntoId).toBeNull()
    })

    it('refuses same id, missing customers and already merged ones', async () => {
      const { mergeCustomers } = await import('@/lib/crm/merge')
      const a = await mk()
      const b = await mk()
      const c = await mk()
      await expect(mergeCustomers(a.id, a.id, 'x')).rejects.toMatchObject({ code: 'SAME' })
      await expect(mergeCustomers(a.id, 'nope', 'x')).rejects.toMatchObject({ code: 'NOT_FOUND' })
      await mergeCustomers(a.id, b.id, 'crm-adm-1')
      await expect(mergeCustomers(c.id, b.id, 'crm-adm-1')).rejects.toMatchObject({ code: 'ALREADY_MERGED' })
    })

    it('parallel merges of the same loser: exactly one wins, no data duplicated', async () => {
      const { mergeCustomers } = await import('@/lib/crm/merge')
      const s1 = await mk()
      const s2 = await mk()
      const l = await mk()
      await db.pet.create({ data: { customerId: l.id, name: 'یکی', species: 'CAT' } as never })
      const res = await Promise.allSettled([mergeCustomers(s1.id, l.id, 'crm-adm-1'), mergeCustomers(s2.id, l.id, 'crm-adm-1')])
      expect(res.filter((r) => r.status === 'fulfilled')).toHaveLength(1)
      expect(res.filter((r) => r.status === 'rejected')).toHaveLength(1)
      const pets = (await db.pet.count({ where: { customerId: s1.id } })) + (await db.pet.count({ where: { customerId: s2.id } }))
      expect(pets).toBe(1)
    })

    it('crossed parallel merges (A into B, B into A) do not deadlock and only one applies', async () => {
      const { mergeCustomers } = await import('@/lib/crm/merge')
      const a = await mk()
      const b = await mk()
      const res = await Promise.allSettled([mergeCustomers(a.id, b.id, 'crm-adm-1'), mergeCustomers(b.id, a.id, 'crm-adm-1')])
      expect(res.filter((r) => r.status === 'fulfilled')).toHaveLength(1)
    })
  })

  /* ----------------------------------------------------------------- import */

  describe('commitImport', () => {
    it('creates new customers, skips existing phones and is safe to run twice', async () => {
      const { commitImport, previewImport } = await import('@/lib/crm/import')
      const p1 = `0938${RUN.slice(-4)}001`
      const p2 = `0938${RUN.slice(-4)}002`
      const existing = await mk({ phone: `0938${RUN.slice(-4)}003` })
      const rows = [
        { phone: p1, name: 'علی رضایی', tags: ['vip'] },
        { phone: p2, name: 'مریم' },
        { phone: existing.phone },
      ]
      const pv = await previewImport(rows)
      expect(pv).toMatchObject({ valid: 2, duplicates: 1, invalid: 0 })
      const first = await commitImport(rows, 'crm-adm-1')
      expect(first.created).toBe(2)
      expect(first.skipped).toBe(1)
      const again = await commitImport(rows, 'crm-adm-1')
      expect(again.created).toBe(0)
      const c = await db.customer.findUnique({ where: { phone: p1 } })
      expect(c).toMatchObject({ firstName: 'علی', lastName: 'رضایی', source: 'IMPORT', marketingSmsConsent: false })
      expect(c!.tags).toEqual(['vip'])
      customers.push(c!.id)
      const c2 = await db.customer.findUnique({ where: { phone: p2 } })
      customers.push(c2!.id)
    })

    it('parallel imports of the same phone create it once', async () => {
      const { commitImport } = await import('@/lib/crm/import')
      const p = `0938${RUN.slice(-4)}010`
      const rows = [{ phone: p, name: 'هم‌زمان' }]
      const res = await Promise.all([commitImport(rows, 'crm-adm-1'), commitImport(rows, 'crm-adm-1')])
      expect(res[0].created + res[1].created).toBe(1)
      const c = await db.customer.findUnique({ where: { phone: p } })
      if (c) customers.push(c.id)
    })

    it('rejects an oversized batch', async () => {
      const { commitImport, MAX_IMPORT_ROWS } = await import('@/lib/crm/import')
      await expect(commitImport(Array.from({ length: MAX_IMPORT_ROWS + 1 }, () => ({ phone: '09121112233' })), 'x')).rejects.toMatchObject({ code: 'TOO_MANY' })
    })
  })

  /* ------------------------------------------------------- lead pipeline etc */

  describe('leads', () => {
    const mkLead = async (data: Record<string, unknown> = {}) => {
      const l = await db.lead.create({ data: { phone: uniquePhone(), name: 'سرنخ', ...data } as never })
      leadIds.push(l.id)
      return l
    }

    it('parallel transitions from the same stage: exactly one succeeds', async () => {
      const { changeLeadStage } = await import('@/lib/crm/leads')
      const l = await mkLead()
      const res = await Promise.allSettled([
        changeLeadStage(l.id, 'CONTACTED', { actorUserId: 'a' }),
        changeLeadStage(l.id, 'LOST', { actorUserId: 'a', lostReason: 'PRICE' }),
      ])
      expect(res.filter((r) => r.status === 'fulfilled')).toHaveLength(1)
      const after = await db.lead.findUnique({ where: { id: l.id } })
      expect(['CONTACTED', 'LOST']).toContain(after!.stage)
    })

    it('LOST needs a reason and WON cannot be reopened by an editor', async () => {
      const { changeLeadStage } = await import('@/lib/crm/leads')
      const l = await mkLead()
      await expect(changeLeadStage(l.id, 'LOST', { actorUserId: 'a' })).rejects.toMatchObject({ code: 'LOST_REASON_REQUIRED' })
      const w = await mkLead({ stage: 'WON', status: 'CONVERTED' })
      await expect(changeLeadStage(w.id, 'QUALIFIED', { actorUserId: 'a', actorRole: 'EDITOR' })).rejects.toMatchObject({ code: 'BAD_TRANSITION' })
    })

    it('registering customer promotes matching leads to WON once', async () => {
      const { promoteLeadsForCustomer } = await import('@/lib/crm/promote')
      const c = await mk()
      const l1 = await mkLead({ phone: `+98${c.phone.slice(1)}` })
      const l2 = await mkLead({ phone: c.phone, normalizedPhone: c.phone, stage: 'QUALIFIED' })
      expect(await promoteLeadsForCustomer(c.id)).toBe(2)
      expect(await promoteLeadsForCustomer(c.id)).toBe(0)
      for (const id of [l1.id, l2.id]) {
        const l = await db.lead.findUnique({ where: { id } })
        expect(l).toMatchObject({ stage: 'WON', status: 'CONVERTED', customerId: c.id })
      }
    })
  })

  /* --------------------------------------------------------------- timeline */

  describe('activity timeline', () => {
    it('is idempotent per (type, refType, refId), newest first and paginated', async () => {
      const { recordActivity, listActivity } = await import('@/lib/crm/activity')
      const c = await mk()
      const base = Date.now() - 100_000
      for (let i = 0; i < 5; i++) {
        await recordActivity({ type: 'NOTE_ADDED', summary: `n${i}`, customerId: c.id, refType: 'note', refId: `${c.id}-${i}`, occurredAt: new Date(base + i * 1000) })
      }
      await recordActivity({ type: 'NOTE_ADDED', summary: 'dup', customerId: c.id, refType: 'note', refId: `${c.id}-0` })
      const p1 = await listActivity({ customerId: c.id, take: 3 })
      expect(p1.items.map((i) => i.summary)).toEqual(['n4', 'n3', 'n2'])
      expect(p1.nextCursor).toBeTruthy()
      const p2 = await listActivity({ customerId: c.id, take: 3, cursor: p1.nextCursor! })
      expect(p2.items.map((i) => i.summary)).toEqual(['n1', 'n0'])
      expect(p2.nextCursor).toBeNull()
    })

    it('recordActivity never throws on bad input', async () => {
      const { recordActivity } = await import('@/lib/crm/activity')
      await expect(recordActivity({ type: 'NOTE_ADDED', summary: 'x'.repeat(5000) })).resolves.toBeUndefined()
    })
  })

  /* --------------------------------------------------- contact spine / views */

  describe('contacts', () => {
    it('resolveContact is idempotent by phone and links a customer', async () => {
      const { resolveContact, linkCustomerToContact } = await import('@/lib/crm/contacts')
      const c = await mk()
      const [a, b] = await Promise.all([resolveContact({ phone: c.phone }), resolveContact({ phone: `+98${c.phone.slice(1)}` })])
      expect(a!.id).toBe(b!.id)
      contactIds.push(a!.id)
      const cid = await linkCustomerToContact(c.id)
      expect(cid).toBe(a!.id)
      expect((await db.customer.findUnique({ where: { id: c.id } }))!.contactId).toBe(cid)
    })
    it('resolveContact returns null without usable identity', async () => {
      const { resolveContact } = await import('@/lib/crm/contacts')
      expect(await resolveContact({ phone: 'abc', email: null })).toBeNull()
    })
  })

  describe('crm-data actions: RBAC, validation, views', () => {
    it('denies by role matrix', async () => {
      const a = await import('@/app/actions/crm-data')
      role = 'VIEWER'
      expect((await a.mergeCustomersAction('a', 'b', true)).ok).toBe(false)
      expect((await a.findDuplicatesAction()).ok).toBe(false)
      expect((await a.saveViewAction({ entity: 'LEAD', name: 'x', filters: {} })).ok).toBe(false)
      expect((await a.listViewsAction('LEAD')).ok).toBe(true)
      role = 'EDITOR'
      expect((await a.mergeCustomersAction('a', 'b', true)).ok).toBe(false)
      expect((await a.previewImportAction('phone\n09121112233')).ok).toBe(false)
      expect((await a.commitImportAction('phone\n09121112233')).ok).toBe(false)
      expect((await a.findDuplicatesAction()).ok).toBe(true)
      role = null
      expect((await a.listViewsAction('LEAD')).ok).toBe(false)
    })

    it('validates input', async () => {
      const a = await import('@/app/actions/crm-data')
      role = 'ADMIN'
      expect((await a.mergeCustomersAction('', 'b', true)).ok).toBe(false)
      expect((await a.listViewsAction('NOPE' as never)).ok).toBe(false)
      expect((await a.saveViewAction({ entity: 'LEAD', name: '   ', filters: {} })).ok).toBe(false)
    })

    it('admin merge action dry run then real merge', async () => {
      const a = await import('@/app/actions/crm-data')
      const s = await mk()
      const l = await mk()
      const dry = await a.mergeCustomersAction(s.id, l.id, true)
      expect(dry.ok && dry.data.dryRun).toBe(true)
      const real = await a.mergeCustomersAction(s.id, l.id, false)
      expect(real.ok && real.data.dryRun).toBe(false)
      const again = await a.mergeCustomersAction(s.id, l.id, false)
      expect(again.ok).toBe(false)
    })

    it('saved views: own, shared by admin only, deletion rights', async () => {
      const a = await import('@/app/actions/crm-data')
      uid = 'crm-test-ed1'
      role = 'EDITOR'
      const mine = await a.saveViewAction({ entity: 'LEAD', name: 'نمای من', filters: { stage: 'NEW' }, sort: 'createdAt' })
      expect(mine.ok).toBe(true)
      if (!mine.ok) return
      viewIds.push(mine.data.id)
      const sharedByEditor = await a.saveViewAction({ entity: 'LEAD', name: 'مشترک', filters: {}, shared: true })
      expect(sharedByEditor.ok).toBe(false)
      // same name replaces rather than duplicates
      const again = await a.saveViewAction({ entity: 'LEAD', name: 'نمای من', filters: { stage: 'LOST' } })
      expect(again.ok && again.data.id).toBe(mine.data.id)

      uid = 'crm-test-ad1'
      role = 'ADMIN'
      const shared = await a.saveViewAction({ entity: 'LEAD', name: 'مشترک تیم', filters: { q: 'x' }, shared: true })
      expect(shared.ok).toBe(true)
      if (!shared.ok) return
      viewIds.push(shared.data.id)

      uid = 'crm-test-ed2'
      role = 'EDITOR'
      const list = await a.listViewsAction('LEAD')
      expect(list.ok).toBe(true)
      if (list.ok) {
        expect(list.data.some((v) => v.id === shared.data.id)).toBe(true)
        expect(list.data.some((v) => v.id === mine.data.id)).toBe(false)
      }
      expect((await a.deleteViewAction(mine.data.id)).ok).toBe(false)
      expect((await a.deleteViewAction(shared.data.id)).ok).toBe(false)
      uid = 'crm-test-ad1'
      role = 'ADMIN'
      expect((await a.deleteViewAction(shared.data.id)).ok).toBe(true)
    })

    it('rejects non-object and oversized filters', async () => {
      const a = await import('@/app/actions/crm-data')
      uid = 'crm-test-ed3'
      role = 'EDITOR'
      expect((await a.saveViewAction({ entity: 'TASK', name: 'x', filters: [1, 2] })).ok).toBe(false)
      expect((await a.saveViewAction({ entity: 'TASK', name: 'x', filters: { big: 'y'.repeat(9000) } })).ok).toBe(false)
    })

    it('import preview action returns line errors and respects ADMIN', async () => {
      const a = await import('@/app/actions/crm-data')
      role = 'ADMIN'
      const r = await a.previewImportAction('phone,name\n12,bad\n09121119999,خوب\n')
      expect(r.ok).toBe(true)
      if (r.ok) {
        expect(r.data.errors).toHaveLength(1)
        expect(r.data.errors[0].line).toBe(2)
      }
    })
  })
})
