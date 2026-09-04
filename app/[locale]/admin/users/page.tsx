import React from 'react'
import { getTranslations } from 'next-intl/server'
import { db } from '@/lib/db'
import { getSession } from '@/lib/auth'
import { createUserAction, deleteUserAction } from '@/app/actions/users'
import { revalidatePath } from 'next/cache'

interface Props {
  params: Promise<{ locale: string }>
}

export default async function AdminUsersPage({ params }: Props) {
  const { locale } = await params
  const isEn = locale === 'en'
  const t = await getTranslations('Admin')
  const session = await getSession()

  // RBAC Check: Only SUPER_ADMIN can view and manage users
  const isSuperAdmin = session?.role === 'SUPER_ADMIN'

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

  async function handleDelete(formData: FormData) {
    'use server'
    const userId = formData.get('userId')?.toString()
    if (userId) {
      await deleteUserAction(userId, locale)
      revalidatePath('/[locale]/admin/users', 'page')
    }
  }

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-border">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xl">👑</span>
            <h1 className="text-xl font-bold text-foreground">{t('users')}</h1>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-primary/20 text-primary border border-primary/30 font-semibold">
              {t('superAdminBadge')}
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            {t('roleAccessDesc')}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* User Creation Form */}
        <div className="lg:col-span-1">
          <div className="bg-surface border border-border rounded-2xl p-6">
            <h2 className="text-sm font-bold text-foreground mb-1 flex items-center gap-2">
              <span>➕</span>
              <span>{t('addUser')}</span>
            </h2>
            <p className="text-[11px] text-muted-foreground mb-5">
              {isEn ? 'Assign roles to staff members with granular access levels.' : 'ایجاد حساب کاربری با تعیین سطح دسترسی مشخص برای پرسنل کلینیک.'}
            </p>

            <form action={async (formData: FormData) => {
              'use server'
              await createUserAction(undefined, formData)
            }} className="space-y-4">
              <input type="hidden" name="locale" value={locale} />
              <div>
                <label className="block text-xs font-semibold text-foreground/80 mb-1">
                  {t('name')}
                </label>
                <input
                  name="name"
                  type="text"
                  placeholder={isEn ? 'Dr. Sarah Jones' : 'دکتر مریم احمدی'}
                  className="w-full px-3.5 py-2 rounded-xl bg-surface-elevated border border-border text-xs text-foreground focus:border-primary outline-none"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-foreground/80 mb-1">
                  {t('email')}
                </label>
                <input
                  name="email"
                  type="email"
                  placeholder="vet@petboss.com"
                  className="w-full px-3.5 py-2 rounded-xl bg-surface-elevated border border-border text-xs text-foreground focus:border-primary outline-none"
                  dir="ltr"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-foreground/80 mb-1">
                  {t('password')}
                </label>
                <input
                  name="password"
                  type="password"
                  placeholder="••••••••••••"
                  className="w-full px-3.5 py-2 rounded-xl bg-surface-elevated border border-border text-xs text-foreground focus:border-primary outline-none"
                  dir="ltr"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-foreground/80 mb-1">
                  {t('role')}
                </label>
                <select
                  name="role"
                  defaultValue="ADMIN"
                  className="w-full px-3.5 py-2 rounded-xl bg-surface-elevated border border-border text-xs text-foreground focus:border-primary outline-none cursor-pointer"
                >
                  <option value="SUPER_ADMIN">👑 {isEn ? 'Super Admin (Full System & User Control)' : 'مدیر ارشد (دسترسی کامل و مدیریت کاربران)'}</option>
                  <option value="ADMIN">🩺 {isEn ? 'Clinic Admin (Content, Services, Staff, Leads)' : 'مدیر کلینیک (مدیریت خدمات، کادر، سرنخ‌ها)'}</option>
                  <option value="EDITOR">✍️ {isEn ? 'Editor (Articles & Content)' : 'کارشناس محتوا (ویرایش مقالات و محتوا)'}</option>
                  <option value="VIEWER">👁️ {isEn ? 'Viewer (Read-Only)' : 'مشاهده‌گر (فقط خواندنی)'}</option>
                </select>
              </div>

              <button
                type="submit"
                className="w-full mt-2 py-2.5 rounded-xl bg-primary text-charcoal-950 font-bold text-xs hover:opacity-90 active:scale-[0.99] transition-all shadow-gold cursor-pointer"
              >
                {t('addUser')}
              </button>
            </form>
          </div>
        </div>

        {/* Users Table */}
        <div className="lg:col-span-2">
          <div className="bg-surface border border-border rounded-2xl overflow-hidden">
            <div className="p-4 border-b border-border bg-surface-elevated/40 flex items-center justify-between">
              <h2 className="text-xs font-bold text-foreground">
                {t('userList')} ({users.length})
              </h2>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs text-start">
                <thead className="bg-surface-elevated text-muted-foreground border-b border-border">
                  <tr>
                    <th className="p-3.5 text-start font-semibold">{t('name')}</th>
                    <th className="p-3.5 text-start font-semibold">{t('email')}</th>
                    <th className="p-3.5 text-start font-semibold">{t('role')}</th>
                    <th className="p-3.5 text-start font-semibold">{t('createdAt')}</th>
                    <th className="p-3.5 text-center font-semibold">{t('actions')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {users.map((user) => {
                    const isSelf = user.id === session?.userId
                    return (
                      <tr key={user.id} className="hover:bg-surface-elevated/50 transition-colors">
                        <td className="p-3.5 font-semibold text-foreground">
                          {user.name || (isEn ? 'Anonymous' : 'بی‌نام')}
                          {isSelf && (
                            <span className="ms-2 px-1.5 py-0.5 rounded bg-primary/20 text-primary text-[10px]">
                              {isEn ? '(You)' : '(شما)'}
                            </span>
                          )}
                        </td>
                        <td className="p-3.5 text-muted-foreground font-mono" dir="ltr">
                          {user.email}
                        </td>
                        <td className="p-3.5">
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                              user.role === 'SUPER_ADMIN'
                                ? 'bg-primary/15 text-primary border-primary/30'
                                : user.role === 'ADMIN'
                                ? 'bg-blue-500/15 text-blue-400 border-blue-500/30'
                                : 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                            }`}
                          >
                            {user.role === 'SUPER_ADMIN' && '👑 '}
                            {user.role === 'ADMIN' && '🩺 '}
                            {user.role === 'EDITOR' && '✍️ '}
                            {user.role}
                          </span>
                        </td>
                        <td className="p-3.5 text-muted-foreground">
                          {new Date(user.createdAt).toLocaleDateString(isEn ? 'en-US' : 'fa-IR')}
                        </td>
                        <td className="p-3.5 text-center">
                          {!isSelf && (
                            <form action={handleDelete} className="inline">
                              <input type="hidden" name="userId" value={user.id} />
                              <button
                                type="submit"
                                className="text-red-400 hover:text-red-300 px-2 py-1 rounded hover:bg-red-500/10 transition-colors"
                                title={t('deleteUser')}
                              >
                                🗑️
                              </button>
                            </form>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
