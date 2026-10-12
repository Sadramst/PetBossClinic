'use server'

import { db } from '@/lib/db'
import { getSession } from '@/lib/auth'
import { revalidatePath } from 'next/cache'
import { logAdminChange } from '@/lib/audit'

export interface HomepageActionState {
  error?: string
  success?: boolean
  message?: string
}

export async function updateHomepageSectionAction(
  sectionKey: string,
  formData: FormData
): Promise<HomepageActionState> {
  const session = await getSession()
  if (!session) return { error: 'دسترسی غیرمجاز.' }

  const titleFa = formData.get('titleFa')?.toString().trim() || null
  const titleEn = formData.get('titleEn')?.toString().trim() || null
  const subtitleFa = formData.get('subtitleFa')?.toString().trim() || null
  const subtitleEn = formData.get('subtitleEn')?.toString().trim() || null
  const eyebrowFa = formData.get('eyebrowFa')?.toString().trim() || null
  const eyebrowEn = formData.get('eyebrowEn')?.toString().trim() || null
  const badgeFa = formData.get('badgeFa')?.toString().trim() || null
  const badgeEn = formData.get('badgeEn')?.toString().trim() || null
  const ctaLabelFa = formData.get('ctaLabelFa')?.toString().trim() || null
  const ctaLabelEn = formData.get('ctaLabelEn')?.toString().trim() || null
  const ctaHref = formData.get('ctaHref')?.toString().trim() || null
  const sortOrderStr = formData.get('sortOrder')?.toString().trim()
  const isVisible = formData.get('isVisible') === 'true' || formData.get('isVisible') === 'on'

  const sortOrder = sortOrderStr ? parseInt(sortOrderStr, 10) : 0

  try {
    const existing = await db.homepageSection.findUnique({
      where: { key: sectionKey },
    })

    const updated = await db.homepageSection.upsert({
      where: { key: sectionKey },
      update: {
        titleFa,
        titleEn,
        subtitleFa,
        subtitleEn,
        eyebrowFa,
        eyebrowEn,
        badgeFa,
        badgeEn,
        ctaLabelFa,
        ctaLabelEn,
        ctaHref,
        sortOrder: isNaN(sortOrder) ? 0 : sortOrder,
        isVisible,
      },
      create: {
        key: sectionKey,
        titleFa,
        titleEn,
        subtitleFa,
        subtitleEn,
        eyebrowFa,
        eyebrowEn,
        badgeFa,
        badgeEn,
        ctaLabelFa,
        ctaLabelEn,
        ctaHref,
        sortOrder: isNaN(sortOrder) ? 0 : sortOrder,
        isVisible,
      },
    })

    await logAdminChange({
      action: existing ? 'UPDATE' : 'CREATE',
      entity: 'HOMEPAGE_SECTION',
      entityId: updated.id,
      after: { key: sectionKey, titleFa, titleEn, isVisible, sortOrder },
    })

    revalidatePath('/', 'layout')
    revalidatePath('/[locale]', 'page')
    revalidatePath('/[locale]/admin/homepage', 'page')
    return { success: true, message: 'بخش صفحه اصلی با موفقیت به‌روز شد.' }
  } catch (err: unknown) {
    console.error('Error updating homepage section:', err)
    return { error: 'خطا در ذخیره‌سازی بخش صفحه اصلی.' }
  }
}

export async function toggleHomepageSectionVisibilityAction(
  sectionKey: string,
  isVisible: boolean
): Promise<HomepageActionState> {
  const session = await getSession()
  if (!session) return { error: 'دسترسی غیرمجاز.' }

  try {
    await db.homepageSection.update({
      where: { key: sectionKey },
      data: { isVisible },
    })

    await logAdminChange({
      action: 'UPDATE',
      entity: 'HOMEPAGE_SECTION',
      entityId: sectionKey,
      after: { key: sectionKey, isVisible },
    })

    revalidatePath('/', 'layout')
    revalidatePath('/[locale]', 'page')
    revalidatePath('/[locale]/admin/homepage', 'page')
    return { success: true, message: `بخش ${isVisible ? 'فعال' : 'مخفی'} شد.` }
  } catch (err: unknown) {
    console.error('Error toggling homepage section:', err)
    return { error: 'خطا در تغییر وضعیت بخش.' }
  }
}
