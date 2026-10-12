'use server'

import { db } from '@/lib/db'
import { getSession } from '@/lib/auth'
import { revalidatePath } from 'next/cache'
import { logAdminChange } from '@/lib/audit'

export interface FaqActionState {
  error?: string
  success?: boolean
  message?: string
}

export async function createFaqAction(formData: FormData): Promise<FaqActionState> {
  const session = await getSession()
  if (!session) return { error: 'دسترسی غیرمجاز.' }

  const questionFa = formData.get('questionFa')?.toString().trim()
  const questionEn = formData.get('questionEn')?.toString().trim() || null
  const answerFa = formData.get('answerFa')?.toString().trim()
  const answerEn = formData.get('answerEn')?.toString().trim() || null
  const categoryId = formData.get('categoryId')?.toString().trim() || null
  const isActive = formData.get('isActive') === 'true' || formData.get('isActive') === 'on'

  if (!questionFa || !answerFa) {
    return { error: 'پرسش و پاسخ فارسی الزامی هستند.' }
  }

  try {
    const created = await db.faq.create({
      data: {
        questionFa,
        questionEn,
        answerFa,
        answerEn,
        categoryId: categoryId || undefined,
        isActive,
      },
    })

    await logAdminChange({
      action: 'CREATE',
      entity: 'FAQ',
      entityId: created.id,
      after: { id: created.id, questionFa, questionEn, answerFa, isActive },
    })

    revalidatePath('/[locale]/admin/faqs', 'page')
    revalidatePath('/[locale]/faq', 'page')
    revalidatePath('/[locale]', 'page')
    return { success: true, message: 'پرسش متداول با موفقیت ثبت شد.' }
  } catch (err: unknown) {
    console.error('Error creating FAQ:', err)
    return { error: 'خطا در ثبت پرسش متداول.' }
  }
}

export async function updateFaqAction(faqId: string, formData: FormData): Promise<FaqActionState> {
  const session = await getSession()
  if (!session) return { error: 'دسترسی غیرمجاز.' }

  const questionFa = formData.get('questionFa')?.toString().trim()
  const questionEn = formData.get('questionEn')?.toString().trim() || null
  const answerFa = formData.get('answerFa')?.toString().trim()
  const answerEn = formData.get('answerEn')?.toString().trim() || null
  const isActive = formData.get('isActive') === 'true' || formData.get('isActive') === 'on'

  if (!questionFa || !answerFa) {
    return { error: 'پرسش و پاسخ فارسی الزامی هستند.' }
  }

  try {
    const previous = await db.faq.findUnique({
      where: { id: faqId },
    })

    const updated = await db.faq.update({
      where: { id: faqId },
      data: {
        questionFa,
        questionEn,
        answerFa,
        answerEn,
        isActive,
      },
    })

    await logAdminChange({
      action: 'UPDATE',
      entity: 'FAQ',
      entityId: faqId,
      before: previous ? { questionFa: previous.questionFa, isActive: previous.isActive } : undefined,
      after: { questionFa: updated.questionFa, isActive: updated.isActive },
    })

    revalidatePath('/[locale]/admin/faqs', 'page')
    revalidatePath('/[locale]/faq', 'page')
    revalidatePath('/[locale]', 'page')
    return { success: true, message: 'پرسش با موفقیت ویرایش شد.' }
  } catch (err: unknown) {
    console.error('Error updating FAQ:', err)
    return { error: 'خطا در ویرایش پرسش.' }
  }
}

export async function deleteFaqAction(faqId: string): Promise<FaqActionState> {
  const session = await getSession()
  if (!session) return { error: 'دسترسی غیرمجاز.' }

  try {
    const existing = await db.faq.findUnique({
      where: { id: faqId },
      select: { id: true, questionFa: true },
    })

    await db.faq.delete({
      where: { id: faqId },
    })

    await logAdminChange({
      action: 'DELETE',
      entity: 'FAQ',
      entityId: faqId,
      before: existing || { id: faqId },
    })

    revalidatePath('/[locale]/admin/faqs', 'page')
    revalidatePath('/[locale]/faq', 'page')
    revalidatePath('/[locale]', 'page')
    return { success: true, message: 'پرسش با موفقیت حذف گردید.' }
  } catch (err: unknown) {
    console.error('Error deleting FAQ:', err)
    return { error: 'خطا در حذف پرسش متداول.' }
  }
}
