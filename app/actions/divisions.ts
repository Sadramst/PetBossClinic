'use server'

import { db } from '@/lib/db'
import { getSession } from '@/lib/auth'
import { revalidatePath } from 'next/cache'

export interface DivisionActionState {
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
    .replace(/^-+|-+$/g, '') || `division-${Date.now()}`
}

export async function createDivisionAction(formData: FormData): Promise<DivisionActionState> {
  const session = await getSession()
  if (!session) return { error: 'دسترسی غیرمجاز.' }

  const nameFa = formData.get('nameFa')?.toString().trim()
  const nameEn = formData.get('nameEn')?.toString().trim() || null
  const slugFaInput = formData.get('slugFa')?.toString().trim()
  const slugEnInput = formData.get('slugEn')?.toString().trim()
  const descriptionFa = formData.get('descriptionFa')?.toString().trim() || null
  const descriptionEn = formData.get('descriptionEn')?.toString().trim() || null
  const isActive = formData.get('isActive') === 'true' || formData.get('isActive') === 'on'

  if (!nameFa) {
    return { error: 'نام بخش الزامی است.' }
  }

  const slugFa = slugFaInput || generateSlug(nameFa)
  const slugEn = slugEnInput || (nameEn ? generateSlug(nameEn) : null)

  try {
    await db.division.create({
      data: {
        nameFa,
        nameEn,
        slugFa,
        slugEn,
        descriptionFa,
        descriptionEn,
        isActive,
      },
    })

    revalidatePath('/[locale]/admin/divisions', 'page')
    revalidatePath('/[locale]', 'page')
    return { success: true, message: 'بخش جدید با موفقیت ایجاد شد.' }
  } catch (err: unknown) {
    console.error('Error creating division:', err)
    return { error: 'خطا در ثبت بخش. ممکن است نامک (slug) تکراری باشد.' }
  }
}

export async function updateDivisionAction(divisionId: string, formData: FormData): Promise<DivisionActionState> {
  const session = await getSession()
  if (!session) return { error: 'دسترسی غیرمجاز.' }

  const nameFa = formData.get('nameFa')?.toString().trim()
  const nameEn = formData.get('nameEn')?.toString().trim() || null
  const slugFa = formData.get('slugFa')?.toString().trim()
  const slugEn = formData.get('slugEn')?.toString().trim() || null
  const descriptionFa = formData.get('descriptionFa')?.toString().trim() || null
  const descriptionEn = formData.get('descriptionEn')?.toString().trim() || null
  const isActive = formData.get('isActive') === 'true' || formData.get('isActive') === 'on'

  if (!nameFa) return { error: 'نام بخش الزامی است.' }

  try {
    await db.division.update({
      where: { id: divisionId },
      data: {
        nameFa,
        nameEn,
        ...(slugFa ? { slugFa } : {}),
        slugEn,
        descriptionFa,
        descriptionEn,
        isActive,
      },
    })

    revalidatePath('/[locale]/admin/divisions', 'page')
    revalidatePath('/[locale]', 'page')
    return { success: true, message: 'بخش با موفقیت ویرایش شد.' }
  } catch (err: unknown) {
    console.error('Error updating division:', err)
    return { error: 'خطا در ویرایش بخش.' }
  }
}

export async function toggleDivisionActiveAction(divisionId: string): Promise<DivisionActionState> {
  const session = await getSession()
  if (!session) return { error: 'دسترسی غیرمجاز.' }

  try {
    const existing = await db.division.findUnique({
      where: { id: divisionId },
      select: { isActive: true },
    })

    if (!existing) return { error: 'بخش یافت نشد.' }

    await db.division.update({
      where: { id: divisionId },
      data: { isActive: !existing.isActive },
    })

    revalidatePath('/[locale]/admin/divisions', 'page')
    revalidatePath('/[locale]', 'page')
    return { success: true }
  } catch (err: unknown) {
    console.error('Error toggling division status:', err)
    return { error: 'خطا در تغییر وضعیت بخش.' }
  }
}

export async function deleteDivisionAction(divisionId: string): Promise<DivisionActionState> {
  const session = await getSession()
  if (!session) return { error: 'دسترسی غیرمجاز.' }

  try {
    // Check if services are attached
    const servicesCount = await db.service.count({
      where: { divisionId },
    })

    if (servicesCount > 0) {
      return { error: `امکان حذف این بخش وجود ندارد زیرا ${servicesCount} خدمت زیرمجموعه آن است.` }
    }

    await db.division.delete({
      where: { id: divisionId },
    })

    revalidatePath('/[locale]/admin/divisions', 'page')
    revalidatePath('/[locale]', 'page')
    return { success: true, message: 'بخش با موفقیت حذف گردید.' }
  } catch (err: unknown) {
    console.error('Error deleting division:', err)
    return { error: 'خطا در حذف بخش.' }
  }
}
