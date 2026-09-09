'use server'

import { db } from '@/lib/db'
import { getSession } from '@/lib/auth'
import { revalidatePath } from 'next/cache'
import { headers } from 'next/headers'
import { createLeadSchema } from '@/lib/validation/lead'
import { checkRateLimit } from '@/lib/utils/rate-limit'

export interface LeadActionState {
  error?: string
  success?: boolean
  message?: string
  fieldErrors?: Record<string, string[]>
  fallbackPhone?: string
  fallbackPhoneDisplay?: string
}

/**
 * Public action for website visitors to submit contact and consultation inquiries.
 * Does NOT require authentication.
 * Protected by honeypot, IP rate limiting (5/hour), and strict Iranian phone validation.
 */
export async function createLeadAction(
  arg1: FormData | LeadActionState | null,
  arg2?: FormData
): Promise<LeadActionState> {
  const formData = arg2 instanceof FormData ? arg2 : (arg1 instanceof FormData ? arg1 : new FormData())
  const headerList = await headers()
  const forwardedFor = headerList.get('x-forwarded-for')
  const ip = forwardedFor ? forwardedFor.split(',')[0].trim() : (headerList.get('x-real-ip') || '127.0.0.1')
  const locale = formData.get('locale')?.toString() || 'fa'
  const isEn = locale === 'en'

  // 1. Check Honeypot
  const honeypot = formData.get('website')?.toString() || formData.get('honeypot')?.toString() || ''
  if (honeypot.trim() !== '') {
    // Bot detected: return mock success to prevent adaptation
    return {
      success: true,
      message: isEn
        ? 'Your inquiry has been submitted successfully.'
        : 'درخواست شما با موفقیت ثبت شد.',
    }
  }

  // 2. IP Rate Limiting (5 submissions per hour per IP)
  const rateLimitKey = `lead:${ip}`
  const rateLimit = checkRateLimit(rateLimitKey, 5, 3600 * 1000)
  if (!rateLimit.allowed) {
    return {
      error: isEn
        ? `Too many requests. Please try again in ${rateLimit.resetSeconds} seconds or call the clinic directly.`
        : 'تعداد درخواست‌های ارسالی از سمت شما بیش از حد مجاز است. لطفاً بعداً تلاش کنید یا مستقیماً تماس بگیرید.',
      fallbackPhone: '+982126429715',
      fallbackPhoneDisplay: isEn ? '+98 21 2642 9715' : '۰۲۱-۲۶۴۲۹۷۱۵',
    }
  }

  // 3. Extract and parse raw form data
  const rawData = {
    name: formData.get('name')?.toString() || undefined,
    phone: formData.get('phone')?.toString() || '',
    email: formData.get('email')?.toString() || undefined,
    petType: formData.get('petType')?.toString() || undefined,
    serviceInterest: formData.get('serviceInterest')?.toString() || undefined,
    message: formData.get('message')?.toString() || undefined,
    honeypot,
    utmSource: formData.get('utmSource')?.toString() || undefined,
    utmMedium: formData.get('utmMedium')?.toString() || undefined,
    utmCamp: formData.get('utmCamp')?.toString() || undefined,
    utmTerm: formData.get('utmTerm')?.toString() || undefined,
    utmContent: formData.get('utmContent')?.toString() || undefined,
    referrer: formData.get('referrer')?.toString() || undefined,
    landingPage: formData.get('landingPage')?.toString() || undefined,
    source: formData.get('source')?.toString() || 'WEBSITE_CONTACT',
  }

  const validation = createLeadSchema.safeParse(rawData)
  if (!validation.success) {
    const fieldErrors: Record<string, string[]> = {}
    for (const issue of validation.error.issues) {
      const field = issue.path[0] as string
      if (!fieldErrors[field]) fieldErrors[field] = []
      fieldErrors[field].push(issue.message)
    }

    const firstMessage = validation.error.issues[0]?.message
    return {
      error: firstMessage || (isEn ? 'Validation failed.' : 'اطلاعات وارد شده معتبر نیست.'),
      fieldErrors,
    }
  }

  const data = validation.data

  // 4. Persist to DB with fallback phone protection
  try {
    await db.lead.create({
      data: {
        name: data.name,
        phone: data.phone,
        email: data.email,
        petType: data.petType,
        serviceInterest: data.serviceInterest,
        message: data.message,
        source: data.source,
        utmSource: data.utmSource,
        utmMedium: data.utmMedium,
        utmCamp: data.utmCamp,
        utmTerm: data.utmTerm,
        utmContent: data.utmContent,
        referrer: data.referrer,
        landingPage: data.landingPage,
        status: 'NEW',
      },
    })

    revalidatePath('/[locale]/admin/leads', 'page')
    return {
      success: true,
      message: isEn
        ? 'Thank you! Your inquiry has been registered. Our clinic staff will contact you shortly.'
        : 'درخواست شما با موفقیت ثبت شد. همکاران کلینیک پت‌باس به زودی با شما تماس خواهند گرفت.',
    }
  } catch (err: unknown) {
    console.error('CRITICAL: Database error saving lead submission:', {
      error: err,
      phone: data.phone,
      name: data.name,
      timestamp: new Date().toISOString(),
    })

    return {
      error: isEn
        ? 'A temporary system error occurred. Please call the clinic directly.'
        : 'متأسفانه در ثبت اطلاعات خطایی رخ داد. لطفاً مستقیماً با شماره کلینیک تماس بگیرید.',
      fallbackPhone: '+982126429715',
      fallbackPhoneDisplay: isEn ? '+98 21 2642 9715' : '۰۲۱-۲۶۴۲۹۷۱۵',
    }
  }
}

/**
 * Admin action to update status of a lead. Requires authenticated session.
 */
export async function updateLeadStatusAction(leadId: string, status: string): Promise<LeadActionState> {
  const session = await getSession()
  if (!session) return { error: 'دسترسی غیرمجاز.' }

  try {
    await db.lead.update({
      where: { id: leadId },
      data: { status },
    })

    revalidatePath('/[locale]/admin/leads', 'page')
    return { success: true, message: 'وضعیت سرنخ به‌روزرسانی شد.' }
  } catch (err: unknown) {
    console.error('Error updating lead status:', err)
    return { error: 'خطا در تغییر وضعیت سرنخ.' }
  }
}

/**
 * Admin action to delete a lead. Requires authenticated session.
 */
export async function deleteLeadAction(leadId: string): Promise<LeadActionState> {
  const session = await getSession()
  if (!session) return { error: 'دسترسی غیرمجاز.' }

  try {
    await db.lead.delete({
      where: { id: leadId },
    })

    revalidatePath('/[locale]/admin/leads', 'page')
    return { success: true, message: 'سرنخ با موفقیت حذف گردید.' }
  } catch (err: unknown) {
    console.error('Error deleting lead:', err)
    return { error: 'خطا در حذف سرنخ.' }
  }
}
