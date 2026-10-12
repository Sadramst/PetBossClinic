'use server'

import { db } from '@/lib/db'
import { getSession } from '@/lib/auth'
import { revalidatePath, revalidateTag } from 'next/cache'
import { logAdminChange } from '@/lib/audit'

export interface MenuActionState {
  error?: string
  success?: boolean
  message?: string
}

export async function upsertMenuItemAction(formData: FormData): Promise<MenuActionState> {
  const session = await getSession()
  if (!session) return { error: 'دسترسی غیرمجاز.' }

  const id = formData.get('id')?.toString().trim() || null
  const menuName = formData.get('menuName')?.toString().trim() || 'header'
  const labelFa = formData.get('labelFa')?.toString().trim()
  const labelEn = formData.get('labelEn')?.toString().trim() || null
  const url = formData.get('url')?.toString().trim()
  const sortOrderStr = formData.get('sortOrder')?.toString().trim()
  const isActive = formData.get('isActive') === 'true' || formData.get('isActive') === 'on'

  if (!labelFa || !url) {
    return { error: 'عنوان فارسی و آدرس اینترنتی (URL) الزامی هستند.' }
  }

  const sortOrder = sortOrderStr ? parseInt(sortOrderStr, 10) : 0

  try {
    // Find or create the NavigationMenu
    let menu = await db.navigationMenu.findUnique({
      where: { name: menuName },
    })

    if (!menu) {
      menu = await db.navigationMenu.create({
        data: { name: menuName },
      })
    }

    let result
    if (id) {
      result = await db.menuItem.update({
        where: { id },
        data: {
          labelFa,
          labelEn,
          url,
          sortOrder: isNaN(sortOrder) ? 0 : sortOrder,
          isActive,
        },
      })
    } else {
      result = await db.menuItem.create({
        data: {
          menuId: menu.id,
          labelFa,
          labelEn,
          url,
          sortOrder: isNaN(sortOrder) ? 0 : sortOrder,
          isActive,
        },
      })
    }

    await logAdminChange({
      action: id ? 'UPDATE' : 'CREATE',
      entity: 'NAVIGATION_MENU',
      entityId: result.id,
      after: { menuName, labelFa, labelEn, url, sortOrder, isActive },
    })

    revalidateTag('navigation')
    revalidatePath('/', 'layout')
    revalidatePath('/[locale]/admin/menus', 'page')
    return { success: true, message: 'آیتم منو با موفقیت ثبت شد.' }
  } catch (err: unknown) {
    console.error('Error saving menu item:', err)
    return { error: 'خطا در ثبت آیتم منو.' }
  }
}

export async function toggleMenuItemAction(id: string, isActive: boolean): Promise<MenuActionState> {
  const session = await getSession()
  if (!session) return { error: 'دسترسی غیرمجاز.' }

  try {
    const updated = await db.menuItem.update({
      where: { id },
      data: { isActive },
    })

    await logAdminChange({
      action: 'UPDATE',
      entity: 'NAVIGATION_MENU',
      entityId: id,
      after: { isActive: updated.isActive },
    })

    revalidateTag('navigation')
    revalidatePath('/', 'layout')
    revalidatePath('/[locale]/admin/menus', 'page')
    return { success: true, message: `آیتم منو ${isActive ? 'فعال' : 'غیرفعال'} شد.` }
  } catch (err: unknown) {
    console.error('Error toggling menu item:', err)
    return { error: 'خطا در تغییر وضعیت آیتم منو.' }
  }
}

export async function deleteMenuItemAction(id: string): Promise<MenuActionState> {
  const session = await getSession()
  if (!session) return { error: 'دسترسی غیرمجاز.' }

  try {
    const deleted = await db.menuItem.delete({
      where: { id },
    })

    await logAdminChange({
      action: 'DELETE',
      entity: 'NAVIGATION_MENU',
      entityId: id,
      before: { labelFa: deleted.labelFa, url: deleted.url },
    })

    revalidateTag('navigation')
    revalidatePath('/', 'layout')
    revalidatePath('/[locale]/admin/menus', 'page')
    return { success: true, message: 'آیتم منو با موفقیت حذف شد.' }
  } catch (err: unknown) {
    console.error('Error deleting menu item:', err)
    return { error: 'خطا در حذف آیتم منو.' }
  }
}

export async function reorderMenuItemsAction(items: { id: string; sortOrder: number }[]): Promise<MenuActionState> {
  const session = await getSession()
  if (!session) return { error: 'دسترسی غیرمجاز.' }

  try {
    await db.$transaction(
      items.map((item) =>
        db.menuItem.update({
          where: { id: item.id },
          data: { sortOrder: item.sortOrder },
        })
      )
    )

    revalidateTag('navigation')
    revalidatePath('/', 'layout')
    revalidatePath('/[locale]/admin/menus', 'page')
    return { success: true, message: 'ترتیب آیتم‌های منو به‌روز شد.' }
  } catch (err: unknown) {
    console.error('Error reordering menu items:', err)
    return { error: 'خطا در مرتب‌سازی آیتم‌ها.' }
  }
}
