'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { db } from '@/lib/db'
import { getSessionWithRole } from '@/lib/auth'
import { logAdminChange } from '@/lib/audit'
import { parseJalaliInput } from '@/lib/date/jalali'
import { syncProductStock } from '@/lib/shop/stock-sync'
import { productPath } from '@/lib/shop/urls'
import { checkRateLimit } from '@/lib/utils/rate-limit'
import { normalizeMobile } from '@/lib/text/iran'
import { getExpiryConfig, clearExpiryConfigCache } from '@/lib/shop/expiry-config'
import { formatJalaliDate } from '@/lib/shop/expiry'
import { parseBatchLine, validateExpiryConfig, type ParsedBatchLine } from '@/lib/shop/expiry-rules'

export interface InventoryActionState {
  error?: string
  success?: boolean
  message?: string
}

const UNAUTHORIZED = { error: 'دسترسی غیرمجاز.' }
const BUSY = 'تعداد درخواست‌ها زیاد است؛ کمی صبر کنید.'

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

/* ------------------------------------------------------------------ R1 admin actions */

const batchLineSchema = z.object({
  productId: z.string().trim().min(1).max(40),
  quantity: z.number(),
  manufactureDate: z.string().max(40).nullish(),
  expiryDate: z.string().max(40).nullish(),
  batchNumber: z.string().max(80).nullish(),
  location: z.string().max(80).nullish(),
  costPrice: z.number().nullish(),
  supplier: z.string().max(80).nullish(),
})

/** Saves several batch lines in one transaction. Any invalid line saves nothing. */
export async function addBatchesAction(lines: unknown): Promise<InventoryActionState & { saved?: number }> {
  const session = await getSessionWithRole('EDITOR')
  if (!session) return UNAUTHORIZED
  if (!checkRateLimit(`inv-batches:${session.userId}`, 20, 60_000).allowed) return { error: BUSY }
  const parsed = z.array(batchLineSchema).min(1, 'حداقل یک ردیف لازم است.').max(100, 'در هر بار حداکثر ۱۰۰ ردیف ثبت می‌شود.').safeParse(lines)
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'ردیف‌ها معتبر نیستند.' }

  const ids = [...new Set(parsed.data.map((l) => l.productId))]
  const products = await db.product.findMany({ where: { id: { in: ids }, deletedAt: null }, select: { id: true, nameFa: true, tracksExpiry: true } })
  const byId = new Map(products.map((p) => [p.id, p]))

  const ready: ParsedBatchLine[] = []
  for (let i = 0; i < parsed.data.length; i++) {
    const r = parseBatchLine(parsed.data[i], i, byId.get(parsed.data[i].productId))
    if (!r.ok) return { error: `${r.error} هیچ ردیفی ذخیره نشد.` }
    ready.push(r.line)
  }

  const created = await db.$transaction(
    ready.map((l) =>
      db.inventory.create({
        data: {
          productId: l.productId,
          quantity: l.quantity,
          expiryDate: l.expiryDate,
          manufactureDate: l.manufactureDate,
          batchNumber: l.batchNumber,
          location: l.location,
          costPrice: l.costPrice,
          supplier: l.supplier,
        },
      })
    )
  )
  await logAdminChange({ action: 'CREATE', entity: 'INVENTORY_BATCH', entityId: created[0].id, after: { count: created.length, ids: created.map((c) => c.id) } })
  for (const id of ids) await afterChange(id)
  return { success: true, saved: created.length, message: `${created.length.toLocaleString('fa-IR')} محموله ثبت شد.` }
}

const REASONS = ['COUNT', 'DAMAGE', 'RETURN', 'OTHER'] as const

/** Corrects a batch by `delta` units with a mandatory reason. Writes an InventoryAdjustment row. */
export async function adjustBatchAction(batchId: string, delta: number, reason: string, note?: string): Promise<InventoryActionState> {
  const session = await getSessionWithRole('ADMIN')
  if (!session) return UNAUTHORIZED
  if (!checkRateLimit(`inv-adjust:${session.userId}`, 60, 60_000).allowed) return { error: BUSY }
  if (!Number.isInteger(delta) || delta === 0 || Math.abs(delta) > 100000) return { error: 'مقدار تعدیل باید عدد صحیح و غیرصفر باشد.' }
  if (!(REASONS as readonly string[]).includes(reason)) return { error: 'دلیل تعدیل را انتخاب کنید.' }
  const cleanNote = note?.trim().slice(0, 300) || null
  if (reason === 'OTHER' && !cleanNote) return { error: 'برای دلیل «سایر» توضیح بنویسید.' }

  const result = await db.$transaction(async (tx) => {
    const before = await tx.inventory.findUnique({ where: { id: batchId } })
    if (!before) return { error: 'بچ پیدا نشد.' as const }
    if (before.quantity + delta < 0) return { error: 'تعدیل نمی‌تواند موجودی را منفی کند.' as const }
    // Compare-and-set: a parallel change to the same batch makes this update match nothing.
    const hit = await tx.inventory.updateMany({ where: { id: batchId, quantity: before.quantity }, data: { quantity: before.quantity + delta } })
    if (hit.count !== 1) return { error: 'موجودی همزمان تغییر کرد؛ دوباره تلاش کنید.' as const }
    const after = { ...before, quantity: before.quantity + delta }
    await tx.inventoryAdjustment.create({
      data: {
        inventoryId: batchId,
        productId: before.productId,
        delta,
        reason: reason as (typeof REASONS)[number],
        note: cleanNote,
        costAtLoss: delta < 0 && before.costPrice != null ? before.costPrice * -delta : null,
        adminId: session.userId,
      },
    })
    return { before, after }
  })
  if ('error' in result) return { error: result.error }
  await logAdminChange({ action: 'UPDATE', entity: 'INVENTORY_BATCH', entityId: batchId, before: result.before, after: result.after, details: { reason, delta } })
  await afterChange(result.before.productId)
  return { success: true, message: 'تعدیل ثبت شد.' }
}

/** Writes off the whole remaining batch (waste): quantity goes to 0 and the loss is logged. */
export async function writeOffBatchAction(batchId: string, note?: string): Promise<InventoryActionState> {
  const session = await getSessionWithRole('ADMIN')
  if (!session) return UNAUTHORIZED
  if (!checkRateLimit(`inv-writeoff:${session.userId}`, 30, 60_000).allowed) return { error: BUSY }
  const cleanNote = note?.trim().slice(0, 300) || null

  const result = await db.$transaction(async (tx) => {
    const before = await tx.inventory.findUnique({ where: { id: batchId } })
    if (!before) return { error: 'بچ پیدا نشد.' as const }
    if (before.quantity <= 0) return { error: 'این بچ موجودی ندارد.' as const }
    const hit = await tx.inventory.updateMany({ where: { id: batchId, quantity: before.quantity }, data: { quantity: 0 } })
    if (hit.count !== 1) return { error: 'موجودی همزمان تغییر کرد؛ دوباره تلاش کنید.' as const }
    const after = { ...before, quantity: 0 }
    await tx.inventoryAdjustment.create({
      data: {
        inventoryId: batchId,
        productId: before.productId,
        delta: -before.quantity,
        reason: 'WRITE_OFF',
        note: cleanNote,
        costAtLoss: before.costPrice != null ? before.costPrice * before.quantity : null,
        adminId: session.userId,
      },
    })
    return { before, after }
  })
  if ('error' in result) return { error: result.error }
  await logAdminChange({ action: 'UPDATE', entity: 'INVENTORY_BATCH', entityId: batchId, before: result.before, after: result.after, details: { reason: 'WRITE_OFF' } })
  await afterChange(result.before.productId)
  return { success: true, message: 'بچ امحا شد و ضایعات ثبت گردید.' }
}

/** Saves the expiry thresholds (singleton row). */
export async function saveExpiryConfigAction(values: unknown): Promise<InventoryActionState> {
  const session = await getSessionWithRole('ADMIN')
  if (!session) return UNAUTHORIZED
  const parsed = z
    .object({
      soonDays: z.number(),
      criticalDays: z.number(),
      minShelfLifeDays: z.number(),
      discountStartDays: z.number(),
      discountPercent: z.number(),
      digestPhones: z.array(z.string().max(20)).max(10).optional(),
    })
    .safeParse(values)
  if (!parsed.success) return { error: 'مقدارها معتبر نیستند.' }
  const { digestPhones, ...cfg } = parsed.data
  const err = validateExpiryConfig(cfg)
  if (err) return { error: err }
  let phones: string[] | undefined
  if (digestPhones) {
    phones = []
    for (const raw of digestPhones.map((p) => p.trim()).filter(Boolean)) {
      const n = normalizeMobile(raw)
      if (!n) return { error: `شماره «${raw}» معتبر نیست.` }
      if (!phones.includes(n)) phones.push(n)
    }
  }
  const before = await db.expiryConfig.findUnique({ where: { id: 'default' } })
  const after = await db.expiryConfig.upsert({
    where: { id: 'default' },
    create: { id: 'default', ...cfg, digestPhones: phones ?? [] },
    update: { ...cfg, ...(phones ? { digestPhones: phones } : {}) },
  })
  clearExpiryConfigCache()
  await logAdminChange({ action: 'UPDATE', entity: 'EXPIRY_CONFIG', entityId: 'default', before, after })
  try {
    revalidatePath('/admin/inventory')
    revalidatePath('/shop')
  } catch {
    /* best-effort */
  }
  return { success: true, message: 'تنظیمات انقضا ذخیره شد.' }
}

async function freeClearanceCode(): Promise<string> {
  for (let i = 0; i < 8; i++) {
    const code = `EXP-${Math.random().toString(36).slice(2, 8).toUpperCase()}`
    if (!(await db.coupon.findUnique({ where: { code }, select: { id: true } }))) return code
  }
  return `EXP-${Date.now().toString(36).toUpperCase()}`
}

/** One-click near-expiry discount: a product-scoped percent coupon that ends before the sale cutoff. */
export async function createExpiryCouponAction(productId: string, batchId: string): Promise<InventoryActionState & { code?: string }> {
  const session = await getSessionWithRole('ADMIN')
  if (!session) return UNAUTHORIZED
  const batch = await db.inventory.findUnique({ where: { id: batchId }, include: { product: { select: { id: true, nameFa: true } } } })
  if (!batch || batch.productId !== productId) return { error: 'بچ پیدا نشد.' }
  if (!batch.expiryDate) return { error: 'این بچ تاریخ انقضا ندارد.' }
  const cfg = await getExpiryConfig()
  const endsAt = new Date(batch.expiryDate.getTime() - cfg.minShelfLifeDays * 86_400_000)
  if (endsAt.getTime() <= Date.now()) return { error: 'این بچ دیگر قابل فروش نیست؛ به‌جای تخفیف آن را امحا یا تعدیل کنید.' }
  const code = await freeClearanceCode()
  const coupon = await db.coupon.create({
    data: {
      code,
      title: `تخفیف نزدیک انقضا: ${batch.product.nameFa}`.slice(0, 120),
      description: `بچ ${batch.batchNumber ?? '—'} با انقضای ${formatJalaliDate(batch.expiryDate)}`,
      type: 'PERCENT',
      value: cfg.discountPercent,
      endsAt,
      isActive: true,
      autoApply: false,
      perCustomerLimit: null,
      productIds: [productId],
      source: 'manual',
    },
  })
  await logAdminChange({ action: 'CREATE', entity: 'COUPON', entityId: coupon.id, after: coupon })
  try {
    revalidatePath('/admin/marketing')
  } catch {
    /* best-effort */
  }
  return { success: true, code, message: `کد ${code} با ${cfg.discountPercent.toLocaleString('fa-IR')}٪ تخفیف ساخته شد.` }
}

export interface ProductSearchHit {
  id: string
  name: string
  sku: string | null
  barcode: string | null
  tracksExpiry: boolean
  shelfLifeDays: number | null
}

/** Name, SKU or barcode search for the batch-entry combobox. */
export async function searchProductsAction(q: string): Promise<ProductSearchHit[]> {
  const session = await getSessionWithRole('EDITOR')
  if (!session) return []
  if (!checkRateLimit(`inv-psearch:${session.userId}`, 120, 60_000).allowed) return []
  const text = String(q ?? '').trim().slice(0, 60)
  if (text.length < 2) return []
  const rows = await db.product.findMany({
    where: {
      deletedAt: null,
      OR: [{ nameFa: { contains: text, mode: 'insensitive' } }, { sku: { contains: text, mode: 'insensitive' } }, { barcode: { contains: text } }],
    },
    select: { id: true, nameFa: true, sku: true, barcode: true, tracksExpiry: true, shelfLifeDays: true },
    orderBy: { nameFa: 'asc' },
    take: 10,
  })
  return rows.map((r) => ({ id: r.id, name: r.nameFa, sku: r.sku, barcode: r.barcode, tracksExpiry: r.tracksExpiry, shelfLifeDays: r.shelfLifeDays }))
}

/** Resolves pasted SKUs to products for the CSV paste helper. */
export async function resolveSkusAction(skus: string[]): Promise<{ sku: string; id: string; name: string; tracksExpiry: boolean }[]> {
  const session = await getSessionWithRole('EDITOR')
  if (!session) return []
  const list = [...new Set(skus.map((s) => String(s).trim()).filter(Boolean))].slice(0, 100)
  if (!list.length) return []
  const rows = await db.product.findMany({ where: { deletedAt: null, sku: { in: list } }, select: { id: true, sku: true, nameFa: true, tracksExpiry: true } })
  return rows.map((r) => ({ sku: r.sku ?? '', id: r.id, name: r.nameFa, tracksExpiry: r.tracksExpiry }))
}
