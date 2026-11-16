'use server'

import { revalidatePath, revalidateTag } from 'next/cache'
import { db } from '@/lib/db'
import { getSessionWithRole } from '@/lib/auth'
import { logAdminChange } from '@/lib/audit'
import { extractVerificationToken, isValidGa4Id } from '@/lib/seo/settings'

export interface SeoActionState {
  error?: string
  success?: boolean
}

const TOKEN = /^[A-Za-z0-9_\-]{10,100}$/

export async function updateSeoSettingsAction(formData: FormData): Promise<SeoActionState> {
  const session = await getSessionWithRole('ADMIN')
  if (!session) return { error: 'دسترسی غیرمجاز.' }

  const gsc = extractVerificationToken(formData.get('gscVerification')?.toString() ?? '')
  const bing = extractVerificationToken(formData.get('bingId')?.toString() ?? '')
  const ga4 = (formData.get('ga4Id')?.toString() ?? '').trim().toUpperCase()

  if (gsc && !TOKEN.test(gsc)) return { error: 'کد تأیید گوگل سرچ کنسول نامعتبر است.' }
  if (bing && !TOKEN.test(bing)) return { error: 'کد تأیید Bing نامعتبر است.' }
  if (ga4 && !isValidGa4Id(ga4)) return { error: 'شناسه GA4 باید به شکل G-XXXXXXX باشد.' }

  const data = { gscVerification: gsc || null, bingId: bing || null, ga4Id: ga4 || null }
  const existing = await db.seoSetting.findFirst()
  const saved = existing
    ? await db.seoSetting.update({ where: { id: existing.id }, data })
    : await db.seoSetting.create({ data })

  await logAdminChange({ action: 'UPDATE', entity: 'SEO_SETTING', entityId: saved.id, before: existing, after: saved })
  revalidateTag('seo-settings')
  revalidatePath('/', 'layout')
  return { success: true }
}
