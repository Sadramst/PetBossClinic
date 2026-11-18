import { describe, it, expect, vi } from 'vitest'

vi.mock('server-only', () => ({}))
vi.mock('next/headers', () => ({ cookies: vi.fn() }))
vi.mock('next/navigation', () => ({ redirect: vi.fn() }))
vi.mock('@/lib/db', () => ({ db: {} }))

import { hashPassword, verifyPassword, validatePassword, PASSWORD_MAX } from '@/lib/customer/password'
import { signCustomerToken, parseCustomerToken, verifyCustomerToken } from '@/lib/customer/session'

describe('customer passwords', () => {
  it('hashes with a random salt and verifies', async () => {
    const a = await hashPassword('Sag-va-Gorbeh-1405')
    const b = await hashPassword('Sag-va-Gorbeh-1405')
    expect(a).toMatch(/^scrypt\$16384\$[0-9a-f]{32}\$[0-9a-f]{128}$/)
    expect(a).not.toBe(b) // different salts
    expect(await verifyPassword('Sag-va-Gorbeh-1405', a)).toBe(true)
    expect(await verifyPassword('Sag-va-Gorbeh-1406', a)).toBe(false)
    expect(await verifyPassword('', a)).toBe(false)
  })

  it('rejects malformed or unsafe stored hashes instead of throwing', async () => {
    for (const bad of ['', 'plain', 'scrypt$x$y$z', 'scrypt$16384$zz$zz', 'scrypt$999999999$aa$bb', 'bcrypt$16384$aa$bb']) {
      expect(await verifyPassword('anything', bad)).toBe(false)
    }
  })

  it('enforces the password policy with Persian messages', () => {
    expect(validatePassword('Abcdef12', '09121234567')).toBeNull()
    expect(validatePassword('گربه‌های-پت‌باس-۱۴۰۵')).toBeNull()
    expect(validatePassword('short1')).toMatch(/حداقل/)
    expect(validatePassword('x'.repeat(PASSWORD_MAX + 1))).toMatch(/بیشتر/)
    expect(validatePassword('12345678')).toMatch(/عدد/)
    expect(validatePassword('۱۲۳۴۵۶۷۸۹')).toMatch(/عدد/)
    expect(validatePassword('aaaaaaaa')).toMatch(/ساده/)
    expect(validatePassword('pass21234567', '09121234567')).toMatch(/شماره موبایل/)
  })
})

describe('customer session token versions', () => {
  it('carries the session version and stays compatible with older tokens', () => {
    const now = Date.now()
    expect(parseCustomerToken(signCustomerToken('c1', now, 3), now)).toEqual({ id: 'c1', version: 3 })
    expect(parseCustomerToken(signCustomerToken('c1', now), now)).toEqual({ id: 'c1', version: 0 })
    expect(verifyCustomerToken(signCustomerToken('c1', now, 7), now)).toBe('c1')
  })

  it('does not let a token be re-labelled with a newer version', () => {
    const now = Date.now()
    const [body, sig] = signCustomerToken('c1', now, 0).split('.')
    const forged = Buffer.from(JSON.stringify({ ...JSON.parse(Buffer.from(body, 'base64url').toString()), v: 9 })).toString('base64url')
    expect(parseCustomerToken(`${forged}.${sig}`, now)).toBeNull()
  })
})
