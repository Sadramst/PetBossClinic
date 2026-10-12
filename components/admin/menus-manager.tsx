'use client'

import React, { useState, useTransition } from 'react'
import {
  upsertMenuItemAction,
  toggleMenuItemAction,
  deleteMenuItemAction,
  reorderMenuItemsAction,
} from '@/app/actions/menus'

export interface MenuItemData {
  id: string
  menuId: string
  parentId: string | null
  labelFa: string
  labelEn: string | null
  url: string
  isActive: boolean
  sortOrder: number
}

export interface NavigationMenuData {
  id: string
  name: string
  items: MenuItemData[]
}

interface Props {
  menus: NavigationMenuData[]
  isEn: boolean
}

export function MenusManager({ menus, isEn }: Props) {
  const [selectedMenuName, setSelectedMenuName] = useState<string>('header')
  const [isPending, startTransition] = useTransition()
  const [modalOpen, setModalOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<MenuItemData | null>(null)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  // Form fields
  const [labelFa, setLabelFa] = useState('')
  const [labelEn, setLabelEn] = useState('')
  const [url, setUrl] = useState('')
  const [sortOrder, setSortOrder] = useState('0')
  const [isActive, setIsActive] = useState(true)

  const activeMenu = menus.find((m) => m.name === selectedMenuName) || menus[0]
  const items = activeMenu ? [...activeMenu.items].sort((a, b) => a.sortOrder - b.sortOrder) : []

  const openAddModal = () => {
    setEditingItem(null)
    setLabelFa('')
    setLabelEn('')
    setUrl('/')
    setSortOrder((items.length * 10).toString())
    setIsActive(true)
    setMessage(null)
    setModalOpen(true)
  }

  const openEditModal = (item: MenuItemData) => {
    setEditingItem(item)
    setLabelFa(item.labelFa)
    setLabelEn(item.labelEn || '')
    setUrl(item.url)
    setSortOrder(item.sortOrder.toString())
    setIsActive(item.isActive)
    setMessage(null)
    setModalOpen(true)
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setMessage(null)

    const formData = new FormData()
    if (editingItem) formData.append('id', editingItem.id)
    formData.append('menuName', selectedMenuName)
    formData.append('labelFa', labelFa)
    formData.append('labelEn', labelEn)
    formData.append('url', url)
    formData.append('sortOrder', sortOrder)
    formData.append('isActive', isActive ? 'true' : 'false')

    startTransition(async () => {
      const res = await upsertMenuItemAction(formData)
      if (res.error) {
        setMessage({ type: 'error', text: res.error })
      } else {
        setMessage({ type: 'success', text: res.message || 'ثبت شد.' })
        setModalOpen(false)
      }
    })
  }

  const handleToggle = (id: string, current: boolean) => {
    startTransition(async () => {
      const res = await toggleMenuItemAction(id, !current)
      if (res.error) setMessage({ type: 'error', text: res.error })
    })
  }

  const handleDelete = (id: string, name: string) => {
    if (!confirm(`آیا از حذف آیتم منو «${name}» اطمینان دارید؟`)) return
    startTransition(async () => {
      const res = await deleteMenuItemAction(id)
      if (res.error) setMessage({ type: 'error', text: res.error })
    })
  }

  const handleMove = (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1
    if (targetIndex < 0 || targetIndex >= items.length) return

    const newItems = [...items]
    const temp = newItems[index]
    newItems[index] = newItems[targetIndex]
    newItems[targetIndex] = temp

    const updates = newItems.map((item, idx) => ({
      id: item.id,
      sortOrder: idx * 10,
    }))

    startTransition(async () => {
      const res = await reorderMenuItemsAction(updates)
      if (res.error) setMessage({ type: 'error', text: res.error })
    })
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-foreground">
            {isEn ? 'Navigation Menus' : 'مدیریت منوهای ناوبری'}
          </h1>
          <p className="text-xs text-muted-foreground mt-1">
            {isEn
              ? 'Configure header and footer links, labels in Persian and English, and display order.'
              : 'تنظیم پیوندهای سربرگ (هدر) و پابرگ (فوتر)، عناوین دوزبانه و ترتیب نمایش.'}
          </p>
        </div>
        <button
          onClick={openAddModal}
          className="px-4 py-2.5 rounded-xl bg-primary text-charcoal-950 font-bold text-xs hover:bg-primary-hover shadow-gold transition-all cursor-pointer flex items-center gap-2 self-start"
        >
          <span>➕</span>
          <span>{isEn ? 'Add Menu Item' : 'افزودن آیتم جدید'}</span>
        </button>
      </div>

      {message && (
        <div
          className={`p-4 rounded-xl text-xs font-semibold flex items-center gap-2 ${
            message.type === 'success'
              ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-400'
              : 'bg-red-500/10 border border-red-500/30 text-red-400'
          }`}
        >
          <span>{message.type === 'success' ? '✓' : '⚠️'}</span>
          <span>{message.text}</span>
        </div>
      )}

      {/* Menu Tabs */}
      <div className="flex items-center gap-2 border-b border-border pb-3">
        <button
          onClick={() => setSelectedMenuName('header')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            selectedMenuName === 'header'
              ? 'bg-primary text-charcoal-950 shadow-gold'
              : 'bg-surface-elevated text-muted-foreground hover:text-foreground'
          }`}
        >
          {isEn ? 'Header Menu (Main Navigation)' : 'منوی هدر (ناوبری اصلی)'}
        </button>
        <button
          onClick={() => setSelectedMenuName('footer')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            selectedMenuName === 'footer'
              ? 'bg-primary text-charcoal-950 shadow-gold'
              : 'bg-surface-elevated text-muted-foreground hover:text-foreground'
          }`}
        >
          {isEn ? 'Footer Menu (Quick Links)' : 'منوی فوتر (دسترسی سریع)'}
        </button>
      </div>

      {/* Menu Items List */}
      <div className="bg-surface border border-border rounded-2xl overflow-hidden shadow-sm">
        <div className="divide-y divide-border">
          {items.map((item, index) => (
            <div
              key={item.id}
              className={`p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-colors ${
                item.isActive ? 'hover:bg-surface-elevated/40' : 'bg-surface/50 opacity-60'
              }`}
            >
              <div className="flex items-center gap-4">
                <div className="flex flex-col gap-1">
                  <button
                    onClick={() => handleMove(index, 'up')}
                    disabled={index === 0 || isPending}
                    className="p-1 text-muted-foreground hover:text-primary disabled:opacity-30 cursor-pointer"
                    title={isEn ? 'Move up' : 'حرکت به بالا'}
                  >
                    ▲
                  </button>
                  <button
                    onClick={() => handleMove(index, 'down')}
                    disabled={index === items.length - 1 || isPending}
                    className="p-1 text-muted-foreground hover:text-primary disabled:opacity-30 cursor-pointer"
                    title={isEn ? 'Move down' : 'حرکت به پایین'}
                  >
                    ▼
                  </button>
                </div>

                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm text-foreground">{item.labelFa}</span>
                    {item.labelEn && (
                      <span className="text-xs text-muted-foreground font-medium">({item.labelEn})</span>
                    )}
                  </div>
                  <div className="text-xs text-primary font-mono mt-0.5" dir="ltr">
                    {item.url}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3 self-end sm:self-center">
                <button
                  onClick={() => handleToggle(item.id, item.isActive)}
                  disabled={isPending}
                  className={`text-[11px] px-2.5 py-1 rounded-full font-medium transition-colors cursor-pointer ${
                    item.isActive
                      ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                      : 'bg-zinc-500/10 text-zinc-400 border border-zinc-500/20'
                  }`}
                >
                  {item.isActive ? (isEn ? 'Active' : 'فعال') : (isEn ? 'Inactive' : 'غیرفعال')}
                </button>

                <button
                  onClick={() => openEditModal(item)}
                  className="p-2 text-muted-foreground hover:text-primary transition-colors cursor-pointer rounded-lg hover:bg-surface-elevated"
                  title={isEn ? 'Edit' : 'ویرایش'}
                >
                  ✏️
                </button>
                <button
                  onClick={() => handleDelete(item.id, item.labelFa)}
                  className="p-2 text-muted-foreground hover:text-red-400 transition-colors cursor-pointer rounded-lg hover:bg-surface-elevated"
                  title={isEn ? 'Delete' : 'حذف'}
                >
                  🗑️
                </button>
              </div>
            </div>
          ))}

          {items.length === 0 && (
            <div className="p-12 text-center text-muted-foreground text-xs">
              {isEn ? 'No items in this menu.' : 'هیچ آیتمی در این منو وجود ندارد.'}
            </div>
          )}
        </div>
      </div>

      {/* Modal Dialog */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-lg bg-surface border border-border rounded-2xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <h2 className="text-base font-bold text-foreground">
                {editingItem
                  ? (isEn ? 'Edit Menu Item' : 'ویرایش آیتم منو')
                  : (isEn ? 'Add Menu Item' : 'افزودن آیتم منو')}
              </h2>
              <button
                onClick={() => setModalOpen(false)}
                className="text-muted-foreground hover:text-foreground text-lg leading-none cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1">
                    {isEn ? 'Persian Label' : 'عنوان فارسی'}
                  </label>
                  <input
                    type="text"
                    value={labelFa}
                    onChange={(e) => setLabelFa(e.target.value)}
                    required
                    placeholder="مثال: خدمات درمانی"
                    className="w-full px-3 py-2 rounded-xl bg-surface-elevated border border-border text-foreground text-xs focus:outline-none focus:border-primary"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1">
                    {isEn ? 'English Label' : 'عنوان انگلیسی (اختیاری)'}
                  </label>
                  <input
                    type="text"
                    value={labelEn}
                    onChange={(e) => setLabelEn(e.target.value)}
                    placeholder="e.g. Services"
                    dir="ltr"
                    className="w-full px-3 py-2 rounded-xl bg-surface-elevated border border-border text-foreground text-xs focus:outline-none focus:border-primary"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">
                  {isEn ? 'Target URL' : 'آدرس اینترنتی (مسیر داخلی یا لینک خارجی)'}
                </label>
                <input
                  type="text"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  required
                  placeholder="/services یا https://example.com"
                  dir="ltr"
                  className="w-full px-3 py-2 rounded-xl bg-surface-elevated border border-border text-foreground text-xs focus:outline-none focus:border-primary"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1">
                    {isEn ? 'Sort Order' : 'ترتیب نمایش (عدد)'}
                  </label>
                  <input
                    type="number"
                    value={sortOrder}
                    onChange={(e) => setSortOrder(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-surface-elevated border border-border text-foreground text-xs focus:outline-none focus:border-primary"
                  />
                </div>
                <div className="flex items-center gap-2 pt-6">
                  <input
                    type="checkbox"
                    id="menuActive"
                    checked={isActive}
                    onChange={(e) => setIsActive(e.target.checked)}
                    className="rounded border-border text-primary focus:ring-primary w-4 h-4 cursor-pointer"
                  />
                  <label htmlFor="menuActive" className="text-xs font-semibold text-foreground cursor-pointer">
                    {isEn ? 'Active & Visible' : 'فعال و قابل نمایش'}
                  </label>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-border">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-border text-xs text-muted-foreground hover:bg-surface-elevated cursor-pointer"
                >
                  {isEn ? 'Cancel' : 'انصراف'}
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="px-5 py-2 rounded-xl bg-primary text-charcoal-950 font-bold text-xs hover:bg-primary-hover shadow-gold cursor-pointer"
                >
                  {isPending ? (isEn ? 'Saving...' : 'در حال ذخیره...') : (isEn ? 'Save' : 'ذخیره')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
