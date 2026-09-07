'use server'

import { db } from '@/lib/db'
import { getSession } from '@/lib/auth'
import { revalidatePath } from 'next/cache'

export interface StaffActionState {
  error?: string
  success?: boolean
  message?: string
}

export async function createStaffAction(formData: FormData): Promise<StaffActionState> {
  const session = await getSession()
  if (!session) return { error: 'دسترسی غیرمجاز.' }

  const nameFa = formData.get('nameFa')?.toString().trim()
  const nameEn = formData.get('nameEn')?.toString().trim() || null
  const titleFa = formData.get('titleFa')?.toString().trim() || null
  const titleEn = formData.get('titleEn')?.toString().trim() || null
  const specialtyFa = formData.get('specialtyFa')?.toString().trim() || null
  const specialtyEn = formData.get('specialtyEn')?.toString().trim() || null
  const licenseNo = formData.get('licenseNo')?.toString().trim() || null
  const bioFa = formData.get('bioFa')?.toString().trim() || null
  const bioEn = formData.get('bioEn')?.toString().trim() || null
  const isActive = formData.get('isActive') === 'true' || formData.get('isActive') === 'on'

  if (!nameFa) {
    return { error: 'نام و نام‌خانوادگی پزشک الزامی است.' }
  }

  try {
    await db.staffMember.create({
      data: {
        nameFa,
        nameEn,
        titleFa,
        titleEn,
        specialtyFa,
        specialtyEn,
        licenseNo,
        bioFa,
        bioEn,
        isActive,
      },
    })

    revalidatePath('/[locale]/admin/staff', 'page')
    revalidatePath('/[locale]/about', 'page')
    revalidatePath('/[locale]', 'page')
    return { success: true, message: 'عضو کادر درمانی با موفقیت اضافه شد.' }
  } catch (err: unknown) {
    console.error('Error creating staff member:', err)
    return { error: 'خطا در ثبت مشخصات کادر درمانی.' }
  }
}

export async function updateStaffAction(staffId: string, formData: FormData): Promise<StaffActionState> {
  const session = await getSession()
  if (!session) return { error: 'دسترسی غیرمجاز.' }

  const nameFa = formData.get('nameFa')?.toString().trim()
  const nameEn = formData.get('nameEn')?.toString().trim() || null
  const titleFa = formData.get('titleFa')?.toString().trim() || null
  const titleEn = formData.get('titleEn')?.toString().trim() || null
  const specialtyFa = formData.get('specialtyFa')?.toString().trim() || null
  const specialtyEn = formData.get('specialtyEn')?.toString().trim() || null
  const licenseNo = formData.get('licenseNo')?.toString().trim() || null
  const bioFa = formData.get('bioFa')?.toString().trim() || null
  const bioEn = formData.get('bioEn')?.toString().trim() || null
  const isActive = formData.get('isActive') === 'true' || formData.get('isActive') === 'on'

  if (!nameFa) return { error: 'نام الزامی است.' }

  try {
    await db.staffMember.update({
      where: { id: staffId },
      data: {
        nameFa,
        nameEn,
        titleFa,
        titleEn,
        specialtyFa,
        specialtyEn,
        licenseNo,
        bioFa,
        bioEn,
        isActive,
      },
    })

    revalidatePath('/[locale]/admin/staff', 'page')
    revalidatePath('/[locale]/about', 'page')
    revalidatePath('/[locale]', 'page')
    return { success: true, message: 'اطلاعات با موفقیت به‌روزرسانی شد.' }
  } catch (err: unknown) {
    console.error('Error updating staff member:', err)
    return { error: 'خطا در ویرایش اطلاعات کادر درمانی.' }
  }
}

export async function toggleStaffActiveAction(staffId: string): Promise<StaffActionState> {
  const session = await getSession()
  if (!session) return { error: 'دسترسی غیرمجاز.' }

  try {
    const existing = await db.staffMember.findUnique({
      where: { id: staffId },
      select: { isActive: true },
    })

    if (!existing) return { error: 'عضو مورد نظر یافت نشد.' }

    await db.staffMember.update({
      where: { id: staffId },
      data: { isActive: !existing.isActive },
    })

    revalidatePath('/[locale]/admin/staff', 'page')
    revalidatePath('/[locale]/about', 'page')
    revalidatePath('/[locale]', 'page')
    return { success: true }
  } catch (err: unknown) {
    console.error('Error toggling staff status:', err)
    return { error: 'خطا در تغییر وضعیت فعالیت پزشک.' }
  }
}

export async function deleteStaffAction(staffId: string): Promise<StaffActionState> {
  const session = await getSession()
  if (!session) return { error: 'دسترسی غیرمجاز.' }

  try {
    await db.staffMember.delete({
      where: { id: staffId },
    })

    revalidatePath('/[locale]/admin/staff', 'page')
    revalidatePath('/[locale]/about', 'page')
    revalidatePath('/[locale]', 'page')
    return { success: true, message: 'عضو کادر با موفقیت حذف گردید.' }
  } catch (err: unknown) {
    console.error('Error deleting staff member:', err)
    return { error: 'خطا در حذف عضو کادر پزشکی.' }
  }
}
