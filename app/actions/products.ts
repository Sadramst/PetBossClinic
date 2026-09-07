'use server'

import { db } from '@/lib/db'
import { getSession } from '@/lib/auth'
import { revalidatePath } from 'next/cache'
import { StockStatus } from '@prisma/client'

import fs from 'fs'
import path from 'path'

export interface ProductActionState {
  error?: string
  success?: boolean
  message?: string
}

function generateSlug(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\u0600-\u06FF\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '') || `product-${Date.now()}`
}

async function saveUploadedFile(file: File, subfolder: 'products' | 'categories'): Promise<string> {
  const bytes = await file.arrayBuffer()
  const buffer = Buffer.from(bytes)

  const uploadDir = path.join(process.cwd(), 'public', 'uploads', subfolder)
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true })
  }

  const timestamp = Date.now()
  const safeName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_').toLowerCase()
  const fileName = `${timestamp}-${safeName}`
  const filePath = path.join(uploadDir, fileName)

  await fs.promises.writeFile(filePath, buffer)
  return `/uploads/${subfolder}/${fileName}`
}

export async function createProductAction(formData: FormData): Promise<ProductActionState> {
  const session = await getSession()
  if (!session) return { error: 'دسترسی غیرمجاز.' }

  let categoryId = formData.get('categoryId')?.toString().trim()
  const nameFa = formData.get('nameFa')?.toString().trim()
  const nameEn = formData.get('nameEn')?.toString().trim() || null
  const sku = formData.get('sku')?.toString().trim() || null
  const slugFaInput = formData.get('slugFa')?.toString().trim()
  const priceStr = formData.get('price')?.toString().trim()
  const stockStatus = (formData.get('stockStatus')?.toString() as StockStatus) || 'IN_STOCK'
  const shortDescFa = formData.get('shortDescFa')?.toString().trim() || null
  const shortDescEn = formData.get('shortDescEn')?.toString().trim() || null
  const isActive = formData.get('isActive') === 'true' || formData.get('isActive') === 'on'

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

    revalidatePath('/[locale]/admin/products', 'page')
    revalidatePath('/[locale]/shop', 'page')
    revalidatePath('/[locale]', 'page')
    return { success: true, message: 'محصول با موفقیت ثبت شد.' }
  } catch (err: unknown) {
    console.error('Error creating product:', err)
    return { error: 'خطا در ثبت محصول در انبار.' }
  }
}

export async function updateProductAction(productId: string, formData: FormData): Promise<ProductActionState> {
  const session = await getSession()
  if (!session) return { error: 'دسترسی غیرمجاز.' }

  const categoryId = formData.get('categoryId')?.toString().trim()
  const nameFa = formData.get('nameFa')?.toString().trim()
  const nameEn = formData.get('nameEn')?.toString().trim() || null
  const sku = formData.get('sku')?.toString().trim() || null
  const priceStr = formData.get('price')?.toString().trim()
  const stockStatus = (formData.get('stockStatus')?.toString() as StockStatus) || 'IN_STOCK'
  const shortDescFa = formData.get('shortDescFa')?.toString().trim() || null
  const shortDescEn = formData.get('shortDescEn')?.toString().trim() || null
  const isActive = formData.get('isActive') === 'true' || formData.get('isActive') === 'on'

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

    await db.product.update({
      where: { id: productId },
      data: {
        ...(categoryId ? { categoryId } : {}),
        nameFa,
        nameEn,
        sku,
        price,
        stockStatus,
        shortDescFa,
        shortDescEn,
        isActive,
        ...(shouldUpdateImage ? { ogImageId: finalImageUrl } : {}),
      },
    })

    revalidatePath('/[locale]/admin/products', 'page')
    revalidatePath('/[locale]/shop', 'page')
    revalidatePath('/[locale]', 'page')
    return { success: true, message: 'محصول با موفقیت به‌روزرسانی شد.' }
  } catch (err: unknown) {
    console.error('Error updating product:', err)
    return { error: 'خطا در ویرایش اطلاعات محصول.' }
  }
}

export async function deleteProductAction(productId: string): Promise<ProductActionState> {
  const session = await getSession()
  if (!session) return { error: 'دسترسی غیرمجاز.' }

  try {
    await db.product.delete({
      where: { id: productId },
    })

    revalidatePath('/[locale]/admin/products', 'page')
    revalidatePath('/[locale]/shop', 'page')
    revalidatePath('/[locale]', 'page')
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
  const session = await getSession()
  if (!session) return { error: 'دسترسی غیرمجاز.' }

  const nameFa = formData.get('nameFa')?.toString().trim()
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

  try {
    // Check slug collision
    const existing = await db.productCategory.findFirst({
      where: {
        OR: [
          { slugFa },
          ...(slugEn ? [{ slugEn }] : []),
        ],
      },
    })

    if (existing) {
      return { error: 'دسته‌بندی با این نام یا شناسه قبلاً ثبت شده است.' }
    }

    await db.productCategory.create({
      data: {
        nameFa,
        nameEn,
        slugFa,
        slugEn,
        descriptionFa,
        descriptionEn,
        sortOrder: isNaN(sortOrder) ? 0 : sortOrder,
        isActive,
        imageId,
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
  const session = await getSession()
  if (!session) return { error: 'دسترسی غیرمجاز.' }

  const nameFa = formData.get('nameFa')?.toString().trim()
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
    await db.productCategory.update({
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

    revalidatePath('/[locale]/admin/products', 'page')
    revalidatePath('/[locale]/shop', 'page')
    revalidatePath('/[locale]', 'page')
    return { success: true, message: 'دسته‌بندی با موفقیت ویرایش شد.' }
  } catch (err: unknown) {
    console.error('Error updating category:', err)
    return { error: 'خطا در ویرایش دسته‌بندی.' }
  }
}

export async function deleteCategoryAction(categoryId: string): Promise<CategoryActionState> {
  const session = await getSession()
  if (!session) return { error: 'دسترسی غیرمجاز.' }

  try {
    // Check if category has products
    const productCount = await db.product.count({
      where: { categoryId },
    })

    if (productCount > 0) {
      return {
        error: `این دسته‌بندی دارای ${productCount} محصول است. ابتدا محصولات مربوطه را حذف یا به دسته دیگری منتقل کنید.`,
      }
    }

    await db.productCategory.delete({
      where: { id: categoryId },
    })

    revalidatePath('/[locale]/admin/products', 'page')
    revalidatePath('/[locale]/shop', 'page')
    return { success: true, message: 'دسته‌بندی با موفقیت حذف گردید.' }
  } catch (err: unknown) {
    console.error('Error deleting category:', err)
    return { error: 'خطا در حذف دسته‌بندی.' }
  }
}

