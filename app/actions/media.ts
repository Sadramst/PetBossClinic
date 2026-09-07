'use server'

import { db } from '@/lib/db'
import { getSession } from '@/lib/auth'
import { revalidatePath } from 'next/cache'
import fs from 'fs'
import path from 'path'
import { DEFAULT_SITE_PICTURES } from '@/lib/media'

export interface MediaActionResult {
  success?: boolean
  error?: string
  message?: string
  media?: {
    id: string
    key: string
    url: string
    size: number
    mime: string
    createdAt: Date
  }
}

/**
 * Assigns a URL to one of the site's primary picture keys
 */
export async function updateSitePictureAction(
  key: string,
  url: string,
  altFa: string = 'تصویر کلینیک پت‌باس',
  altEn: string = 'Pet Boss Clinic Image'
): Promise<MediaActionResult> {
  const session = await getSession()
  if (!session) return { error: 'دسترسی غیرمجاز.' }

  if (!url || typeof url !== 'string' || !url.trim()) {
    return { error: 'آدرس تصویر نامعتبر است.' }
  }

  const cleanUrl = url.trim()

  try {
    await db.media.upsert({
      where: { key },
      update: {
        url: cleanUrl,
        altFa,
        altEn,
        updatedAt: new Date(),
      },
      create: {
        key,
        url: cleanUrl,
        altFa,
        altEn,
        mime: 'image/jpeg',
        size: 0,
      },
    })

    revalidatePath('/[locale]', 'page')
    revalidatePath('/[locale]/admin/media', 'page')
    revalidatePath('/[locale]/services', 'page')
    revalidatePath('/[locale]/about', 'page')

    return { success: true, message: 'تصویر با موفقیت به‌روزرسانی شد.' }
  } catch (err: unknown) {
    console.error('Error updating site picture:', err)
    return { error: 'خطا در ذخیره‌سازی تصویر.' }
  }
}

/**
 * Resets a primary picture to its default asset
 */
export async function resetSitePictureAction(key: string): Promise<MediaActionResult> {
  const session = await getSession()
  if (!session) return { error: 'دسترسی غیرمجاز.' }

  // @ts-expect-error key lookup
  const defaultUrl = DEFAULT_SITE_PICTURES[key]
  if (!defaultUrl) {
    return { error: 'کلید تصویر یافت نشد.' }
  }

  return updateSitePictureAction(key, defaultUrl)
}

/**
 * Uploads a physical media file to public/uploads/ and indexes it in db.media
 */
export async function uploadMediaAction(formData: FormData): Promise<MediaActionResult> {
  const session = await getSession()
  if (!session) return { error: 'دسترسی غیرمجاز.' }

  const file = formData.get('file') as File | null
  const altFa = formData.get('altFa')?.toString().trim() || 'تصویر آپلود شده'
  const altEn = formData.get('altEn')?.toString().trim() || 'Uploaded Image'
  const assignToKey = formData.get('assignToKey')?.toString().trim()

  if (!file || !(file instanceof File) || file.size === 0) {
    return { error: 'لطفاً یک فایل تصویر معتبر انتخاب کنید.' }
  }

  // Validate mime type
  const allowedMimes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml']
  if (!allowedMimes.includes(file.type)) {
    return { error: 'فرمت فایل مجاز نیست. لطفاً از JPG, PNG, WEBP, GIF یا SVG استفاده کنید.' }
  }

  // Max 15MB
  if (file.size > 15 * 1024 * 1024) {
    return { error: 'حجم فایل نباید بیشتر از ۱۵ مگابایت باشد.' }
  }

  try {
    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)

    const uploadsDir = path.join(process.cwd(), 'public', 'uploads')
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true })
    }

    const timestamp = Date.now()
    const safeName = file.name
      .replace(/[^a-zA-Z0-9.-]/g, '_')
      .toLowerCase()
    const fileName = `${timestamp}-${safeName}`
    const filePath = path.join(uploadsDir, fileName)

    await fs.promises.writeFile(filePath, buffer)

    const publicUrl = `/uploads/${fileName}`
    const mediaKey = `upload_${timestamp}_${Math.random().toString(36).substring(2, 7)}`

    const created = await db.media.create({
      data: {
        key: mediaKey,
        url: publicUrl,
        mime: file.type,
        size: file.size,
        altFa,
        altEn,
      },
    })

    // If an assignment key was specified (e.g. site_logo or hero_reception), assign it immediately
    if (assignToKey && assignToKey in DEFAULT_SITE_PICTURES) {
      await updateSitePictureAction(assignToKey, publicUrl, altFa, altEn)
    }

    revalidatePath('/[locale]/admin/media', 'page')
    revalidatePath('/[locale]', 'page')

    return {
      success: true,
      message: 'فایل با موفقیت آپلود و ذخیره شد.',
      media: {
        id: created.id,
        key: created.key,
        url: created.url,
        size: created.size,
        mime: created.mime,
        createdAt: created.createdAt,
      },
    }
  } catch (err: unknown) {
    console.error('Error uploading media:', err)
    return { error: 'خطا در بارگذاری فایل.' }
  }
}

/**
 * Deletes a media item
 */
export async function deleteMediaAction(id: string): Promise<MediaActionResult> {
  const session = await getSession()
  if (!session) return { error: 'دسترسی غیرمجاز.' }

  try {
    const item = await db.media.findUnique({ where: { id } })
    if (!item) return { error: 'آیتم رسانه یافت نشد.' }

    // If it's stored in /uploads/, delete the physical file
    if (item.url.startsWith('/uploads/')) {
      const physicalPath = path.join(process.cwd(), 'public', item.url)
      if (fs.existsSync(physicalPath)) {
        try {
          fs.unlinkSync(physicalPath)
        } catch (e) {
          console.warn('Could not delete physical file:', e)
        }
      }
    }

    await db.media.delete({ where: { id } })
    revalidatePath('/[locale]/admin/media', 'page')

    return { success: true, message: 'تصویر با موفقیت حذف شد.' }
  } catch (err: unknown) {
    console.error('Error deleting media:', err)
    return { error: 'خطا در حذف تصویر.' }
  }
}
