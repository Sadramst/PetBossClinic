import { describe, it, expect, vi, beforeEach } from 'vitest'
import { requireAdmin } from '@/lib/auth/guard'
import * as authModule from '@/lib/auth'

// Mock next/navigation
vi.mock('next/navigation', () => ({
  redirect: vi.fn((url: string) => {
    throw new Error(`NEXT_REDIRECT:${url}`)
  }),
}))

describe('Server-Side requireAdmin Guard (lib/auth/guard.ts)', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('redirects unauthenticated requests to /admin/login', async () => {
    vi.spyOn(authModule, 'getSession').mockResolvedValue(null)

    await expect(requireAdmin('VIEWER', 'fa')).rejects.toThrow('NEXT_REDIRECT:/admin/login')
  })

  it('redirects unauthenticated English requests to /en/admin/login', async () => {
    vi.spyOn(authModule, 'getSession').mockResolvedValue(null)

    await expect(requireAdmin('VIEWER', 'en')).rejects.toThrow('NEXT_REDIRECT:/en/admin/login')
  })

  it('redirects when authenticated user does not have required minimum role', async () => {
    vi.spyOn(authModule, 'getSession').mockResolvedValue({
      userId: 'u1',
      email: 'viewer@petboss.com',
      name: 'Viewer User',
      role: 'VIEWER',
      expiresAt: Math.floor(Date.now() / 1000) + 3600,
    })

    // VIEWER attempting to access ADMIN required page (e.g. settings)
    await expect(requireAdmin('ADMIN', 'fa')).rejects.toThrow('NEXT_REDIRECT:/admin/login')
  })

  it('allows access when authenticated user role meets requirement', async () => {
    const mockSession: authModule.SessionPayload = {
      userId: 'u1',
      email: 'admin@petboss.com',
      name: 'Admin User',
      role: 'ADMIN',
      expiresAt: Math.floor(Date.now() / 1000) + 3600,
    }
    vi.spyOn(authModule, 'getSession').mockResolvedValue(mockSession)

    const session = await requireAdmin('VIEWER', 'fa')
    expect(session.userId).toBe('u1')
    expect(session.role).toBe('ADMIN')
  })

  it('allows SUPER_ADMIN to access all roles', async () => {
    const mockSession: authModule.SessionPayload = {
      userId: 'super1',
      email: 'superadmin@petboss.com',
      name: 'Super Admin',
      role: 'SUPER_ADMIN',
      expiresAt: Math.floor(Date.now() / 1000) + 3600,
    }
    vi.spyOn(authModule, 'getSession').mockResolvedValue(mockSession)

    const session = await requireAdmin('SUPER_ADMIN', 'fa')
    expect(session.role).toBe('SUPER_ADMIN')
  })
})
