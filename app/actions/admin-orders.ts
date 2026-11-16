'use server'

import { revalidatePath } from 'next/cache'
import { OrderStatus } from '@prisma/client'
import { db } from '@/lib/db'
import { getSessionWithRole } from '@/lib/auth'
import { logAdminChange } from '@/lib/audit'
import { allocateOrderStock, releaseOrderStock } from '@/lib/shop/orders'

export interface AdminOrderState {
  error?: string
  ok?: boolean
}

const STATUSES = Object.values(OrderStatus)

export async function updateOrderAction(
  orderId: string,
  input: { status: OrderStatus; trackingCode?: string; adminNote?: string }
): Promise<AdminOrderState> {
  const session = await getSessionWithRole('EDITOR')
  if (!session) return { error: 'دسترسی غیرمجاز.' }
  if (!STATUSES.includes(input.status)) return { error: 'وضعیت نامعتبر است.' }

  const before = await db.order.findUnique({ where: { id: orderId } })
  if (!before) return { error: 'سفارش پیدا نشد.' }

  const after = await db.order.update({
    where: { id: orderId },
    data: {
      status: input.status,
      trackingCode: input.trackingCode?.trim().slice(0, 60) || null,
      adminNote: input.adminNote?.trim().slice(0, 1000) || null,
      // Manual confirmation of an unpaid online order (e.g. paid by card-to-card).
      ...(input.status === 'CONFIRMED' && !before.paidAt && before.paymentMethod === 'ONLINE' ? { paidAt: new Date() } : {}),
    },
  })

  // Keep shelf stock in line with the order's life cycle.
  if (input.status === 'CANCELLED') await releaseOrderStock(orderId)
  else if (['CONFIRMED', 'PROCESSING', 'SHIPPED', 'DELIVERED'].includes(input.status)) await allocateOrderStock(orderId)

  await logAdminChange({
    action: 'UPDATE',
    entity: 'ORDER',
    entityId: orderId,
    before: { status: before.status, trackingCode: before.trackingCode },
    after: { status: after.status, trackingCode: after.trackingCode },
  })
  revalidatePath('/admin/orders')
  return { ok: true }
}

export async function setCustomerBlockedAction(customerId: string, isBlocked: boolean): Promise<AdminOrderState> {
  const session = await getSessionWithRole('ADMIN')
  if (!session) return { error: 'دسترسی غیرمجاز.' }
  await db.customer.update({ where: { id: customerId }, data: { isBlocked } })
  await logAdminChange({ action: 'UPDATE', entity: 'CUSTOMER', entityId: customerId, after: { isBlocked } })
  revalidatePath('/admin/customers')
  return { ok: true }
}
