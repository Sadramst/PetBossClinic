'use client'

import React, { useState, useTransition } from 'react'
import {
  createUserAction,
  updateUserAction,
  changePasswordAction,
  deleteUserAction,
} from '@/app/actions/users'
import { Role } from '@prisma/client'

interface UserItem {
  id: string
  name: string | null
  email: string | null
  role: Role
  createdAt: Date
}

interface Props {
  users: UserItem[]
  currentUserId?: string
  isEn: boolean
}

export function UsersManager({ users, currentUserId, isEn }: Props) {
  const [isPending, startTransition] = useTransition()
  const [addModalOpen, setAddModalOpen] = useState(false)
  const [editModalOpen, setEditModalOpen] = useState(false)
  const [passwordModalOpen, setPasswordModalOpen] = useState(false)
  const [targetUser, setTargetUser] = useState<UserItem | null>(null)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  // Add form fields
  const [addName, setAddName] = useState('')
  const [addEmail, setAddEmail] = useState('')
  const [addPassword, setAddPassword] = useState('')
  const [addRole, setAddRole] = useState<Role>('ADMIN')

  // Edit form fields
  const [editName, setEditName] = useState('')
  const [editEmail, setEditEmail] = useState('')
  const [editRole, setEditRole] = useState<Role>('ADMIN')

  // Password form fields
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')

  const openAddModal = () => {
    setAddName('')
    setAddEmail('')
    setAddPassword('')
    setAddRole('ADMIN')
    setMessage(null)
    setAddModalOpen(true)
  }

  const openEditModal = (user: UserItem) => {
    setTargetUser(user)
    setEditName(user.name || '')
    setEditEmail(user.email || '')
    setEditRole(user.role)
    setMessage(null)
    setEditModalOpen(true)
  }

  const openPasswordModal = (user: UserItem) => {
    setTargetUser(user)
    setNewPassword('')
    setConfirmPassword('')
    setMessage(null)
    setPasswordModalOpen(true)
  }

  const handleAddSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setMessage(null)

    const formData = new FormData()
    formData.append('name', addName)
    formData.append('email', addEmail)
    formData.append('password', addPassword)
    formData.append('role', addRole)
    formData.append('locale', isEn ? 'en' : 'fa')

    startTransition(async () => {
      const res = await createUserAction(undefined, formData)
      if (res.error) {
        setMessage({ type: 'error', text: res.error })
      } else {
        setMessage({ type: 'success', text: res.message || (isEn ? 'User created' : 'کاربر با موفقیت ثبت شد.') })
        setTimeout(() => setAddModalOpen(false), 800)
      }
    })
  }

  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!targetUser) return
    setMessage(null)

    const formData = new FormData()
    formData.append('name', editName)
    formData.append('email', editEmail)
    formData.append('role', editRole)
    formData.append('locale', isEn ? 'en' : 'fa')

    startTransition(async () => {
      const res = await updateUserAction(targetUser.id, formData)
      if (res.error) {
        setMessage({ type: 'error', text: res.error })
      } else {
        setMessage({ type: 'success', text: res.message || (isEn ? 'User updated' : 'مشخصات کاربر با موفقیت به‌روزرسانی شد.') })
        setTimeout(() => setEditModalOpen(false), 800)
      }
    })
  }

  const handlePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!targetUser) return
    setMessage(null)

    const formData = new FormData()
    formData.append('password', newPassword)
    formData.append('confirmPassword', confirmPassword)
    formData.append('locale', isEn ? 'en' : 'fa')

    startTransition(async () => {
      const res = await changePasswordAction(targetUser.id, formData)
      if (res.error) {
        setMessage({ type: 'error', text: res.error })
      } else {
        setMessage({ type: 'success', text: res.message || (isEn ? 'Password changed' : 'کلمه عبور با موفقیت تغییر یافت.') })
        setTimeout(() => setPasswordModalOpen(false), 800)
      }
    })
  }

  const handleDelete = (user: UserItem) => {
    const confirmText = isEn
      ? `Are you sure you want to permanently delete user "${user.name || user.email}"?`
      : `آیا از حذف حساب کاربری "${user.name || user.email}" اطمینان دارید؟`
    if (!window.confirm(confirmText)) return

    startTransition(async () => {
      const res = await deleteUserAction(user.id, isEn ? 'en' : 'fa')
      if (res.error) {
        alert(res.error)
      }
    })
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-border">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xl">👑</span>
            <h1 className="text-xl font-bold text-foreground">
              {isEn ? 'User Accounts & Roles' : 'مدیریت کاربران و سطوح دسترسی'}
            </h1>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-primary/20 text-primary border border-primary/30 font-semibold">
              {isEn ? 'Super Admin Control' : 'کنترل پنل مدیر ارشد'}
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            {isEn
              ? 'Manage administrators, editors, passwords, and system permissions with full authority'
              : 'مدیریت حساب‌های کاربری، تعیین نقش‌ها، تغییر کلمه عبور و کنترل دسترسی به بخش‌های مختلف کلینیک'}
          </p>
        </div>

        <button
          onClick={openAddModal}
          className="bg-gradient-to-r from-primary to-[#DFC07A] text-charcoal-950 font-bold px-4 py-2.5 rounded-xl text-xs shadow-gold hover:opacity-95 transition-all cursor-pointer flex items-center gap-1.5 self-start sm:self-auto"
        >
          <span>➕</span>
          <span>{isEn ? 'Add New User' : 'افزودن کاربر جدید'}</span>
        </button>
      </div>

      {/* Users Table */}
      <div className="bg-surface border border-border rounded-2xl overflow-hidden shadow-sm">
        <div className="p-4 border-b border-border bg-surface-elevated/40 flex items-center justify-between">
          <h2 className="text-xs font-bold text-foreground">
            {isEn ? `Registered Users (${users.length})` : `کاربران ثبت شده در سیستم (${users.length} نفر)`}
          </h2>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-start">
            <thead className="bg-surface-elevated text-muted-foreground border-b border-border">
              <tr>
                <th className="p-3.5 text-start font-semibold">{isEn ? 'Name' : 'نام و نام خانوادگی'}</th>
                <th className="p-3.5 text-start font-semibold">{isEn ? 'Email' : 'ایمیل (نام کاربری)'}</th>
                <th className="p-3.5 text-start font-semibold">{isEn ? 'Role / Access' : 'سطح دسترسی'}</th>
                <th className="p-3.5 text-start font-semibold">{isEn ? 'Created At' : 'تاریخ عضویت'}</th>
                <th className="p-3.5 text-center font-semibold">{isEn ? 'Actions' : 'عملیات'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {users.map((user) => {
                const isSelf = user.id === currentUserId

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
                        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold border ${
                          user.role === 'SUPER_ADMIN'
                            ? 'bg-primary/15 text-primary border-primary/30'
                            : user.role === 'ADMIN'
                            ? 'bg-blue-500/15 text-blue-400 border-blue-500/30'
                            : user.role === 'EDITOR'
                            ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                            : 'bg-surface-elevated text-muted-foreground border-border'
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
                      <div className="flex items-center justify-center gap-2">
                        <button
                          type="button"
                          onClick={() => openEditModal(user)}
                          className="px-2.5 py-1 rounded-lg bg-surface-elevated hover:bg-primary/20 text-primary border border-primary/30 transition-colors font-medium cursor-pointer"
                          title={isEn ? 'Edit user profile' : 'ویرایش مشخصات کاربر'}
                        >
                          ✏️ {isEn ? 'Edit' : 'ویرایش'}
                        </button>
                        <button
                          type="button"
                          onClick={() => openPasswordModal(user)}
                          className="px-2.5 py-1 rounded-lg bg-surface-elevated hover:bg-amber-500/20 text-amber-400 border border-amber-500/30 transition-colors font-medium cursor-pointer"
                          title={isEn ? 'Change password' : 'تغییر کلمه عبور'}
                        >
                          🔑 {isEn ? 'Password' : 'رمز عبور'}
                        </button>
                        {!isSelf && (
                          <button
                            type="button"
                            onClick={() => handleDelete(user)}
                            className="px-2 py-1 rounded-lg bg-surface-elevated hover:bg-red-500/20 text-red-400 border border-red-500/30 transition-colors cursor-pointer"
                            title={isEn ? 'Delete user' : 'حذف کاربر'}
                          >
                            🗑️
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add User Modal */}
      {addModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#181A20] border border-primary/30 rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <h2 className="text-base font-bold text-foreground">
                {isEn ? 'Add New User' : 'تعریف کاربر جدید'}
              </h2>
              <button
                onClick={() => setAddModalOpen(false)}
                className="text-muted-foreground hover:text-foreground text-sm p-1"
              >
                ✕
              </button>
            </div>

            {message && (
              <div
                className={`p-3 rounded-xl text-xs font-medium ${
                  message.type === 'success'
                    ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-400'
                    : 'bg-red-500/10 border border-red-500/30 text-red-400'
                }`}
              >
                {message.text}
              </div>
            )}

            <form onSubmit={handleAddSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-foreground/80 mb-1">
                  {isEn ? 'Full Name' : 'نام و نام‌خانوادگی'}
                </label>
                <input
                  type="text"
                  value={addName}
                  onChange={(e) => setAddName(e.target.value)}
                  placeholder={isEn ? 'Dr. Sarah Smith' : 'دکتر مریم احمدی'}
                  className="w-full px-3.5 py-2 rounded-xl bg-surface-elevated border border-border text-xs text-foreground focus:border-primary outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-foreground/80 mb-1">
                  {isEn ? 'Email (Username) *' : 'ایمیل (نام کاربری ورود) *'}
                </label>
                <input
                  type="email"
                  required
                  value={addEmail}
                  onChange={(e) => setAddEmail(e.target.value)}
                  placeholder="doctor@petboss.com"
                  className="w-full px-3.5 py-2 rounded-xl bg-surface-elevated border border-border text-xs text-foreground focus:border-primary outline-none dir-ltr"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-foreground/80 mb-1">
                  {isEn ? 'Initial Password (min 8 characters) *' : 'کلمه عبور اولیه (حداقل ۸ کاراکتر) *'}
                </label>
                <input
                  type="password"
                  required
                  value={addPassword}
                  onChange={(e) => setAddPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full px-3.5 py-2 rounded-xl bg-surface-elevated border border-border text-xs text-foreground focus:border-primary outline-none dir-ltr"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-foreground/80 mb-1">
                  {isEn ? 'Role / Access Level *' : 'سطح دسترسی (نقش کاربری) *'}
                </label>
                <select
                  value={addRole}
                  onChange={(e) => setAddRole(e.target.value as Role)}
                  className="w-full px-3.5 py-2 rounded-xl bg-surface-elevated border border-border text-xs text-foreground focus:border-primary outline-none cursor-pointer"
                >
                  <option value="SUPER_ADMIN">👑 {isEn ? 'Super Admin (Full System Control)' : 'مدیر ارشد (دسترسی کامل و مدیریت کاربران)'}</option>
                  <option value="ADMIN">🩺 {isEn ? 'Clinic Admin (Content, Services, CRM)' : 'مدیر کلینیک (خدمات، محصولات، سرنخ‌ها)'}</option>
                  <option value="EDITOR">✍️ {isEn ? 'Editor (Articles & FAQs)' : 'کارشناس محتوا (مقالات و سوالات)'}</option>
                  <option value="VIEWER">👁️ {isEn ? 'Viewer (Read-Only)' : 'مشاهده‌گر (فقط خواندنی)'}</option>
                </select>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-border">
                <button
                  type="button"
                  onClick={() => setAddModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-border text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  {isEn ? 'Cancel' : 'انصراف'}
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="px-5 py-2 rounded-xl bg-primary text-charcoal-950 font-bold text-xs hover:opacity-90 active:scale-[0.99] transition-all shadow-gold disabled:opacity-50 cursor-pointer"
                >
                  {isPending ? (isEn ? 'Creating...' : 'در حال ثبت...') : (isEn ? 'Create User' : 'ثبت کاربر')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit User Modal */}
      {editModalOpen && targetUser && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#181A20] border border-primary/30 rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <h2 className="text-base font-bold text-foreground">
                {isEn ? 'Edit User Details' : 'ویرایش مشخصات کاربر'}
              </h2>
              <button
                onClick={() => setEditModalOpen(false)}
                className="text-muted-foreground hover:text-foreground text-sm p-1"
              >
                ✕
              </button>
            </div>

            {message && (
              <div
                className={`p-3 rounded-xl text-xs font-medium ${
                  message.type === 'success'
                    ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-400'
                    : 'bg-red-500/10 border border-red-500/30 text-red-400'
                }`}
              >
                {message.text}
              </div>
            )}

            <form onSubmit={handleEditSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-foreground/80 mb-1">
                  {isEn ? 'Full Name' : 'نام و نام‌خانوادگی'}
                </label>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl bg-surface-elevated border border-border text-xs text-foreground focus:border-primary outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-foreground/80 mb-1">
                  {isEn ? 'Email *' : 'ایمیل (نام کاربری) *'}
                </label>
                <input
                  type="email"
                  required
                  value={editEmail}
                  onChange={(e) => setEditEmail(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl bg-surface-elevated border border-border text-xs text-foreground focus:border-primary outline-none dir-ltr"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-foreground/80 mb-1">
                  {isEn ? 'Role / Access Level *' : 'سطح دسترسی (نقش کاربری) *'}
                </label>
                <select
                  value={editRole}
                  onChange={(e) => setEditRole(e.target.value as Role)}
                  disabled={targetUser.id === currentUserId}
                  className="w-full px-3.5 py-2 rounded-xl bg-surface-elevated border border-border text-xs text-foreground focus:border-primary outline-none cursor-pointer disabled:opacity-50"
                >
                  <option value="SUPER_ADMIN">👑 {isEn ? 'Super Admin' : 'مدیر ارشد (Super Admin)'}</option>
                  <option value="ADMIN">🩺 {isEn ? 'Clinic Admin' : 'مدیر کلینیک (Clinic Admin)'}</option>
                  <option value="EDITOR">✍️ {isEn ? 'Editor' : 'کارشناس محتوا (Content Editor)'}</option>
                  <option value="VIEWER">👁️ {isEn ? 'Viewer' : 'مشاهده‌گر (Viewer)'}</option>
                </select>
                {targetUser.id === currentUserId && (
                  <p className="text-[10px] text-muted-foreground mt-1">
                    {isEn ? 'You cannot alter your own role.' : 'امکان تغییر سطح دسترسی حساب جاری خودتان وجود ندارد.'}
                  </p>
                )}
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-border">
                <button
                  type="button"
                  onClick={() => setEditModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-border text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  {isEn ? 'Cancel' : 'انصراف'}
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="px-5 py-2 rounded-xl bg-primary text-charcoal-950 font-bold text-xs hover:opacity-90 active:scale-[0.99] transition-all shadow-gold disabled:opacity-50 cursor-pointer"
                >
                  {isPending ? (isEn ? 'Updating...' : 'در حال به‌روزرسانی...') : (isEn ? 'Save Changes' : 'ذخیره تغییرات')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Change Password Modal */}
      {passwordModalOpen && targetUser && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#181A20] border border-primary/30 rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <div>
                <h2 className="text-base font-bold text-foreground">
                  {isEn ? 'Change Password' : 'تغییر کلمه عبور'}
                </h2>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  {targetUser.name || targetUser.email}
                </p>
              </div>
              <button
                onClick={() => setPasswordModalOpen(false)}
                className="text-muted-foreground hover:text-foreground text-sm p-1"
              >
                ✕
              </button>
            </div>

            {message && (
              <div
                className={`p-3 rounded-xl text-xs font-medium ${
                  message.type === 'success'
                    ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-400'
                    : 'bg-red-500/10 border border-red-500/30 text-red-400'
                }`}
              >
                {message.text}
              </div>
            )}

            <form onSubmit={handlePasswordSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-foreground/80 mb-1">
                  {isEn ? 'New Password (min 8 characters) *' : 'کلمه عبور جدید (حداقل ۸ کاراکتر) *'}
                </label>
                <input
                  type="password"
                  required
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full px-3.5 py-2 rounded-xl bg-surface-elevated border border-border text-xs text-foreground focus:border-primary outline-none dir-ltr"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-foreground/80 mb-1">
                  {isEn ? 'Confirm New Password *' : 'تکرار کلمه عبور جدید *'}
                </label>
                <input
                  type="password"
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full px-3.5 py-2 rounded-xl bg-surface-elevated border border-border text-xs text-foreground focus:border-primary outline-none dir-ltr"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-border">
                <button
                  type="button"
                  onClick={() => setPasswordModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-border text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  {isEn ? 'Cancel' : 'انصراف'}
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="px-5 py-2 rounded-xl bg-primary text-charcoal-950 font-bold text-xs hover:opacity-90 active:scale-[0.99] transition-all shadow-gold disabled:opacity-50 cursor-pointer"
                >
                  {isPending ? (isEn ? 'Updating...' : 'در حال ثبت...') : (isEn ? 'Update Password' : 'ثبت کلمه عبور جدید')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
