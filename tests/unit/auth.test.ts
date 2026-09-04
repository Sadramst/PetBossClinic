import { describe, it, expect } from 'vitest'
import {
  hashPassword,
  verifyPassword,
  createSessionToken,
  verifySessionToken,
  hasRoleAccess,
} from '@/lib/auth'

describe('Authentication & Cryptographic Security Tests', () => {
  it('correctly hashes passwords with unique salts', () => {
    const password = 'SuperAdmin@PetBoss2026!'
    const hash1 = hashPassword(password)
    const hash2 = hashPassword(password)

    expect(hash1).not.toBe(hash2)
    expect(hash1).toContain(':')
    expect(hash2).toContain(':')
  })

  it('successfully verifies correct password against hash', () => {
    const password = 'Admin@PetBoss2026!'
    const hash = hashPassword(password)

    expect(verifyPassword(password, hash)).toBe(true)
    expect(verifyPassword('WrongPassword123!', hash)).toBe(false)
  })

  it('creates and verifies valid signed HMAC session tokens', () => {
    const user = {
      id: 'usr_super_123',
      email: 'superadmin@petboss.com',
      name: 'Super Admin',
      role: 'SUPER_ADMIN' as const,
    }

    const token = createSessionToken(user)
    expect(token).toBeTypeOf('string')
    expect(token).toContain('.')

    const session = verifySessionToken(token)
    expect(session).not.toBeNull()
    expect(session?.userId).toBe(user.id)
    expect(session?.email).toBe(user.email)
    expect(session?.role).toBe('SUPER_ADMIN')
  })

  it('rejects tampered or forged session tokens', () => {
    const user = {
      id: 'usr_admin_456',
      email: 'admin@petboss.com',
      name: 'Admin',
      role: 'ADMIN' as const,
    }

    const token = createSessionToken(user)
    const [payload, signature] = token.split('.')

    // Tamper with payload
    const forgedToken = `${payload}x.${signature}`
    expect(verifySessionToken(forgedToken)).toBeNull()

    // Tamper with signature
    const forgedSigToken = `${payload}.${signature}abc`
    expect(verifySessionToken(forgedSigToken)).toBeNull()
  })

  it('enforces strict role-based access control (RBAC) hierarchy', () => {
    // SUPER_ADMIN has access to all levels
    expect(hasRoleAccess('SUPER_ADMIN', 'SUPER_ADMIN')).toBe(true)
    expect(hasRoleAccess('SUPER_ADMIN', 'ADMIN')).toBe(true)
    expect(hasRoleAccess('SUPER_ADMIN', 'EDITOR')).toBe(true)
    expect(hasRoleAccess('SUPER_ADMIN', 'VIEWER')).toBe(true)

    // ADMIN has operational access but cannot access SUPER_ADMIN
    expect(hasRoleAccess('ADMIN', 'SUPER_ADMIN')).toBe(false)
    expect(hasRoleAccess('ADMIN', 'ADMIN')).toBe(true)
    expect(hasRoleAccess('ADMIN', 'EDITOR')).toBe(true)
    expect(hasRoleAccess('ADMIN', 'VIEWER')).toBe(true)

    // EDITOR can edit content but cannot access ADMIN or SUPER_ADMIN
    expect(hasRoleAccess('EDITOR', 'SUPER_ADMIN')).toBe(false)
    expect(hasRoleAccess('EDITOR', 'ADMIN')).toBe(false)
    expect(hasRoleAccess('EDITOR', 'EDITOR')).toBe(true)
  })
})
