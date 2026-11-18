'use server'

import { revalidatePath } from 'next/cache'
import { OrderStatus } from '@prisma/client'
import { db } from '@/lib/db'
import { getSessionWithRole } from '@/lib/auth'
import { logAdminChange } from '@/lib/audit'
import crypto from 'crypto'
import { allocateOrderStock, releaseOrderStock } from '@/lib/shop/orders'
import { hashPassword, validatePassword } from '@/lib/customer/password'
import { ORDER_STATUS_LABEL, canTransition } from '@/components/admin/order-status'

export interface AdminOrderState {
  error?: string
  ok?: boolean
}

const STATUSES = Object.values(OrderStatus)
const ALLOCATED: OrderStatus[] = ['CONFIRMED', 'PROCESSING', 'SHIPPED', 'DELIVERED']

export async function updateOrderAction(
  orderId: string,
  input: {
    status: OrderStatus
    trackingCode?: string
    adminNote?: string
    /** Must be true to confirm an unpaid online order (payment received outside the gateway). */
    confirmPaid?: boolean
  }
): Promise<AdminOrderState> {
  const session = await getSessionWithRole('EDITOR')
  if (!session) return { error: 'دسترسی غیرمجاز.' }
  if (!STATUSES.includes(input.status)) return { error: 'وضعیت نامعتبر است.' }

  const before = await db.order.findUnique({ where: { id: orderId } })
  if (!before) return { error: 'سفارش پیدا نشد.' }

  if (!canTransition(before.status, input.status, session.role)) {
    return {
      error: `تغییر وضعیت از «${ORDER_STATUS_LABEL[before.status]}» به «${ORDER_STATUS_LABEL[input.status]}» مجاز نیست.`,
    }
  }

  // Manual confirmation of an unpaid online order (e.g. paid by card-to-card).
  const marksPaid = input.status === 'CONFIRMED' && before.status !== 'CONFIRMED' && !before.paidAt && before.paymentMethod === 'ONLINE'
  if (marksPaid && !input.confirmPaid) {
    return { error: 'این سفارش آنلاین هنوز پرداخت نشده است. برای تأیید، دریافت وجه را تأیید کنید.' }
  }

  const trackingCode = input.trackingCode?.trim().slice(0, 60) || null
  const adminNote = input.adminNote?.trim().slice(0, 1000) || null

  // Conditional on the status we read: two staff saving at once cannot both apply a transition.
  const claimed = await db.order.updateMany({
    where: { id: orderId, status: before.status },
    data: {
      status: input.status,
      trackingCode,
      adminNote,
      ...(marksPaid ? { paidAt: new Date() } : {}),
    },
  })
  if (claimed.count === 0) return { error: 'این سفارش هم‌زمان توسط کاربر دیگری تغییر کرد. صفحه را تازه کنید.' }

  // Keep shelf stock in line with the order's life cycle (both helpers are idempotent).
  if (ALLOCATED.includes(input.status)) await allocateOrderStock(orderId)
  else await releaseOrderStock(orderId)

  const after = await db.order.findUnique({ where: { id: orderId } })
  await logAdminChange({
    action: 'UPDATE',
    entity: 'ORDER',
    entityId: orderId,
    before: { number: before.number, status: before.status, trackingCode: before.trackingCode, paidAt: before.paidAt, adminNote: before.adminNote },
    after: { number: before.number, status: after?.status, trackingCode: after?.trackingCode, paidAt: after?.paidAt, adminNote: after?.adminNote },
    details: { orderNumber: before.number, ...(marksPaid ? { markedPaidManually: true } : {}) },
  })
  revalidatePath('/admin/orders')
  revalidatePath('/admin')
  return { ok: true }
}

/** No look-alike characters (0/O, 1/l/I) so the password can be read out over the phone. */
const TEMP_PASSWORD_ALPHABET = 'abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789'

function generateTemporaryPassword(phone: string): string {
  for (;;) {
    const candidate = Array.from({ length: 10 }, () => TEMP_PASSWORD_ALPHABET[crypto.randomInt(TEMP_PASSWORD_ALPHABET.length)]).join('')
    if (!validatePassword(candidate, phone)) return candidate
  }
}

/**
 * For a customer who forgot their password while SMS login is unavailable: sets a one-time
 * temporary password the admin reads out over the phone after confirming who is calling.
 * Every existing session of that customer ends. The password is returned once and is
 * neither stored in readable form nor written to the audit log.
 */
export async function resetCustomerPasswordAction(customerId: string): Promise<AdminOrderState & { password?: string }> {
  const session = await getSessionWithRole('ADMIN')
  if (!session) return { error: 'فقط مدیر می‌تواند رمز عبور مشتری را بازنشانی کند.' }

  const customer = await db.customer.findUnique({ where: { id: customerId }, select: { id: true, phone: true } })
  if (!customer) return { error: 'مشتری پیدا نشد.' }

  const password = generateTemporaryPassword(customer.phone)
  await db.customer.update({
    where: { id: customer.id },
    data: {
      passwordHash: await hashPassword(password),
      failedLogins: 0,
      lastFailedAt: null,
      sessionVersion: { increment: 1 },
    },
  })
  await logAdminChange({
    action: 'UPDATE',
    entity: 'CUSTOMER',
    entityId: customer.id,
    details: { passwordReset: true, phone: customer.phone },
  })
  return { ok: true, password }
}

export async function setCustomerBlockedAction(customerId: string, isBlocked: boolean): Promise<AdminOrderState> {
  const session = await getSessionWithRole('ADMIN')
  if (!session) return { error: 'فقط مدیر می‌تواند مشتری را مسدود یا فعال کند.' }
  try {
    const c = await db.customer.update({ where: { id: customerId }, data: { isBlocked }, select: { phone: true } })
    await logAdminChange({ action: 'UPDATE', entity: 'CUSTOMER', entityId: customerId, after: { isBlocked, phone: c.phone } })
  } catch {
    return { error: 'مشتری پیدا نشد.' }
  }
  revalidatePath('/admin/customers')
  return { ok: true }
}
