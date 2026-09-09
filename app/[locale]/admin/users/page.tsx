import React from 'react'
import { db } from '@/lib/db'
import { requireAdmin } from '@/lib/auth/guard'
import { UsersManager } from '@/components/admin/users-manager'

interface Props {
  params: Promise<{ locale: string }>
}

export default async function AdminUsersPage({ params }: Props) {
  const { locale } = await params
  const isEn = locale === 'en'
  const session = await requireAdmin('SUPER_ADMIN', locale)
  const isSuperAdmin = session.role === 'SUPER_ADMIN'

  if (!isSuperAdmin) {
    return (
      <div className="max-w-2xl mx-auto py-16 text-center">
        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center text-2xl">
          🔒
        </div>
        <h2 className="text-xl font-bold text-foreground mb-2">
          {isEn ? 'Access Restricted' : 'عدم دسترسی به این بخش'}
        </h2>
        <p className="text-sm text-muted-foreground leading-relaxed">
          {isEn
            ? 'Only the Super Administrator has authorization to view or configure user accounts and system accessibility levels.'
            : 'تنها مدیر ارشد سیستم (Super Admin) مجاز به مشاهده، تعریف یا تغییر سطوح دسترسی سایر کاربران می‌باشد.'}
        </p>
      </div>
    )
  }

  // Fetch all registered users
  const users = await db.user.findMany({
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      createdAt: true,
    },
  })

  return (
    <UsersManager
      users={users}
      currentUserId={session?.userId}
      isEn={isEn}
    />
  )
}
