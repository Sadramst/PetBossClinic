'use server'

import { db } from '@/lib/db'
import { getSession } from '@/lib/auth'
import { revalidatePath } from 'next/cache'

export interface LeadActionState {
  error?: string
  success?: boolean
  message?: string
}

export async function createLeadAction(formData: FormData): Promise<LeadActionState> {
  const session = await getSession()
  if (!session) return { error: 'دسترسی غیرمجاز.' }

  const name = formData.get('name')?.toString().trim() || null
  const phone = formData.get('phone')?.toString().trim()
  const message = formData.get('message')?.toString().trim() || null
  const source = formData.get('source')?.toString().trim() || 'ADMIN_PANEL'
  const status = formData.get('status')?.toString().trim() || 'NEW'

  if (!phone) {
    return { error: 'شماره تماس الزامی است.' }
  }

  try {
    await db.lead.create({
      data: {
        name,
        phone,
        message,
        source,
        status,
      },
    })

    revalidatePath('/[locale]/admin/leads', 'page')
    return { success: true, message: 'سرنخ جدید با موفقیت ثبت شد.' }
  } catch (err: unknown) {
    console.error('Error creating lead:', err)
    return { error: 'خطا در ثبت سرنخ جدید.' }
  }
}

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
