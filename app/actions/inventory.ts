'use server'

import { revalidatePath } from 'next/cache'
import { db } from '@/lib/db'
import { getSessionWithRole } from '@/lib/auth'
import { logAdminChange } from '@/lib/audit'
import { parseJalaliInput } from '@/lib/date/jalali'
import { syncProductStock } from '@/lib/shop/stock-sync'
import { productPath } from '@/lib/shop/urls'

export interface InventoryActionState {
  error?: string
  success?: boolean
  message?: string
}

const UNAUTHORIZED = { error: 'دسترسی غیرمجاز.' }

async function afterChange(productId: string) {
  await syncProductStock(productId)
  const p = await db.product.findUnique({ where: { id: productId }, select: { slugFa: true } })
  try {
    if (p) {
      // Persian slugs: revalidate both the percent-encoded and the raw form of the path.
      revalidatePath(productPath(p.slugFa))
      revalidatePath(`/product/${p.slugFa}`)
    }
    revalidatePath('/shop')
    revalidatePath('/admin/inventory')
  } catch {
    /* revalidation is best-effort */
  }
}

function parseOptionalDate(raw: FormDataEntryValue | null, label: string): Date | null | { error: string } {
  const text = raw?.toString().trim()
  if (!text) return null
  const d = parseJalaliInput(text)
  return d ?? { error: `${label} نامعتبر است. نمونه صحیح: ۱۴۰۵/۰۶/۱۵` }
}

/** Records a delivered stock batch with its expiry date. */
export async function addBatchAction(formData: FormData): Promise<InventoryActionState> {
  const session = await getSessionWithRole('EDITOR')
  if (!session) return UNAUTHORIZED

  const productRef = formData.get('product')?.toString().trim()
  const quantity = Number(formData.get('quantity'))
  if (!productRef) return { error: 'محصول را انتخاب کنید.' }
  if (!Number.isInteger(quantity) || quantity < 0 || quantity > 100000) return { error: 'تعداد باید عدد صحیح مثبت باشد.' }

  // The picker submits "SKU — name"; accept SKU, id or exact name.
  const sku = productRef.split(' — ')[0].trim()
  const product = await db.product.findFirst({
    where: { deletedAt: null, OR: [{ sku }, { id: productRef }, { nameFa: productRef }] },
    select: { id: true, nameFa: true, tracksExpiry: true },
  })
  if (!product) return { error: 'محصول پیدا نشد. از فهرست پیشنهادی انتخاب کنید.' }

  const expiry = parseOptionalDate(formData.get('expiryDate'), 'تاریخ انقضا')
  if (expiry && 'error' in expiry) return expiry
  const manufacture = parseOptionalDate(formData.get('manufactureDate'), 'تاریخ تولید')
  if (manufacture && 'error' in manufacture) return manufacture
  if (product.tracksExpiry && !expiry) return { error: 'این کالا تاریخ انقضا دارد؛ تاریخ انقضا را وارد کنید.' }
  if (expiry && manufacture && manufacture.getTime() >= expiry.getTime()) {
    return { error: 'تاریخ تولید باید پیش از تاریخ انقضا باشد.' }
  }

  const batch = await db.inventory.create({
    data: {
      productId: product.id,
      quantity,
      expiryDate: expiry,
      manufactureDate: manufacture,
      batchNumber: formData.get('batchNumber')?.toString().trim() || null,
      location: formData.get('location')?.toString().trim() || null,
      note: formData.get('note')?.toString().trim() || null,
    },
  })

  await logAdminChange({ action: 'CREATE', entity: 'INVENTORY_BATCH', entityId: batch.id, after: batch })
  await afterChange(product.id)
  return { success: true, message: `بچ جدید برای «${product.nameFa}» ثبت شد.` }
}

/** Sets the remaining quantity of a batch (e.g. after a sale or stock count). */
export async function updateBatchQuantityAction(batchId: string, quantity: number): Promise<InventoryActionState> {
  const session = await getSessionWithRole('EDITOR')
  if (!session) return UNAUTHORIZED
  if (!Number.isInteger(quantity) || quantity < 0 || quantity > 100000) return { error: 'تعداد نامعتبر است.' }

  const before = await db.inventory.findUnique({ where: { id: batchId } })
  if (!before) return { error: 'بچ پیدا نشد.' }
  const after = await db.inventory.update({ where: { id: batchId }, data: { quantity } })

  await logAdminChange({ action: 'UPDATE', entity: 'INVENTORY_BATCH', entityId: batchId, before, after })
  await afterChange(before.productId)
  return { success: true, message: 'موجودی بچ به‌روزرسانی شد.' }
}

export async function deleteBatchAction(batchId: string): Promise<InventoryActionState> {
  const session = await getSessionWithRole('EDITOR')
  if (!session) return UNAUTHORIZED

  const before = await db.inventory.findUnique({ where: { id: batchId } })
  if (!before) return { error: 'بچ پیدا نشد.' }
  await db.inventory.delete({ where: { id: batchId } })

  await logAdminChange({ action: 'DELETE', entity: 'INVENTORY_BATCH', entityId: batchId, before })
  await afterChange(before.productId)
  return { success: true, message: 'بچ حذف شد.' }
}

/** Marks whether a product is perishable (requires an expiry date on every batch). */
export async function setTracksExpiryAction(productId: string, tracksExpiry: boolean): Promise<InventoryActionState> {
  const session = await getSessionWithRole('EDITOR')
  if (!session) return UNAUTHORIZED
  await db.product.update({ where: { id: productId }, data: { tracksExpiry } })
  await afterChange(productId)
  return { success: true }
}
