'use server'

import { db } from '@/lib/db'
import { getSession, hashPassword } from '@/lib/auth'
import { Role } from '@prisma/client'
import { revalidatePath } from 'next/cache'

export interface UserActionState {
  error?: string
  success?: boolean
  message?: string
}

export async function createUserAction(
  prevState: UserActionState | undefined,
  formData: FormData
): Promise<UserActionState> {
  const session = await getSession()

  if (!session || session.role !== 'SUPER_ADMIN') {
    return { error: 'دسترسی غیرمجاز: تنها مدیر ارشد (Super Admin) مجاز به تعریف و مدیریت کاربران است.' }
  }

  const name = formData.get('name')?.toString().trim()
  const email = formData.get('email')?.toString().trim().toLowerCase()
  const password = formData.get('password')?.toString()
  const role = formData.get('role')?.toString() as Role
  const locale = formData.get('locale')?.toString() || 'fa'

  if (!email || !password || !role) {
    return {
      error: locale === 'fa' ? 'لطفاً تمامی فیلدهای الزامی را تکمیل کنید.' : 'Please fill all required fields.',
    }
  }

  if (password.length < 8) {
    return {
      error: locale === 'fa' ? 'کلمه عبور باید حداقل ۸ کاراکتر باشد.' : 'Password must be at least 8 characters long.',
    }
  }

  const validRoles: Role[] = ['SUPER_ADMIN', 'ADMIN', 'EDITOR', 'AUTHOR', 'VIEWER']
  if (!validRoles.includes(role)) {
    return {
      error: locale === 'fa' ? 'سطح دسترسی انتخاب شده نامعتبر است.' : 'Invalid access level selected.',
    }
  }

  try {
    const existing = await db.user.findUnique({
      where: { email },
    })

    if (existing) {
      return {
        error: locale === 'fa' ? 'کاربری با این آدرس ایمیل قبلاً ثبت شده است.' : 'A user with this email already exists.',
      }
    }

    const hashedPassword = hashPassword(password)

    await db.user.create({
      data: {
        name: name || null,
        email,
        password: hashedPassword,
        role,
      },
    })

    revalidatePath('/[locale]/admin/users', 'page')
    return {
      success: true,
      message: locale === 'fa' ? 'کاربر جدید با موفقیت ایجاد شد.' : 'New user created successfully.',
    }
  } catch (err: unknown) {
    console.error('Error creating user:', err)
    return {
      error: locale === 'fa' ? 'خطا در ثبت کاربر در پایگاه داده.' : 'Failed to save user in database.',
    }
  }
}

export async function updateUserAction(
  userId: string,
  formData: FormData
): Promise<UserActionState> {
  const session = await getSession()

  if (!session || session.role !== 'SUPER_ADMIN') {
    return { error: 'دسترسی غیرمجاز: تنها مدیر ارشد مجاز به ویرایش کاربران است.' }
  }

  const name = formData.get('name')?.toString().trim() || null
  const email = formData.get('email')?.toString().trim().toLowerCase()
  const role = formData.get('role')?.toString() as Role
  const locale = formData.get('locale')?.toString() || 'fa'

  if (!email || !role) {
    return {
      error: locale === 'fa' ? 'ایمیل و نقش کاربری الزامی هستند.' : 'Email and role are required.',
    }
  }

  const validRoles: Role[] = ['SUPER_ADMIN', 'ADMIN', 'EDITOR', 'AUTHOR', 'VIEWER']
  if (!validRoles.includes(role)) {
    return {
      error: locale === 'fa' ? 'سطح دسترسی انتخاب شده نامعتبر است.' : 'Invalid access level selected.',
    }
  }

  try {
    const existing = await db.user.findFirst({
      where: {
        email,
        NOT: { id: userId },
      },
    })

    if (existing) {
      return {
        error: locale === 'fa' ? 'کاربر دیگری با این آدرس ایمیل وجود دارد.' : 'Another user already has this email.',
      }
    }

    if (session.userId === userId && role !== 'SUPER_ADMIN') {
      return {
        error: locale === 'fa' ? 'شما نمی‌توانید دسترسی مدیر ارشد حساب خودتان را کاهش دهید.' : 'You cannot demote your own Super Admin access.',
      }
    }

    await db.user.update({
      where: { id: userId },
      data: {
        name,
        email,
        role,
      },
    })

    revalidatePath('/[locale]/admin/users', 'page')
    return {
      success: true,
      message: locale === 'fa' ? 'مشخصات کاربر با موفقیت به‌روزرسانی شد.' : 'User updated successfully.',
    }
  } catch (err: unknown) {
    console.error('Error updating user:', err)
    return {
      error: locale === 'fa' ? 'خطا در ویرایش کاربر.' : 'Failed to update user.',
    }
  }
}

export async function changePasswordAction(
  userId: string,
  formData: FormData
): Promise<UserActionState> {
  const session = await getSession()

  if (!session || session.role !== 'SUPER_ADMIN') {
    return { error: 'دسترسی غیرمجاز: تنها مدیر ارشد مجاز به تغییر کلمه عبور است.' }
  }

  const password = formData.get('password')?.toString()
  const confirmPassword = formData.get('confirmPassword')?.toString()
  const locale = formData.get('locale')?.toString() || 'fa'

  if (!password || password.length < 8) {
    return {
      error: locale === 'fa' ? 'کلمه عبور باید حداقل ۸ کاراکتر باشد.' : 'Password must be at least 8 characters long.',
    }
  }

  if (confirmPassword && password !== confirmPassword) {
    return {
      error: locale === 'fa' ? 'تکرار کلمه عبور با کلمه عبور اصلی مطابقت ندارد.' : 'Passwords do not match.',
    }
  }

  try {
    const hashedPassword = hashPassword(password)

    await db.user.update({
      where: { id: userId },
      data: { password: hashedPassword },
    })

    revalidatePath('/[locale]/admin/users', 'page')
    return {
      success: true,
      message: locale === 'fa' ? 'کلمه عبور با موفقیت تغییر یافت.' : 'Password changed successfully.',
    }
  } catch (err: unknown) {
    console.error('Error changing password:', err)
    return {
      error: locale === 'fa' ? 'خطا در تغییر کلمه عبور.' : 'Failed to change password.',
    }
  }
}

export async function deleteUserAction(userId: string, locale: string = 'fa'): Promise<UserActionState> {
  const session = await getSession()

  if (!session || session.role !== 'SUPER_ADMIN') {
    return { error: 'دسترسی غیرمجاز.' }
  }

  if (session.userId === userId) {
    return {
      error: locale === 'fa' ? 'امکان حذف حساب کاربری جاری خودتان وجود ندارد.' : 'You cannot delete your own account.',
    }
  }

  try {
    await db.user.delete({
      where: { id: userId },
    })

    revalidatePath('/[locale]/admin/users', 'page')
    return {
      success: true,
      message: locale === 'fa' ? 'کاربر با موفقیت حذف گردید.' : 'User deleted successfully.',
    }
  } catch (err: unknown) {
    console.error('Error deleting user:', err)
    return {
      error: locale === 'fa' ? 'خطا در حذف کاربر.' : 'Failed to delete user.',
    }
  }
}
