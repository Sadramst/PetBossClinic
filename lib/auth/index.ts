import crypto from 'crypto'
import { cookies } from 'next/headers'
import { Role } from '@prisma/client'

const SESSION_COOKIE_NAME = 'petboss_session'
const SESSION_SECRET = process.env.NEXTAUTH_SECRET || process.env.AUTH_SECRET || 'petboss-super-secure-secret-key-2026-v1'
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7 // 7 days

export interface SessionPayload {
  userId: string
  email: string
  name: string
  role: Role
  expiresAt: number
}

/**
 * Hash password using crypto scrypt with random salt
 */
export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex')
  const derivedKey = crypto.scryptSync(password, salt, 64)
  return `${salt}:${derivedKey.toString('hex')}`
}

/**
 * Verify password against stored hash
 */
export function verifyPassword(password: string, storedHash: string): boolean {
  try {
    const [salt, key] = storedHash.split(':')
    if (!salt || !key) return false
    const keyBuffer = Buffer.from(key, 'hex')
    const derivedKey = crypto.scryptSync(password, salt, 64)
    return crypto.timingSafeEqual(keyBuffer, derivedKey)
  } catch {
    return false
  }
}

/**
 * Sign session payload to create tamper-proof token
 */
export function createSessionToken(user: {
  id: string
  email: string
  name?: string | null
  role: Role
}): string {
  const payload: SessionPayload = {
    userId: user.id,
    email: user.email,
    name: user.name || (user.role === 'SUPER_ADMIN' ? 'Super Administrator' : 'Administrator'),
    role: user.role,
    expiresAt: Math.floor(Date.now() / 1000) + SESSION_MAX_AGE_SECONDS,
  }

  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString('base64url')
  const signature = crypto
    .createHmac('sha256', SESSION_SECRET)
    .update(encodedPayload)
    .digest('base64url')

  return `${encodedPayload}.${signature}`
}

/**
 * Verify signed session token and return parsed payload
 */
export function verifySessionToken(token: string): SessionPayload | null {
  try {
    const parts = token.split('.')
    if (parts.length !== 2) return null
    const [encodedPayload, signature] = parts
    const expectedSignature = crypto
      .createHmac('sha256', SESSION_SECRET)
      .update(encodedPayload)
      .digest('base64url')

    if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature))) {
      return null
    }

    const payload: SessionPayload = JSON.parse(
      Buffer.from(encodedPayload, 'base64url').toString('utf-8')
    )

    if (payload.expiresAt < Math.floor(Date.now() / 1000)) {
      return null
    }

    return payload
  } catch {
    return null
  }
}

/**
 * Get active session from HTTP cookies
 */
export async function getSession(): Promise<SessionPayload | null> {
  const cookieStore = await cookies()
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value
  if (!token) return null
  return verifySessionToken(token)
}

/**
 * Set session cookie
 */
export async function setSessionCookie(token: string): Promise<void> {
  const cookieStore = await cookies()
  cookieStore.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_MAX_AGE_SECONDS,
  })
}

/**
 * Destroy session cookie
 */
export async function clearSessionCookie(): Promise<void> {
  const cookieStore = await cookies()
  cookieStore.delete(SESSION_COOKIE_NAME)
}

/**
 * Check if a role meets required minimum role
 */
export function hasRoleAccess(userRole: Role, requiredRole: Role): boolean {
  const roleHierarchy: Record<Role, number> = {
    SUPER_ADMIN: 5,
    ADMIN: 4,
    EDITOR: 3,
    AUTHOR: 2,
    VIEWER: 1,
  }

  return (roleHierarchy[userRole] ?? 0) >= (roleHierarchy[requiredRole] ?? 0)
}
