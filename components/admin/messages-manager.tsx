'use client'

import React, { useTransition } from 'react'
import {
  toggleMessageReadAction,
  deleteMessageAction,
} from '@/app/actions/messages'

interface MessageItem {
  id: string
  name: string
  email: string | null
  phone: string
  subject: string | null
  message: string
  isRead: boolean
  createdAt: Date
}

interface Props {
  messages: MessageItem[]
  isEn: boolean
}

export function MessagesManager({ messages, isEn }: Props) {
  const [isPending, startTransition] = useTransition()

  const handleToggleRead = (m: MessageItem) => {
    startTransition(async () => {
      await toggleMessageReadAction(m.id)
    })
  }

  const handleDelete = (m: MessageItem) => {
    const confirmText = isEn
      ? `Delete message from "${m.name}"?`
      : `آیا از حذف پیام "${m.name}" اطمینان دارید؟`
    if (!window.confirm(confirmText)) return

    startTransition(async () => {
      const res = await deleteMessageAction(m.id)
      if (res.error) {
        alert(res.error)
      }
    })
  }

  return (
    <div className="space-y-6">
      {/* Top Bar */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">
          {isEn ? 'Contact Form Inbox' : 'پیام‌های فرم تماس'}
        </h1>
        <p className="text-sm text-muted-foreground">
          {isEn
            ? 'Incoming contact messages submitted through the website contact page'
            : 'صندوق پیام‌های ارسال شده از طریق صفحه تماس با ما'}
        </p>
      </div>

      {/* Messages Table */}
      <div className="bg-surface border border-border rounded-2xl overflow-hidden shadow-sm">
        <div className="p-4 border-b border-border bg-surface-elevated/40 flex items-center justify-between">
          <h2 className="text-xs font-bold text-foreground">
            {isEn
              ? `Received Inquiries (${messages.length} messages)`
              : `پیام‌های دریافتی (${messages.length} پیام)`}
          </h2>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-start">
            <thead className="bg-surface-elevated text-muted-foreground border-b border-border">
              <tr>
                <th className="px-5 py-3.5 text-start font-semibold">{isEn ? 'Sender' : 'فرستنده'}</th>
                <th className="px-5 py-3.5 text-start font-semibold">{isEn ? 'Phone / Email' : 'تماس / ایمیل'}</th>
                <th className="px-5 py-3.5 text-start font-semibold">{isEn ? 'Subject & Content' : 'موضوع و پیام'}</th>
                <th className="px-5 py-3.5 text-center font-semibold">{isEn ? 'Status' : 'وضعیت'}</th>
                <th className="px-5 py-3.5 text-start font-semibold">{isEn ? 'Date' : 'تاریخ'}</th>
                <th className="px-5 py-3.5 text-center font-semibold">{isEn ? 'Action' : 'عملیات'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {messages.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-8 text-muted-foreground">
                    {isEn ? 'No messages in the inbox' : 'پیامی در صندوق ورودی وجود ندارد'}
                  </td>
                </tr>
              ) : (
                messages.map((msg) => (
                  <tr key={msg.id} className="hover:bg-surface-elevated/50 transition-colors">
                    <td className="px-5 py-4 font-semibold text-foreground">
                      {msg.name}
                    </td>
                    <td className="px-5 py-4 text-muted-foreground font-mono">
                      <div>{msg.phone || '—'}</div>
                      <div className="text-[11px] opacity-75">{msg.email || ''}</div>
                    </td>
                    <td className="px-5 py-4 text-foreground/90 max-w-sm">
                      <div className="font-bold text-primary mb-0.5">
                        {msg.subject || (isEn ? 'No Subject' : 'بدون موضوع')}
                      </div>
                      <p className="text-muted-foreground leading-relaxed">{msg.message}</p>
                    </td>
                    <td className="px-5 py-4 text-center">
                      <button
                        type="button"
                        onClick={() => handleToggleRead(msg)}
                        disabled={isPending}
                        title={isEn ? 'Click to toggle read/unread' : 'کلیک برای تغییر وضعیت خوانده شده / جدید'}
                        className={`text-[11px] px-2.5 py-0.5 rounded-full font-medium transition-all cursor-pointer ${
                          msg.isRead
                            ? 'text-muted-foreground bg-surface-elevated border border-border'
                            : 'text-emerald-400 bg-emerald-500/15 border border-emerald-500/30'
                        }`}
                      >
                        {msg.isRead ? (isEn ? 'Read' : 'خوانده شده') : (isEn ? '● New' : '● جدید')}
                      </button>
                    </td>
                    <td className="px-5 py-4 text-muted-foreground">
                      {new Date(msg.createdAt).toLocaleDateString(isEn ? 'en-US' : 'fa-IR')}
                    </td>
                    <td className="px-5 py-4 text-center">
                      <button
                        type="button"
                        onClick={() => handleDelete(msg)}
                        className="text-red-400 hover:text-red-300 p-1 cursor-pointer"
                        title={isEn ? 'Delete message' : 'حذف پیام'}
                      >
                        🗑️
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
