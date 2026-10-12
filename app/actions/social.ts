'use server'

import { db } from '@/lib/db'
import { getSession } from '@/lib/auth'
import { revalidatePath, revalidateTag } from 'next/cache'
import { SocialPlatform } from '@prisma/client'
import { logAdminChange } from '@/lib/audit'

export interface SocialActionState {
  error?: string
  success?: boolean
  message?: string
}

export async function upsertSocialLinkAction(formData: FormData): Promise<SocialActionState> {
  const session = await getSession()
  if (!session) return { error: 'دسترسی غیرمجاز.' }

  const id = formData.get('id')?.toString().trim() || null
  const platformStr = formData.get('platform')?.toString().trim() as SocialPlatform
  const url = formData.get('url')?.toString().trim()
  const icon = formData.get('icon')?.toString().trim() || null
  const sortOrderStr = formData.get('sortOrder')?.toString().trim()
  const isActive = formData.get('isActive') === 'true' || formData.get('isActive') === 'on'

  if (!platformStr || !url) {
    return { error: 'انتخاب پلتفرم و وارد کردن آدرس اینترنتی (URL) الزامی است.' }
  }

  const sortOrder = sortOrderStr ? parseInt(sortOrderStr, 10) : 0

  try {
    const existing = id
      ? await db.socialLink.findUnique({ where: { id } })
      : await db.socialLink.findUnique({ where: { platform: platformStr } })

    let result
    if (existing) {
      result = await db.socialLink.update({
        where: { id: existing.id },
        data: {
          platform: platformStr,
          url,
          icon,
          sortOrder: isNaN(sortOrder) ? 0 : sortOrder,
          isActive,
        },
      })
    } else {
      result = await db.socialLink.create({
        data: {
          platform: platformStr,
          url,
          icon,
          sortOrder: isNaN(sortOrder) ? 0 : sortOrder,
          isActive,
        },
      })
    }

    await logAdminChange({
      action: existing ? 'UPDATE' : 'CREATE',
      entity: 'SOCIAL_LINK',
      entityId: result.id,
      before: existing ? { platform: existing.platform, url: existing.url, isActive: existing.isActive } : undefined,
      after: { platform: result.platform, url: result.url, isActive: result.isActive },
    })

    revalidateTag('site-settings')
    revalidatePath('/', 'layout')
    revalidatePath('/[locale]/admin/social', 'page')
    return { success: true, message: 'لینک شبکه اجتماعی با موفقیت ثبت شد.' }
  } catch (err: unknown) {
    console.error('Error saving social link:', err)
    return { error: 'خطا در ثبت لینک شبکه اجتماعی.' }
  }
}

export async function toggleSocialLinkAction(id: string, isActive: boolean): Promise<SocialActionState> {
  const session = await getSession()
  if (!session) return { error: 'دسترسی غیرمجاز.' }

  try {
    const updated = await db.socialLink.update({
      where: { id },
      data: { isActive },
    })

    await logAdminChange({
      action: 'UPDATE',
      entity: 'SOCIAL_LINK',
      entityId: id,
      after: { isActive: updated.isActive },
    })

    revalidateTag('site-settings')
    revalidatePath('/', 'layout')
    revalidatePath('/[locale]/admin/social', 'page')
    return { success: true, message: `لینک ${isActive ? 'فعال' : 'غیرفعال'} شد.` }
  } catch (err: unknown) {
    console.error('Error toggling social link:', err)
    return { error: 'خطا در تغییر وضعیت لینک.' }
  }
}

export async function deleteSocialLinkAction(id: string): Promise<SocialActionState> {
  const session = await getSession()
  if (!session) return { error: 'دسترسی غیرمجاز.' }

  try {
    const deleted = await db.socialLink.delete({
      where: { id },
    })

    await logAdminChange({
      action: 'DELETE',
      entity: 'SOCIAL_LINK',
      entityId: id,
      before: { platform: deleted.platform, url: deleted.url },
    })

    revalidateTag('site-settings')
    revalidatePath('/', 'layout')
    revalidatePath('/[locale]/admin/social', 'page')
    return { success: true, message: 'لینک با موفقیت حذف شد.' }
  } catch (err: unknown) {
    console.error('Error deleting social link:', err)
    return { error: 'خطا در حذف لینک شبکه اجتماعی.' }
  }
}
