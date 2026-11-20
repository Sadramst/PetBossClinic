import { describe, it, expect } from 'vitest'
import { parseAuditQuery, buildAuditWhere, diffAudit, actorOf, auditActionLabel, auditEntityLabel } from '@/lib/admin/audit-view'

describe('parseAuditQuery', () => {
  it('defaults', () => {
    expect(parseAuditQuery({})).toEqual({ entity: '', action: '', user: '', q: '', from: '', to: '', page: 1, size: 50 })
  })
  it('rejects malformed input', () => {
    const q = parseAuditQuery({ entity: 'x; DROP', from: '2026-13-99', page: '-4', size: '7', to: '2026-02-30' })
    expect(q.entity).toBe('')
    expect(q.from).toBe('')
    expect(q.to).toBe('')
    expect(q.page).toBe(1)
    expect(q.size).toBe(50)
  })
  it('accepts valid values and first of arrays', () => {
    const q = parseAuditQuery({ entity: ['ORDER', 'POST'], action: 'UPDATE', from: '2026-11-01', page: '3', size: '100' })
    expect(q).toMatchObject({ entity: 'ORDER', action: 'UPDATE', from: '2026-11-01', page: 3, size: 100 })
  })
})

describe('buildAuditWhere', () => {
  it('makes `to` inclusive of the full day', () => {
    const w = buildAuditWhere(parseAuditQuery({ from: '2026-11-01', to: '2026-11-03' })) as { createdAt: { gte: Date; lt: Date } }
    expect(w.createdAt.gte.toISOString()).toBe('2026-11-01T00:00:00.000Z')
    expect(w.createdAt.lt.toISOString()).toBe('2026-11-04T00:00:00.000Z')
  })
  it('combines filters', () => {
    const w = buildAuditWhere(parseAuditQuery({ entity: 'ORDER', user: 'u1', q: 'abc' })) as Record<string, unknown>
    expect(w.entity).toBe('ORDER')
    expect(w.userId).toBe('u1')
    expect(Array.isArray(w.OR)).toBe(true)
  })
})

describe('diffAudit', () => {
  it('detects changed, added, removed and skips bookkeeping', () => {
    const rows = diffAudit({ a: 1, b: 'x', c: { d: 1 } }, { a: 2, c: { d: 1, e: 5 }, f: true, _actor: { id: 'u' }, updatedAt: 'z' })
    expect(rows).toEqual([
      { path: 'a', kind: 'changed', before: 1, after: 2 },
      { path: 'b', kind: 'removed', before: 'x' },
      { path: 'c.e', kind: 'added', after: 5 },
      { path: 'f', kind: 'added', after: true },
    ])
  })
  it('create (no before) lists every field as added', () => {
    expect(diffAudit(null, { x: 1 })).toEqual([{ path: 'x', kind: 'added', after: 1 }])
  })
  it('delete (no after) lists every field as removed', () => {
    expect(diffAudit({ x: 1 }, null)).toEqual([{ path: 'x', kind: 'removed', before: 1 }])
  })
  it('identical gives nothing, caps rows', () => {
    expect(diffAudit({ a: 1 }, { a: 1 })).toEqual([])
    const big = Object.fromEntries(Array.from({ length: 500 }, (_, i) => [`k${i}`, i]))
    expect(diffAudit({}, big, 50)).toHaveLength(50)
  })
})

describe('misc', () => {
  it('actorOf', () => {
    expect(actorOf({ _actor: { id: 'u', name: 'n' } })).toEqual({ id: 'u', name: 'n' })
    expect(actorOf(null)).toBeNull()
  })
  it('labels fall back to raw key', () => {
    expect(auditActionLabel('UPDATE')).toBe('ویرایش')
    expect(auditEntityLabel('WEIRD')).toBe('WEIRD')
  })
})

import { isSensitivePath } from '@/lib/admin/audit-view'
describe('isSensitivePath', () => {
  it('flags secrets', () => {
    expect(isSensitivePath('user.passwordHash')).toBe(true)
    expect(isSensitivePath('totpSecret')).toBe(true)
    expect(isSensitivePath('title')).toBe(false)
  })
})
