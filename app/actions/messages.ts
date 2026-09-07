'use server'

import { db } from '@/lib/db'
import { getSession } from '@/lib/auth'
import { revalidatePath } from 'next/cache'

export interface MessageActionState {
  error?: string
  success?: boolean
  message?: string
}

export async function toggleMessageReadAction(messageId: string): Promise<MessageActionState> {
  const session = await getSession()
  if (!session) return { error: 'دسترسی غیرمجاز.' }

  try {
    const existing = await db.contactMessage.findUnique({
      where: { id: messageId },
      select: { isRead: true },
    })

    if (!existing) return { error: 'پیام یافت نشد.' }

    await db.contactMessage.update({
      where: { id: messageId },
      data: { isRead: !existing.isRead },
    })

    revalidatePath('/[locale]/admin/messages', 'page')
    return { success: true }
  } catch (err: unknown) {
    console.error('Error toggling message read status:', err)
    return { error: 'خطا در تغییر وضعیت پیام.' }
  }
}

export async function deleteMessageAction(messageId: string): Promise<MessageActionState> {
  const session = await getSession()
  if (!session) return { error: 'دسترسی غیرمجاز.' }

  try {
    await db.contactMessage.delete({
      where: { id: messageId },
    })

    revalidatePath('/[locale]/admin/messages', 'page')
    return { success: true, message: 'پیام با موفقیت حذف گردید.' }
  } catch (err: unknown) {
    console.error('Error deleting message:', err)
    return { error: 'خطا در حذف پیام.' }
  }
}
