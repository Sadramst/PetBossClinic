import { describe, it, expect, vi, afterEach } from 'vitest'

vi.mock('next/headers', () => ({ cookies: vi.fn() }))

import * as auth from '@/lib/auth'

const session = (role: auth.SessionPayload['role']): auth.SessionPayload => ({
  userId: 'u1',
  email: 'u@petboss.com',
  name: 'U',
  role,
  expiresAt: Date.now() + 3600_000,
})

describe('getSessionWithRole', () => {
  afterEach(() => vi.restoreAllMocks())

  it('rejects a VIEWER for editor-level actions', async () => {
    const token = auth.createSessionToken({ id: 'u1', email: 'u@petboss.com', name: 'U', role: 'VIEWER' })
    const { cookies } = await import('next/headers')
    vi.mocked(cookies).mockResolvedValue({ get: () => ({ value: token }) } as never)

    expect(await auth.getSessionWithRole('EDITOR')).toBeNull()
    expect((await auth.getSessionWithRole('VIEWER'))?.role).toBe('VIEWER')
  })

  it('accepts higher roles', () => {
    expect(auth.hasRoleAccess(session('ADMIN').role, 'EDITOR')).toBe(true)
    expect(auth.hasRoleAccess(session('AUTHOR').role, 'EDITOR')).toBe(false)
  })

  it('rejects tokens signed with the old public fallback secret', async () => {
    const { verifySessionToken } = auth
    // Forge a token the way an attacker would with the previously hard-coded secret.
    const crypto = await import('crypto')
    const payload = Buffer.from(JSON.stringify(session('SUPER_ADMIN'))).toString('base64url')
    const sig = crypto.createHmac('sha256', 'petboss-super-secure-secret-key-2026-v1').update(payload).digest('base64url')
    expect(verifySessionToken(`${payload}.${sig}`)).toBeNull()
  })
})
