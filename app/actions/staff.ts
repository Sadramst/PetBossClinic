'use server'

import { db } from '@/lib/db'
import { getSession } from '@/lib/auth'
import { revalidatePath } from 'next/cache'
import { logAdminChange } from '@/lib/audit'
import fs from 'fs'
import path from 'path'

export interface StaffActionState {
  error?: string
  success?: boolean
  message?: string
}

async function saveStaffPhoto(file: File): Promise<string> {
  const bytes = await file.arrayBuffer()
  const buffer = Buffer.from(bytes)

  const base64Data = buffer.toString('base64')
  const dataUri = `data:${file.type};base64,${base64Data}`

  const timestamp = Date.now()
  const safeName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_').toLowerCase()
  const fileName = `${timestamp}-${safeName}`

  try {
    const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'staff')
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true })
    }
    const filePath = path.join(uploadDir, fileName)
    await fs.promises.writeFile(filePath, buffer)
    return `/uploads/staff/${fileName}`
  } catch {
    return dataUri
  }
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
  const sortOrderStr = formData.get('sortOrder')?.toString().trim()
  const isActive = formData.get('isActive') === 'true' || formData.get('isActive') === 'on'

  let photoId = formData.get('photoId')?.toString().trim() || null
  const photoFile = formData.get('photoFile') as File | null

  if (photoFile && photoFile instanceof File && photoFile.size > 0) {
    try {
      photoId = await saveStaffPhoto(photoFile)
    } catch (e) {
      console.error('Error saving staff photo:', e)
    }
  }

  if (!nameFa) {
    return { error: 'نام و نام‌خانوادگی پزشک الزامی است.' }
  }

  const sortOrder = sortOrderStr ? parseInt(sortOrderStr, 10) : 0

  try {
    const created = await db.staffMember.create({
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
        photoId,
        sortOrder: isNaN(sortOrder) ? 0 : sortOrder,
        isActive,
      },
    })

    await logAdminChange({
      action: 'CREATE',
      entity: 'STAFF',
      entityId: created.id,
      after: { id: created.id, nameFa, nameEn, titleFa, specialtyFa, licenseNo, photoId, isActive },
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
  const sortOrderStr = formData.get('sortOrder')?.toString().trim()
  const isActive = formData.get('isActive') === 'true' || formData.get('isActive') === 'on'

  let photoId = formData.get('photoId')?.toString().trim() || null
  const photoFile = formData.get('photoFile') as File | null

  if (photoFile && photoFile instanceof File && photoFile.size > 0) {
    try {
      photoId = await saveStaffPhoto(photoFile)
    } catch (e) {
      console.error('Error saving staff photo:', e)
    }
  }

  if (!nameFa) return { error: 'نام الزامی است.' }

  const sortOrder = sortOrderStr ? parseInt(sortOrderStr, 10) : 0

  try {
    const previous = await db.staffMember.findUnique({
      where: { id: staffId },
    })

    const updated = await db.staffMember.update({
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
        ...(photoId !== null ? { photoId } : {}),
        sortOrder: isNaN(sortOrder) ? 0 : sortOrder,
        isActive,
      },
    })

    await logAdminChange({
      action: 'UPDATE',
      entity: 'STAFF',
      entityId: staffId,
      before: previous ? { nameFa: previous.nameFa, titleFa: previous.titleFa, isActive: previous.isActive } : undefined,
      after: { nameFa: updated.nameFa, titleFa: updated.titleFa, photoId: updated.photoId, isActive: updated.isActive },
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
      select: { isActive: true, nameFa: true },
    })

    if (!existing) return { error: 'عضو مورد نظر یافت نشد.' }

    const updated = await db.staffMember.update({
      where: { id: staffId },
      data: { isActive: !existing.isActive },
    })

    await logAdminChange({
      action: 'UPDATE',
      entity: 'STAFF',
      entityId: staffId,
      after: { isActive: updated.isActive },
    })

    revalidatePath('/[locale]/admin/staff', 'page')
    revalidatePath('/[locale]/about', 'page')
    revalidatePath('/[locale]', 'page')
    return { success: true, message: `وضعیت ${existing.nameFa} با موفقیت تغییر کرد.` }
  } catch (err: unknown) {
    console.error('Error toggling staff status:', err)
    return { error: 'خطا در تغییر وضعیت عضو کادر درمانی.' }
  }
}

export async function deleteStaffAction(staffId: string): Promise<StaffActionState> {
  const session = await getSession()
  if (!session) return { error: 'دسترسی غیرمجاز.' }

  try {
    const deleted = await db.staffMember.delete({
      where: { id: staffId },
    })

    await logAdminChange({
      action: 'DELETE',
      entity: 'STAFF',
      entityId: staffId,
      before: { nameFa: deleted.nameFa, titleFa: deleted.titleFa },
    })

    revalidatePath('/[locale]/admin/staff', 'page')
    revalidatePath('/[locale]/about', 'page')
    revalidatePath('/[locale]', 'page')
    return { success: true, message: 'عضو کادر درمانی با موفقیت حذف شد.' }
  } catch (err: unknown) {
    console.error('Error deleting staff member:', err)
    return { error: 'خطا در حذف عضو کادر درمانی.' }
  }
}
