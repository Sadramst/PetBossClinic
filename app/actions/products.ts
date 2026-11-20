'use server'

import { db } from '@/lib/db'
import { getSessionWithRole } from '@/lib/auth'
import { revalidatePath } from 'next/cache'
import { StockStatus } from '@prisma/client'
import { logAdminChange } from '@/lib/audit'
import { normalizeFa, slugifyFa } from '@/lib/text/persian'
import { detectBrand } from '@/lib/shop/brands'
import { z } from 'zod'
import { checkRateLimit } from '@/lib/utils/rate-limit'
import { MAX_PRICE, previewPriceAdjust, validatePriceAdjust, type PriceAdjust, type PricePreviewRow } from '@/lib/shop/price-adjust'

/** Brand id for a product name (brand rows are created by scripts/assign-brands.ts). */
async function brandIdFor(name: string): Promise<string | null> {
  const def = detectBrand(name)
  if (!def) return null
  const brand = await db.brand.findUnique({ where: { slugFa: def.slug }, select: { id: true } })
  return brand?.id ?? null
}

import fs from 'fs'
import path from 'path'

export interface ProductActionState {
  error?: string
  success?: boolean
  message?: string
}

function generateSlug(text: string): string {
  return slugifyFa(text) || `product-${Date.now()}`
}

export async function revalidateCatalog() {
  try {
    revalidatePath('/[locale]/admin/products', 'page')
    revalidatePath('/[locale]/shop', 'page')
    revalidatePath('/[locale]', 'page')
    revalidatePath('/shop')
    revalidatePath('/admin/products')
    revalidatePath('/')
  } catch (e) {
    console.warn('Revalidation notice:', e)
  }
}

async function saveUploadedFile(file: File, subfolder: 'products' | 'categories'): Promise<string> {
  const bytes = await file.arrayBuffer()
  const buffer = Buffer.from(bytes)

  const timestamp = Date.now()
  const randomSuffix = Math.random().toString(36).substring(2, 7)
  const safeName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_').toLowerCase().replace(/\.[^/.]+$/, '')
  const mediaKey = `upload_${timestamp}_${randomSuffix}`
  const fileName = `${timestamp}-${safeName}.webp`
  const _relativePath = `/uploads/${subfolder}/${fileName}`

  let optimizedBuffer = buffer
  let mimeType = 'image/webp'
  try {
    const sharp = (await import('sharp')).default
    optimizedBuffer = await sharp(buffer)
      .resize({ width: 1000, withoutEnlargement: true })
      .webp({ quality: 80 })
      .toBuffer()
  } catch (err) {
    console.warn('Could not optimize uploaded file with sharp:', err)
    mimeType = file.type || 'image/jpeg'
  }

  // 1. Try local disk save where filesystem is writable (e.g. dev, self-hosted)
  try {
    const uploadDir = path.join(process.cwd(), 'public', 'uploads', subfolder)
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true })
    }
    const filePath = path.join(uploadDir, fileName)
    await fs.promises.writeFile(filePath, optimizedBuffer)
  } catch {
    // Read-only serverless filesystem in Vercel - safely handled via db.media & API route
  }

  // 2. Persist in db.media (PostgreSQL is 100% durable across serverless deploys)
  const base64Data = optimizedBuffer.toString('base64')
  const dataUri = `data:${mimeType};base64,${base64Data}`

  const media = await db.media.upsert({
    where: { key: mediaKey },
    update: {
      url: dataUri,
      size: optimizedBuffer.length,
      mime: mimeType,
      altFa: file.name,
      altEn: file.name,
    },
    create: {
      key: mediaKey,
      url: dataUri,
      size: optimizedBuffer.length,
      mime: mimeType,
      altFa: file.name,
      altEn: file.name,
    },
  })

  // 3. Also index by filename so /uploads/:path* fallback can look it up by filename
  await db.media.upsert({
    where: { key: fileName.replace(/\.[^/.]+$/, '') },
    update: {
      url: dataUri,
      size: optimizedBuffer.length,
      mime: mimeType,
      altFa: file.name,
      altEn: file.name,
    },
    create: {
      key: fileName.replace(/\.[^/.]+$/, ''),
      url: dataUri,
      size: optimizedBuffer.length,
      mime: mimeType,
      altFa: file.name,
      altEn: file.name,
    },
  }).catch(() => {})

  return `/api/media/${media.key}`
}

export async function createProductAction(formData: FormData): Promise<ProductActionState> {
  const session = await getSessionWithRole('EDITOR')
  if (!session) return { error: 'دسترسی غیرمجاز.' }

  let categoryId = formData.get('categoryId')?.toString().trim()
  const nameFa = normalizeFa(formData.get('nameFa')?.toString())
  const nameEn = formData.get('nameEn')?.toString().trim() || null
  const sku = formData.get('sku')?.toString().trim() || null
  const slugFaInput = formData.get('slugFa')?.toString().trim()
  const priceStr = formData.get('price')?.toString().trim()
  const stockStatus = (formData.get('stockStatus')?.toString() as StockStatus) || 'IN_STOCK'
  const shortDescFa = formData.get('shortDescFa')?.toString().trim() || null
  const shortDescEn = formData.get('shortDescEn')?.toString().trim() || null
  const isActive = formData.get('isActive') === 'true' || formData.get('isActive') === 'on'
  const isFeatured = formData.get('isFeatured') === 'true' || formData.get('isFeatured') === 'on'

  const imageFile = formData.get('imageFile') as File | null
  const imageUrlInput = formData.get('imageUrl')?.toString().trim() || null

  if (!nameFa || !priceStr) {
    return { error: 'نام فارسی محصول و قیمت الزامی هستند.' }
  }

  const price = parseInt(priceStr, 10)
  if (isNaN(price)) {
    return { error: 'قیمت باید عدد معتبر باشد.' }
  }

  // Ensure category exists or fallback to general category
  if (!categoryId) {
    let generalCat = await db.productCategory.findFirst({
      where: { slugFa: 'general-supplies' },
    })
    if (!generalCat) {
      generalCat = await db.productCategory.create({
        data: {
          nameFa: 'ملزومات عمومی پت',
          nameEn: 'General Pet Supplies',
          slugFa: 'general-supplies',
          slugEn: 'general-supplies',
        },
      })
    }
    categoryId = generalCat.id
  }

  const slugFa = slugFaInput || generateSlug(nameFa)
  const slugEn = nameEn ? generateSlug(nameEn) : null

  // Process image
  let finalImageUrl: string | null = imageUrlInput
  if (imageFile && imageFile instanceof File && imageFile.size > 0) {
    try {
      finalImageUrl = await saveUploadedFile(imageFile, 'products')
    } catch (uploadErr) {
      console.error('Error uploading product image:', uploadErr)
    }
  }

  try {
    const createdProduct = await db.product.create({
      data: {
        categoryId,
        brandId: await brandIdFor(nameFa),
        sku,
        nameFa,
        nameEn,
        slugFa,
        slugEn,
        price,
        stockStatus,
        shortDescFa,
        shortDescEn,
        isActive,
        isFeatured,
        ogImageId: finalImageUrl,
      },
    })

    if (finalImageUrl) {
      await db.productImage.create({
        data: {
          productId: createdProduct.id,
          imageId: finalImageUrl,
          isPrimary: true,
          sortOrder: 0,
        },
      })
    }

    await logAdminChange({
      action: 'CREATE',
      entity: 'PRODUCT',
      entityId: createdProduct.id,
      after: {
        id: createdProduct.id,
        nameFa,
        nameEn,
        sku,
        price,
        categoryId,
        stockStatus,
        isActive,
        isFeatured,
      },
    })

    revalidateCatalog()
    return { success: true, message: 'محصول با موفقیت ثبت شد.' }
  } catch (err: unknown) {
    console.error('Error creating product:', err)
    return { error: 'خطا در ثبت محصول در انبار.' }
  }
}

export async function updateProductAction(productId: string, formData: FormData): Promise<ProductActionState> {
  const session = await getSessionWithRole('EDITOR')
  if (!session) return { error: 'دسترسی غیرمجاز.' }

  const categoryId = formData.get('categoryId')?.toString().trim()
  const nameFa = normalizeFa(formData.get('nameFa')?.toString())
  const nameEn = formData.get('nameEn')?.toString().trim() || null
  const sku = formData.get('sku')?.toString().trim() || null
  const priceStr = formData.get('price')?.toString().trim()
  const stockStatus = (formData.get('stockStatus')?.toString() as StockStatus) || 'IN_STOCK'
  const shortDescFa = formData.get('shortDescFa')?.toString().trim() || null
  const shortDescEn = formData.get('shortDescEn')?.toString().trim() || null
  const isActive = formData.get('isActive') === 'true' || formData.get('isActive') === 'on'
  const isFeatured = formData.has('isFeatured')
    ? (formData.get('isFeatured') === 'true' || formData.get('isFeatured') === 'on')
    : undefined

  const removeImage = formData.get('removeImage') === 'true' || formData.get('removeImage') === '1'
  const imageFile = formData.get('imageFile') as File | null
  const imageUrlInput = formData.get('imageUrl')?.toString().trim() || null

  if (!nameFa || !priceStr) {
    return { error: 'نام و قیمت الزامی هستند.' }
  }

  const price = parseInt(priceStr, 10)
  if (isNaN(price)) {
    return { error: 'قیمت نامعتبر است.' }
  }

  try {
    let finalImageUrl: string | null = null
    let shouldUpdateImage = false

    if (removeImage) {
      shouldUpdateImage = true
      finalImageUrl = null
      await db.productImage.deleteMany({
        where: { productId },
      })
    } else if (imageFile && imageFile instanceof File && imageFile.size > 0) {
      shouldUpdateImage = true
      finalImageUrl = await saveUploadedFile(imageFile, 'products')
      await db.productImage.deleteMany({
        where: { productId },
      })
      await db.productImage.create({
        data: {
          productId,
          imageId: finalImageUrl,
          isPrimary: true,
          sortOrder: 0,
        },
      })
    } else if (imageUrlInput) {
      shouldUpdateImage = true
      finalImageUrl = imageUrlInput
      await db.productImage.deleteMany({
        where: { productId },
      })
      await db.productImage.create({
        data: {
          productId,
          imageId: finalImageUrl,
          isPrimary: true,
          sortOrder: 0,
        },
      })
    }

    const previous = await db.product.findUnique({
      where: { id: productId },
    })

    const updated = await db.product.update({
      where: { id: productId },
      data: {
        ...(categoryId ? { categoryId } : {}),
        // Keep a manually set brand; otherwise infer it from the (possibly renamed) product name.
        ...(previous?.brandId ? {} : { brandId: await brandIdFor(nameFa) }),
        nameFa,
        nameEn,
        sku,
        price,
        stockStatus,
        shortDescFa,
        shortDescEn,
        isActive,
        ...(typeof isFeatured === 'boolean' ? { isFeatured } : {}),
        ...(shouldUpdateImage ? { ogImageId: finalImageUrl } : {}),
      },
    })

    await logAdminChange({
      action: 'UPDATE',
      entity: 'PRODUCT',
      entityId: productId,
      before: previous ? { nameFa: previous.nameFa, price: previous.price, stockStatus: previous.stockStatus, isActive: previous.isActive, isFeatured: previous.isFeatured } : undefined,
      after: { nameFa: updated.nameFa, price: updated.price, stockStatus: updated.stockStatus, isActive: updated.isActive, isFeatured: updated.isFeatured },
    })

    revalidateCatalog()
    return { success: true, message: 'محصول با موفقیت به‌روزرسانی شد.' }
  } catch (err: unknown) {
    console.error('Error updating product:', err)
    return { error: 'خطا در به‌روزرسانی محصول.' }
  }
}

export async function toggleProductFeaturedAction(productId: string, isFeatured: boolean): Promise<ProductActionState> {
  const session = await getSessionWithRole('EDITOR')
  if (!session) return { error: 'دسترسی غیرمجاز.' }

  try {
    await db.product.update({
      where: { id: productId },
      data: { isFeatured },
    })

    revalidateCatalog()
    return { success: true, message: `محصول ${isFeatured ? 'به عنوان ویژه' : 'از حالت ویژه خارج'} شد.` }
  } catch (err: unknown) {
    console.error('Error toggling featured product:', err)
    return { error: 'خطا در تغییر وضعیت ویژگی محصول.' }
  }
}

export async function toggleProductActiveAction(productId: string, isActive: boolean): Promise<ProductActionState> {
  const session = await getSessionWithRole('EDITOR')
  if (!session) return { error: 'دسترسی غیرمجاز.' }

  try {
    await db.product.update({
      where: { id: productId },
      data: { isActive },
    })

    await logAdminChange({
      action: 'UPDATE',
      entity: 'PRODUCT',
      entityId: productId,
      details: { field: 'isActive', newValue: isActive },
    })

    revalidateCatalog()
    return {
      success: true,
      message: isActive ? 'محصول در سایت فعال و نمایش داده شد.' : 'محصول از سایت مخفی و غیرفعال شد.',
    }
  } catch (err: unknown) {
    console.error('Error toggling product active status:', err)
    return { error: 'خطا در تغییر وضعیت فعال بودن محصول.' }
  }
}

export async function deleteProductAction(productId: string): Promise<ProductActionState> {
  const session = await getSessionWithRole('EDITOR')
  if (!session) return { error: 'دسترسی غیرمجاز.' }

  try {
    const existing = await db.product.findUnique({
      where: { id: productId },
      select: { id: true, nameFa: true, price: true, sku: true },
    })

    await db.product.delete({
      where: { id: productId },
    })

    await logAdminChange({
      action: 'DELETE',
      entity: 'PRODUCT',
      entityId: productId,
      before: existing || { id: productId },
    })

    revalidateCatalog()
    return { success: true, message: 'محصول با موفقیت حذف گردید.' }
  } catch (err: unknown) {
    console.error('Error deleting product:', err)
    return { error: 'خطا در حذف محصول.' }
  }
}

// ─────────────────────────────────────────────────────────────
// PRODUCT CATEGORY MANAGEMENT (CRUD)
// ─────────────────────────────────────────────────────────────

export interface CategoryActionState {
  error?: string
  success?: boolean
  message?: string
}

export async function createCategoryAction(formData: FormData): Promise<CategoryActionState> {
  const session = await getSessionWithRole('EDITOR')
  if (!session) return { error: 'دسترسی غیرمجاز.' }

  const nameFa = normalizeFa(formData.get('nameFa')?.toString())
  const nameEn = formData.get('nameEn')?.toString().trim() || null
  const slugFaInput = formData.get('slugFa')?.toString().trim()
  const descriptionFa = formData.get('descriptionFa')?.toString().trim() || null
  const descriptionEn = formData.get('descriptionEn')?.toString().trim() || null
  const sortOrderStr = formData.get('sortOrder')?.toString().trim()
  const isActive = formData.get('isActive') === 'true' || formData.get('isActive') === 'on'

  const imageFile = formData.get('imageFile') as File | null
  const imageUrlInput = formData.get('imageUrl')?.toString().trim() || null

  if (!nameFa) {
    return { error: 'نام فارسی دسته‌بندی الزامی است.' }
  }

  const slugFa = slugFaInput || generateSlug(nameFa)
  const slugEn = nameEn ? generateSlug(nameEn) : null
  const sortOrder = sortOrderStr ? parseInt(sortOrderStr, 10) : 0

  let imageId: string | null = imageUrlInput
  if (imageFile && imageFile instanceof File && imageFile.size > 0) {
    try {
      imageId = await saveUploadedFile(imageFile, 'categories')
    } catch (uploadErr) {
      console.error('Error uploading category image:', uploadErr)
    }
  }

  let finalSlugFa = slugFa
  let finalSlugEn = slugEn

  try {
    // Check slug collision and ensure unique system-generated slug
    const existing = await db.productCategory.findFirst({
      where: {
        OR: [
          { slugFa: finalSlugFa },
          ...(finalSlugEn ? [{ slugEn: finalSlugEn }] : []),
        ],
      },
    })

    if (existing) {
      const suffix = Date.now().toString(36)
      finalSlugFa = `${slugFa}-${suffix}`
      if (finalSlugEn) {
        finalSlugEn = `${finalSlugEn}-${suffix}`
      }
    }

    const createdCat = await db.productCategory.create({
      data: {
        nameFa,
        nameEn,
        slugFa: finalSlugFa,
        slugEn: finalSlugEn,
        descriptionFa,
        descriptionEn,
        sortOrder: isNaN(sortOrder) ? 0 : sortOrder,
        isActive,
        imageId,
      },
    })

    await logAdminChange({
      action: 'CREATE',
      entity: 'PRODUCT_CATEGORY',
      entityId: createdCat.id,
      after: {
        id: createdCat.id,
        nameFa,
        nameEn,
        slugFa: finalSlugFa,
        isActive,
      },
    })

    revalidatePath('/[locale]/admin/products', 'page')
    revalidatePath('/[locale]/shop', 'page')
    revalidatePath('/[locale]', 'page')
    return { success: true, message: 'دسته‌بندی جدید با موفقیت ایجاد شد.' }
  } catch (err: unknown) {
    console.error('Error creating product category:', err)
    return { error: 'خطا در ایجاد دسته‌بندی.' }
  }
}

export async function updateCategoryAction(categoryId: string, formData: FormData): Promise<CategoryActionState> {
  const session = await getSessionWithRole('EDITOR')
  if (!session) return { error: 'دسترسی غیرمجاز.' }

  const nameFa = normalizeFa(formData.get('nameFa')?.toString())
  const nameEn = formData.get('nameEn')?.toString().trim() || null
  const descriptionFa = formData.get('descriptionFa')?.toString().trim() || null
  const descriptionEn = formData.get('descriptionEn')?.toString().trim() || null
  const sortOrderStr = formData.get('sortOrder')?.toString().trim()
  const isActive = formData.get('isActive') === 'true' || formData.get('isActive') === 'on'

  const removeImage = formData.get('removeImage') === 'true' || formData.get('removeImage') === '1'
  const imageFile = formData.get('imageFile') as File | null
  const imageUrlInput = formData.get('imageUrl')?.toString().trim() || null

  if (!nameFa) {
    return { error: 'نام فارسی دسته‌بندی الزامی است.' }
  }

  const sortOrder = sortOrderStr ? parseInt(sortOrderStr, 10) : 0

  let shouldUpdateImage = false
  let imageId: string | null = null

  if (removeImage) {
    shouldUpdateImage = true
    imageId = null
  } else if (imageFile && imageFile instanceof File && imageFile.size > 0) {
    try {
      shouldUpdateImage = true
      imageId = await saveUploadedFile(imageFile, 'categories')
    } catch (uploadErr) {
      console.error('Error uploading category image:', uploadErr)
    }
  } else if (imageUrlInput) {
    shouldUpdateImage = true
    imageId = imageUrlInput
  }

  try {
    const previous = await db.productCategory.findUnique({
      where: { id: categoryId },
    })

    const updated = await db.productCategory.update({
      where: { id: categoryId },
      data: {
        nameFa,
        nameEn,
        descriptionFa,
        descriptionEn,
        sortOrder: isNaN(sortOrder) ? 0 : sortOrder,
        isActive,
        ...(shouldUpdateImage ? { imageId } : {}),
      },
    })

    await logAdminChange({
      action: 'UPDATE',
      entity: 'PRODUCT_CATEGORY',
      entityId: categoryId,
      before: previous ? { nameFa: previous.nameFa, nameEn: previous.nameEn } : undefined,
      after: { nameFa: updated.nameFa, nameEn: updated.nameEn, sortOrder: updated.sortOrder },
    })

    revalidateCatalog()
    return { success: true, message: 'دسته‌بندی با موفقیت ویرایش شد.' }
  } catch (err: unknown) {
    console.error('Error updating category:', err)
    return { error: 'خطا در ویرایش دسته‌بندی.' }
  }
}

export async function toggleCategoryActiveAction(categoryId: string, isActive: boolean): Promise<CategoryActionState> {
  const session = await getSessionWithRole('EDITOR')
  if (!session) return { error: 'دسترسی غیرمجاز.' }

  try {
    await db.productCategory.update({
      where: { id: categoryId },
      data: { isActive },
    })

    await logAdminChange({
      action: 'UPDATE',
      entity: 'PRODUCT_CATEGORY',
      entityId: categoryId,
      details: { field: 'isActive', newValue: isActive },
    })

    revalidateCatalog()
    return {
      success: true,
      message: isActive ? 'دسته‌بندی در سایت فعال شد.' : 'دسته‌بندی در سایت غیرفعال شد.',
    }
  } catch (err: unknown) {
    console.error('Error toggling category active status:', err)
    return { error: 'خطا در تغییر وضعیت دسته‌بندی.' }
  }
}

export async function deleteCategoryAction(categoryId: string): Promise<CategoryActionState> {
  const session = await getSessionWithRole('EDITOR')
  if (!session) return { error: 'دسترسی غیرمجاز.' }

  try {
    const cat = await db.productCategory.findUnique({
      where: { id: categoryId },
      select: { id: true, nameFa: true },
    })

    // Check if category has products
    const productCount = await db.product.count({
      where: { categoryId },
    })

    if (productCount > 0) {
      // Find or create fallback general category to avoid orphaned products
      let fallbackCat = await db.productCategory.findFirst({
        where: { id: { not: categoryId }, isActive: true },
      })

      if (!fallbackCat) {
        fallbackCat = await db.productCategory.create({
          data: {
            nameFa: 'ملزومات عمومی پت',
            nameEn: 'General Pet Supplies',
            slugFa: `general-supplies-${Date.now().toString(36)}`,
            slugEn: `general-supplies-${Date.now().toString(36)}`,
            sortOrder: 99,
          },
        })
      }

      // Reassign products to fallback category
      await db.product.updateMany({
        where: { categoryId },
        data: { categoryId: fallbackCat.id },
      })
    }

    await db.productCategory.delete({
      where: { id: categoryId },
    })

    await logAdminChange({
      action: 'DELETE',
      entity: 'PRODUCT_CATEGORY',
      entityId: categoryId,
      before: cat || { id: categoryId },
      details: { reallocatedProductCount: productCount },
    })

    revalidateCatalog()
    return {
      success: true,
      message: productCount > 0
        ? `دسته‌بندی با موفقیت حذف شد و ${productCount} محصول مربوطه به دسته دیگری منتقل شدند.`
        : 'دسته‌بندی با موفقیت حذف گردید.',
    }
  } catch (err: unknown) {
    console.error('Error deleting category:', err)
    return { error: 'خطا در حذف دسته‌بندی.' }
  }
}

/* ------------------------------------------------------------------ bulk and quick edits */

const idsSchema = z.array(z.string().trim().min(1).max(40)).min(1, 'حداقل یک محصول انتخاب کنید.').max(200, 'در هر بار حداکثر ۲۰۰ محصول.')

async function bulkGuard(bucket: string, min: 'EDITOR' | 'ADMIN' = 'EDITOR') {
  const session = await getSessionWithRole(min)
  if (!session) return { error: 'دسترسی غیرمجاز.' as const }
  if (!checkRateLimit(`prod-${bucket}:${session.userId}`, 30, 60_000).allowed) return { error: 'تعداد درخواست‌ها زیاد است؛ کمی صبر کنید.' as const }
  return { session }
}

/** Shows or hides many products at once. */
export async function bulkSetProductsActiveAction(ids: unknown, isActive: boolean): Promise<ProductActionState> {
  const g = await bulkGuard('bulk')
  if ('error' in g) return { error: g.error }
  const parsed = idsSchema.safeParse(ids)
  if (!parsed.success) return { error: parsed.error.issues[0].message }
  const res = await db.product.updateMany({ where: { id: { in: parsed.data }, deletedAt: null }, data: { isActive } })
  await logAdminChange({ action: 'BULK_UPDATE', entity: 'PRODUCT', entityId: parsed.data[0], details: { field: 'isActive', value: isActive, count: res.count, ids: parsed.data } })
  revalidateCatalog()
  return { success: true, message: `${res.count.toLocaleString('fa-IR')} محصول ${isActive ? 'فعال' : 'مخفی'} شد.` }
}

/** Moves many products to one category. */
export async function bulkSetProductsCategoryAction(ids: unknown, categoryId: string): Promise<ProductActionState> {
  const g = await bulkGuard('bulk')
  if ('error' in g) return { error: g.error }
  const parsed = idsSchema.safeParse(ids)
  if (!parsed.success) return { error: parsed.error.issues[0].message }
  const cat = await db.productCategory.findUnique({ where: { id: String(categoryId) }, select: { id: true, nameFa: true } })
  if (!cat) return { error: 'دسته‌بندی پیدا نشد.' }
  const res = await db.product.updateMany({ where: { id: { in: parsed.data }, deletedAt: null }, data: { categoryId: cat.id } })
  await logAdminChange({ action: 'BULK_UPDATE', entity: 'PRODUCT', entityId: parsed.data[0], details: { field: 'categoryId', value: cat.id, count: res.count, ids: parsed.data } })
  revalidateCatalog()
  return { success: true, message: `${res.count.toLocaleString('fa-IR')} محصول به «${cat.nameFa}» منتقل شد.` }
}

export interface PriceAdjustResult extends ProductActionState {
  preview?: PricePreviewRow[]
}

/** Bulk price change. `dryRun` (default) only returns the before and after table; ADMIN to apply. */
export async function bulkAdjustPricesAction(ids: unknown, adjust: PriceAdjust, dryRun = true): Promise<PriceAdjustResult> {
  const g = await bulkGuard(dryRun ? 'price-preview' : 'price', dryRun ? 'EDITOR' : 'ADMIN')
  if ('error' in g) return { error: g.error }
  const parsed = idsSchema.safeParse(ids)
  if (!parsed.success) return { error: parsed.error.issues[0].message }
  const bad = validatePriceAdjust(adjust)
  if (bad) return { error: bad }
  const rows = await db.product.findMany({ where: { id: { in: parsed.data }, deletedAt: null }, select: { id: true, nameFa: true, price: true } })
  const preview = previewPriceAdjust(rows.map((r) => ({ id: r.id, name: r.nameFa, price: r.price })), adjust)
  if (dryRun) return { success: true, preview }
  const invalid = preview.filter((p) => p.after == null)
  if (invalid.length) return { error: `قیمت جدید ${invalid.length.toLocaleString('fa-IR')} محصول معتبر نیست؛ مقدار را اصلاح کنید.`, preview }
  await db.$transaction(preview.map((p) => db.product.update({ where: { id: p.id }, data: { price: p.after! } })))
  // One audit row per product so each product's price history is complete.
  for (const p of preview) {
    await logAdminChange({ action: 'BULK_UPDATE', entity: 'PRODUCT', entityId: p.id, before: { price: p.before }, after: { price: p.after }, details: { field: 'price', adjust, count: preview.length } })
  }
  revalidateCatalog()
  return { success: true, message: `قیمت ${preview.length.toLocaleString('fa-IR')} محصول به‌روزرسانی شد.`, preview }
}

/** Inline edit from the list: price and/or stock status. */
export async function quickUpdateProductAction(productId: string, patch: { price?: number; stockStatus?: string }): Promise<ProductActionState> {
  const g = await bulkGuard('quick')
  if ('error' in g) return { error: g.error }
  const data: { price?: number; stockStatus?: StockStatus; isPurchasable?: boolean } = {}
  if (patch.price !== undefined) {
    if (!Number.isInteger(patch.price) || patch.price < 1 || patch.price > MAX_PRICE) return { error: 'قیمت باید عدد صحیح مثبت باشد.' }
    data.price = patch.price
  }
  if (patch.stockStatus !== undefined) {
    if (!['IN_STOCK', 'LOW_STOCK', 'OUT_OF_STOCK', 'ON_BACKORDER'].includes(patch.stockStatus)) return { error: 'وضعیت موجودی نامعتبر است.' }
    data.stockStatus = patch.stockStatus as StockStatus
  }
  if (!Object.keys(data).length) return { error: 'تغییری ارسال نشد.' }
  const before = await db.product.findUnique({ where: { id: productId }, select: { price: true, stockStatus: true, deletedAt: true } })
  if (!before || before.deletedAt) return { error: 'محصول پیدا نشد.' }
  const next = await db.product.update({ where: { id: productId }, data })
  await logAdminChange({ action: 'UPDATE', entity: 'PRODUCT', entityId: productId, before, after: { price: next.price, stockStatus: next.stockStatus } })
  revalidateCatalog()
  return { success: true, message: 'ذخیره شد.' }
}
