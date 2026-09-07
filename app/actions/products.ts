'use server'

import { db } from '@/lib/db'
import { getSession } from '@/lib/auth'
import { revalidatePath } from 'next/cache'
import { StockStatus } from '@prisma/client'

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

export async function createProductAction(formData: FormData): Promise<ProductActionState> {
  const session = await getSession()
  if (!session) return { error: 'دسترسی غیرمجاز.' }

  let categoryId = formData.get('categoryId')?.toString().trim()
  const nameFa = formData.get('nameFa')?.toString().trim()
  const nameEn = formData.get('nameEn')?.toString().trim() || null
  const slugFaInput = formData.get('slugFa')?.toString().trim()
  const priceStr = formData.get('price')?.toString().trim()
  const stockStatus = (formData.get('stockStatus')?.toString() as StockStatus) || 'IN_STOCK'
  const shortDescFa = formData.get('shortDescFa')?.toString().trim() || null
  const shortDescEn = formData.get('shortDescEn')?.toString().trim() || null
  const isActive = formData.get('isActive') === 'true' || formData.get('isActive') === 'on'

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

  try {
    await db.product.create({
      data: {
        categoryId,
        nameFa,
        nameEn,
        slugFa,
        slugEn,
        price,
        stockStatus,
        shortDescFa,
        shortDescEn,
        isActive,
      },
    })

    revalidatePath('/[locale]/admin/products', 'page')
    revalidatePath('/[locale]/shop', 'page')
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
  const priceStr = formData.get('price')?.toString().trim()
  const stockStatus = (formData.get('stockStatus')?.toString() as StockStatus) || 'IN_STOCK'
  const shortDescFa = formData.get('shortDescFa')?.toString().trim() || null
  const shortDescEn = formData.get('shortDescEn')?.toString().trim() || null
  const isActive = formData.get('isActive') === 'true' || formData.get('isActive') === 'on'

  if (!nameFa || !priceStr) {
    return { error: 'نام و قیمت الزامی هستند.' }
  }

  const price = parseInt(priceStr, 10)
  if (isNaN(price)) {
    return { error: 'قیمت نامعتبر است.' }
  }

  try {
    await db.product.update({
      where: { id: productId },
      data: {
        ...(categoryId ? { categoryId } : {}),
        nameFa,
        nameEn,
        price,
        stockStatus,
        shortDescFa,
        shortDescEn,
        isActive,
      },
    })

    revalidatePath('/[locale]/admin/products', 'page')
    revalidatePath('/[locale]/shop', 'page')
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
    return { success: true, message: 'محصول با موفقیت حذف گردید.' }
  } catch (err: unknown) {
    console.error('Error deleting product:', err)
    return { error: 'خطا در حذف محصول.' }
  }
}
