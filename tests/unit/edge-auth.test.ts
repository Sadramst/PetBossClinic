/** @vitest-environment node */
import { describe, it, expect } from 'vitest'
import { createSessionToken } from '@/lib/auth'
import { verifySessionTokenEdge } from '@/lib/auth/edge'

describe('Edge Web Crypto Session Verification (lib/auth/edge.ts)', () => {
  const mockUser = {
    id: 'user_clnx1234567890',
    email: 'admin@petbossclinic.com',
    name: 'Doctor PetBoss',
    role: 'ADMIN' as const,
  }

  it('successfully verifies a legitimately signed session token via Web Crypto', async () => {
    const token = createSessionToken(mockUser)
    expect(token).toContain('.')

    const verified = await verifySessionTokenEdge(token)
    expect(verified).not.toBeNull()
    expect(verified?.userId).toBe(mockUser.id)
    expect(verified?.email).toBe(mockUser.email)
    expect(verified?.role).toBe('ADMIN')
    expect(verified?.name).toBe('Doctor PetBoss')
    expect(verified?.expiresAt).toBeGreaterThan(Math.floor(Date.now() / 1000))
  })

  it('rejects an arbitrary forged cookie string (closing the PII leak)', async () => {
    // Attack scenario: Attacker sets document.cookie = "petboss_session=anything"
    const forgedToken1 = 'anything'
    const forgedToken2 = 'forged_session_token_value'
    const forgedToken3 = 'eyJuYW1lIjoiYWRtaW4ifQ.fakedsignature'

    expect(await verifySessionTokenEdge(forgedToken1)).toBeNull()
    expect(await verifySessionTokenEdge(forgedToken2)).toBeNull()
    expect(await verifySessionTokenEdge(forgedToken3)).toBeNull()
  })

  it('rejects a token with a tampered signature', async () => {
    const validToken = createSessionToken(mockUser)
    const [payload, signature] = validToken.split('.')
    // Tamper with one character of the signature
    const tamperedSignature = signature.slice(0, -1) + (signature.endsWith('a') ? 'b' : 'a')
    const tamperedToken = `${payload}.${tamperedSignature}`

    const result = await verifySessionTokenEdge(tamperedToken)
    expect(result).toBeNull()
  })

  it('rejects a token with tampered payload elevation', async () => {
    const validToken = createSessionToken({ ...mockUser, role: 'VIEWER' })
    const [, signature] = validToken.split('.')

    // Attacker alters payload to claim SUPER_ADMIN with previous signature
    const elevatedPayload = Buffer.from(
      JSON.stringify({
        userId: mockUser.id,
        email: mockUser.email,
        name: mockUser.name,
        role: 'SUPER_ADMIN',
        expiresAt: Math.floor(Date.now() / 1000) + 3600,
      })
    ).toString('base64url')

    const attackToken = `${elevatedPayload}.${signature}`
    const result = await verifySessionTokenEdge(attackToken)
    expect(result).toBeNull()
  })

  it('rejects an expired token', async () => {
    // Generate an expired payload
    const expiredPayload = {
      userId: mockUser.id,
      email: mockUser.email,
      name: mockUser.name,
      role: mockUser.role,
      expiresAt: Math.floor(Date.now() / 1000) - 300, // expired 5 minutes ago
    }

    const encoded = Buffer.from(JSON.stringify(expiredPayload)).toString('base64url')
    // Sign it with the test secret
    const crypto = await import('crypto')
    const secret = process.env.NEXTAUTH_SECRET || process.env.AUTH_SECRET || 'petboss-super-secure-secret-key-2026-v1'
    const sig = crypto.createHmac('sha256', secret).update(encoded).digest('base64url')
    const expiredToken = `${encoded}.${sig}`

    const result = await verifySessionTokenEdge(expiredToken)
    expect(result).toBeNull()
  })
})
