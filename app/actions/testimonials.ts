'use server'

import { db } from '@/lib/db'
import { getSession } from '@/lib/auth'
import { revalidatePath } from 'next/cache'
import { logAdminChange } from '@/lib/audit'

export interface TestimonialActionState {
  error?: string
  success?: boolean
  message?: string
}

export async function upsertTestimonialAction(formData: FormData): Promise<TestimonialActionState> {
  const session = await getSession()
  if (!session) return { error: 'دسترسی غیرمجاز.' }

  const id = formData.get('id')?.toString().trim() || null
  const nameFa = formData.get('nameFa')?.toString().trim()
  const nameEn = formData.get('nameEn')?.toString().trim() || null
  const contentFa = formData.get('contentFa')?.toString().trim()
  const contentEn = formData.get('contentEn')?.toString().trim() || null
  const ratingStr = formData.get('rating')?.toString().trim()
  const sortOrderStr = formData.get('sortOrder')?.toString().trim()
  const isActive = formData.get('isActive') === 'true' || formData.get('isActive') === 'on'

  if (!nameFa || !contentFa) {
    return { error: 'نام و متن نظر مراجع الزامی هستند.' }
  }

  const rating = ratingStr ? parseInt(ratingStr, 10) : 5
  const sortOrder = sortOrderStr ? parseInt(sortOrderStr, 10) : 0

  try {
    let result
    if (id) {
      result = await db.testimonial.update({
        where: { id },
        data: {
          nameFa,
          nameEn,
          contentFa,
          contentEn,
          rating: isNaN(rating) ? 5 : Math.max(1, Math.min(5, rating)),
          sortOrder: isNaN(sortOrder) ? 0 : sortOrder,
          isActive,
        },
      })
    } else {
      result = await db.testimonial.create({
        data: {
          nameFa,
          nameEn,
          contentFa,
          contentEn,
          rating: isNaN(rating) ? 5 : Math.max(1, Math.min(5, rating)),
          sortOrder: isNaN(sortOrder) ? 0 : sortOrder,
          isActive,
        },
      })
    }

    await logAdminChange({
      action: id ? 'UPDATE' : 'CREATE',
      entity: 'TESTIMONIAL',
      entityId: result.id,
      after: { nameFa, nameEn, contentFa, rating, isActive },
    })

    revalidatePath('/', 'layout')
    revalidatePath('/[locale]', 'page')
    revalidatePath('/[locale]/admin/testimonials', 'page')
    return { success: true, message: 'نظر مراجع با موفقیت ثبت شد.' }
  } catch (err: unknown) {
    console.error('Error saving testimonial:', err)
    return { error: 'خطا در ثبت نظر مراجع.' }
  }
}

export async function toggleTestimonialAction(id: string, isActive: boolean): Promise<TestimonialActionState> {
  const session = await getSession()
  if (!session) return { error: 'دسترسی غیرمجاز.' }

  try {
    const updated = await db.testimonial.update({
      where: { id },
      data: { isActive },
    })

    await logAdminChange({
      action: 'UPDATE',
      entity: 'TESTIMONIAL',
      entityId: id,
      after: { isActive: updated.isActive },
    })

    revalidatePath('/', 'layout')
    revalidatePath('/[locale]', 'page')
    revalidatePath('/[locale]/admin/testimonials', 'page')
    return { success: true, message: `نظر ${isActive ? 'فعال' : 'غیرفعال'} شد.` }
  } catch (err: unknown) {
    console.error('Error toggling testimonial:', err)
    return { error: 'خطا در تغییر وضعیت نظر.' }
  }
}

export async function deleteTestimonialAction(id: string): Promise<TestimonialActionState> {
  const session = await getSession()
  if (!session) return { error: 'دسترسی غیرمجاز.' }

  try {
    const deleted = await db.testimonial.delete({
      where: { id },
    })

    await logAdminChange({
      action: 'DELETE',
      entity: 'TESTIMONIAL',
      entityId: id,
      before: { nameFa: deleted.nameFa, contentFa: deleted.contentFa },
    })

    revalidatePath('/', 'layout')
    revalidatePath('/[locale]', 'page')
    revalidatePath('/[locale]/admin/testimonials', 'page')
    return { success: true, message: 'نظر با موفقیت حذف شد.' }
  } catch (err: unknown) {
    console.error('Error deleting testimonial:', err)
    return { error: 'خطا در حذف نظر.' }
  }
}
