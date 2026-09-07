'use server'

import { db } from '@/lib/db'
import { getSession } from '@/lib/auth'
import { revalidatePath } from 'next/cache'

export interface SettingsActionState {
  error?: string
  success?: boolean
  message?: string
}

export async function updateSiteSettingsAction(formData: FormData): Promise<SettingsActionState> {
  const session = await getSession()
  if (!session) return { error: 'دسترسی غیرمجاز.' }

  const nameFa = formData.get('nameFa')?.toString().trim() || 'کلینیک دامپزشکی و پت شاپ پت باس'
  const nameEn = formData.get('nameEn')?.toString().trim() || 'Pet Boss Veterinary Clinic & Pet Shop'
  const taglineFa = formData.get('taglineFa')?.toString().trim() || 'مراقبت با عشق'
  const taglineEn = formData.get('taglineEn')?.toString().trim() || 'Care with love'
  const phone = formData.get('phone')?.toString().trim() || '۰۲۱-۲۶۴۲۹۷۱۵'
  const addressFa = formData.get('addressFa')?.toString().trim() || 'تهران، خیابان شریعتی، بالاتر از پل صدر، نرسیده به ایستگاه مترو قیطریه، پلاک ۱۷۳۳'
  const addressEn = formData.get('addressEn')?.toString().trim() || 'Shariati St., north of Sadr Bridge, near Gheytarieh Metro Station, No. 1733, Tehran, Iran'
  const geo = formData.get('geo')?.toString().trim() || '35.790937, 51.4350853'
  const workingHoursFa = formData.get('workingHoursFa')?.toString().trim() || '۱۰:۰۰ صبح الی ۲۲:۰۰ شب (همه روزه)'
  const workingHoursEn = formData.get('workingHoursEn')?.toString().trim() || '10:00 AM to 10:00 PM (Every day including holidays)'

  try {
    const existing = await db.siteSetting.findFirst()

    if (existing) {
      await db.siteSetting.update({
        where: { id: existing.id },
        data: {
          nameFa,
          nameEn,
          taglineFa,
          taglineEn,
          phones: [phone],
          addresses: { fa: addressFa, en: addressEn },
          geo: { coordinates: geo },
          workingHours: { fa: workingHoursFa, en: workingHoursEn },
          updatedById: session.userId,
        },
      })
    } else {
      await db.siteSetting.create({
        data: {
          nameFa,
          nameEn,
          taglineFa,
          taglineEn,
          phones: [phone],
          addresses: { fa: addressFa, en: addressEn },
          geo: { coordinates: geo },
          workingHours: { fa: workingHoursFa, en: workingHoursEn },
          updatedById: session.userId,
        },
      })
    }

    revalidatePath('/[locale]/admin/settings', 'page')
    revalidatePath('/[locale]', 'page')
    return { success: true, message: 'تنظیمات کلینیک با موفقیت ذخیره شد.' }
  } catch (err: unknown) {
    console.error('Error updating site settings:', err)
    return { error: 'خطا در ذخیره‌سازی تنظیمات.' }
  }
}
