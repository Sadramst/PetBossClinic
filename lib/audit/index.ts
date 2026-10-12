import { db } from '@/lib/db'
import { getSession } from '@/lib/auth'
import { headers } from 'next/headers'

export interface LogAuditOptions {
  action: 'CREATE' | 'UPDATE' | 'DELETE' | 'BULK_DELETE' | 'LOGIN' | 'LOGOUT' | string
  entity: 'PRODUCT' | 'PRODUCT_CATEGORY' | 'SERVICE' | 'DIVISION' | 'STAFF' | 'SITE_SETTING' | 'THEME' | 'FAQ' | 'USER' | 'MEDIA' | string
  entityId: string
  before?: unknown
  after?: unknown
  details?: Record<string, unknown>
  ip?: string
  location?: string
  userAgent?: string
  userId?: string
}

/**
 * Universal Audit Logger for Pet Boss Clinic Administration.
 * Records precise timestamps, location stamps (IP, city, country, network),
 * actor identities (who changed it), and before/after state snapshots.
 */
export async function logAdminChange(options: LogAuditOptions) {
  try {
    let clientIp = options.ip || null
    let userAgent = options.userAgent || null
    let locationStr = options.location || null
    let resolvedUserId = options.userId || null
    let resolvedActorEmail = 'admin@petbossclinic.com'
    let resolvedActorName = 'مدیر سیستم'

    // Extract network and location metadata from request headers
    try {
      const headerList = await headers()
      if (!clientIp) {
        clientIp =
          headerList.get('x-forwarded-for')?.split(',')[0]?.trim() ||
          headerList.get('x-real-ip') ||
          headerList.get('cf-connecting-ip') ||
          '127.0.0.1'
      }
      if (!userAgent) {
        userAgent = headerList.get('user-agent') || 'PetBoss Clinic Admin Console'
      }
      if (!locationStr) {
        const country = headerList.get('x-vercel-ip-country') || headerList.get('cf-ipcountry') || ''
        const city = headerList.get('x-vercel-ip-city') || ''
        const region = headerList.get('x-vercel-ip-country-region') || ''

        if (city && country) {
          locationStr = region ? `${city}, ${region}, ${country}` : `${city}, ${country}`
        } else if (country) {
          locationStr = country === 'IR' ? 'ایران (Tehran, IR)' : `Country: ${country}`
        } else if (clientIp === '127.0.0.1' || clientIp === '::1' || clientIp?.startsWith('192.168.') || clientIp?.startsWith('10.')) {
          locationStr = 'شبکه داخلی کلینیک (Clinic Local Network)'
        } else {
          locationStr = `ایران / IP: ${clientIp}`
        }
      }
    } catch {
      if (!clientIp) clientIp = '127.0.0.1'
      if (!locationStr) locationStr = 'کلینیک پت باس (Pet Boss System)'
    }

    // Resolve authenticated actor
    try {
      const session = await getSession()
      if (session) {
        resolvedUserId = session.userId
        resolvedActorEmail = session.email
        resolvedActorName = session.name || (session.role === 'SUPER_ADMIN' ? 'مدیر ارشد' : 'مدیر')
      }
    } catch {
      // Direct action or system execution
    }

    const isoTimestamp = new Date().toISOString()

    const enrichedAfter = options.after ? {
      ...(typeof options.after === 'object' && options.after !== null ? options.after : { data: options.after }),
      _actor: {
        id: resolvedUserId || 'admin-system',
        name: resolvedActorName,
        email: resolvedActorEmail,
      },
      _audit: {
        timestamp: isoTimestamp,
        location: locationStr,
        ip: clientIp,
      }
    } : (options.details ? {
      details: options.details,
      _actor: {
        id: resolvedUserId || 'admin-system',
        name: resolvedActorName,
        email: resolvedActorEmail,
      },
      _audit: {
        timestamp: isoTimestamp,
        location: locationStr,
        ip: clientIp,
      }
    } : null)

    const beforePayload = options.before ? (typeof options.before === 'object' ? (options.before as Record<string, unknown>) : { value: options.before }) : undefined

    await db.auditLog.create({
      data: {
        userId: resolvedUserId,
        action: options.action,
        entity: options.entity,
        entityId: options.entityId,
        ip: clientIp,
        location: locationStr,
        userAgent: userAgent ? userAgent.substring(0, 500) : null,
        before: beforePayload ? JSON.parse(JSON.stringify(beforePayload)) : undefined,
        after: enrichedAfter ? JSON.parse(JSON.stringify(enrichedAfter)) : undefined,
      }
    })
  } catch (err) {
    // Non-blocking error handling
    console.error('AuditLog recording error:', err)
  }
}
