'use server'

import { db } from '@/lib/db'
import { getSession } from '@/lib/auth'
import { revalidatePath } from 'next/cache'

export interface ServiceActionState {
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
    .replace(/^-+|-+$/g, '') || `service-${Date.now()}`
}

export async function createServiceAction(formData: FormData): Promise<ServiceActionState> {
  const session = await getSession()
  if (!session) {
    return { error: 'دسترسی غیرمجاز. لطفاً وارد حساب خود شوید.' }
  }

  const divisionId = formData.get('divisionId')?.toString().trim()
  const nameFa = formData.get('nameFa')?.toString().trim()
  const nameEn = formData.get('nameEn')?.toString().trim() || null
  const slugFaInput = formData.get('slugFa')?.toString().trim()
  const slugEnInput = formData.get('slugEn')?.toString().trim()
  const durationFa = formData.get('durationFa')?.toString().trim() || null
  const durationEn = formData.get('durationEn')?.toString().trim() || null
  const priceFromStr = formData.get('priceFrom')?.toString().trim()
  const priceToStr = formData.get('priceTo')?.toString().trim()
  const descriptionFa = formData.get('descriptionFa')?.toString().trim() || null
  const descriptionEn = formData.get('descriptionEn')?.toString().trim() || null
  const isActive = formData.get('isActive') === 'true' || formData.get('isActive') === 'on'

  if (!divisionId || !nameFa) {
    return { error: 'تکمیل بخش مربوطه و نام فارسی خدمت الزامی است.' }
  }

  const slugFa = slugFaInput || generateSlug(nameFa)
  const slugEn = slugEnInput || (nameEn ? generateSlug(nameEn) : null)
  const priceFrom = priceFromStr ? parseInt(priceFromStr, 10) : null
  const priceTo = priceToStr ? parseInt(priceToStr, 10) : null

  try {
    await db.service.create({
      data: {
        divisionId,
        nameFa,
        nameEn,
        slugFa,
        slugEn,
        durationFa,
        durationEn,
        priceFrom: isNaN(priceFrom as number) ? null : priceFrom,
        priceTo: isNaN(priceTo as number) ? null : priceTo,
        descriptionFa,
        descriptionEn,
        isActive,
      },
    })

    revalidatePath('/[locale]/admin/services', 'page')
    revalidatePath('/[locale]', 'page')
    return { success: true, message: 'خدمت جدید با موفقیت ثبت شد.' }
  } catch (err: unknown) {
    console.error('Error creating service:', err)
    return { error: 'خطا در ثبت خدمت. ممکن است شناسه یکتا (slug) تکراری باشد.' }
  }
}

export async function updateServiceAction(serviceId: string, formData: FormData): Promise<ServiceActionState> {
  const session = await getSession()
  if (!session) {
    return { error: 'دسترسی غیرمجاز.' }
  }

  const divisionId = formData.get('divisionId')?.toString().trim()
  const nameFa = formData.get('nameFa')?.toString().trim()
  const nameEn = formData.get('nameEn')?.toString().trim() || null
  const slugFa = formData.get('slugFa')?.toString().trim()
  const slugEn = formData.get('slugEn')?.toString().trim() || null
  const durationFa = formData.get('durationFa')?.toString().trim() || null
  const durationEn = formData.get('durationEn')?.toString().trim() || null
  const priceFromStr = formData.get('priceFrom')?.toString().trim()
  const priceToStr = formData.get('priceTo')?.toString().trim()
  const descriptionFa = formData.get('descriptionFa')?.toString().trim() || null
  const descriptionEn = formData.get('descriptionEn')?.toString().trim() || null
  const isActive = formData.get('isActive') === 'true' || formData.get('isActive') === 'on'

  if (!divisionId || !nameFa) {
    return { error: 'تکمیل بخش و عنوان فارسی الزامی است.' }
  }

  const priceFrom = priceFromStr ? parseInt(priceFromStr, 10) : null
  const priceTo = priceToStr ? parseInt(priceToStr, 10) : null

  try {
    await db.service.update({
      where: { id: serviceId },
      data: {
        divisionId,
        nameFa,
        nameEn,
        ...(slugFa ? { slugFa } : {}),
        slugEn,
        durationFa,
        durationEn,
        priceFrom: isNaN(priceFrom as number) ? null : priceFrom,
        priceTo: isNaN(priceTo as number) ? null : priceTo,
        descriptionFa,
        descriptionEn,
        isActive,
      },
    })

    revalidatePath('/[locale]/admin/services', 'page')
    revalidatePath('/[locale]', 'page')
    return { success: true, message: 'خدمت با موفقیت ویرایش شد.' }
  } catch (err: unknown) {
    console.error('Error updating service:', err)
    return { error: 'خطا در به‌روزرسانی اطلاعات خدمت.' }
  }
}

export async function toggleServiceActiveAction(serviceId: string): Promise<ServiceActionState> {
  const session = await getSession()
  if (!session) return { error: 'دسترسی غیرمجاز.' }

  try {
    const existing = await db.service.findUnique({
      where: { id: serviceId },
      select: { isActive: true },
    })

    if (!existing) return { error: 'خدمت یافت نشد.' }

    await db.service.update({
      where: { id: serviceId },
      data: { isActive: !existing.isActive },
    })

    revalidatePath('/[locale]/admin/services', 'page')
    revalidatePath('/[locale]', 'page')
    return { success: true }
  } catch (err: unknown) {
    console.error('Error toggling service status:', err)
    return { error: 'خطا در تغییر وضعیت خدمت.' }
  }
}

export async function deleteServiceAction(serviceId: string): Promise<ServiceActionState> {
  const session = await getSession()
  if (!session) return { error: 'دسترسی غیرمجاز.' }

  try {
    await db.service.delete({
      where: { id: serviceId },
    })

    revalidatePath('/[locale]/admin/services', 'page')
    revalidatePath('/[locale]', 'page')
    return { success: true, message: 'خدمت با موفقیت حذف شد.' }
  } catch (err: unknown) {
    console.error('Error deleting service:', err)
    return { error: 'خطا در حذف خدمت. ممکن است این خدمت دارای رکورد وابسته باشد.' }
  }
}
