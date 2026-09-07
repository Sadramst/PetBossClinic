'use client'

import React, { useState, useTransition } from 'react'
import {
  createProductAction,
  updateProductAction,
  deleteProductAction,
} from '@/app/actions/products'
import { StockStatus } from '@prisma/client'

interface ProductCategoryItem {
  id: string
  nameFa: string
  nameEn: string | null
}

interface ProductItem {
  id: string
  categoryId: string
  nameFa: string
  nameEn: string | null
  slugFa: string
  slugEn: string | null
  price: number
  stockStatus: StockStatus
  shortDescFa: string | null
  shortDescEn: string | null
  isActive: boolean
  category: ProductCategoryItem | null
}

interface Props {
  products: ProductItem[]
  categories: ProductCategoryItem[]
  isEn: boolean
}

export function ProductsManager({ products, categories, isEn }: Props) {
  const [isPending, startTransition] = useTransition()
  const [modalOpen, setModalOpen] = useState(false)
  const [editingProduct, setEditingProduct] = useState<ProductItem | null>(null)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  // Form fields
  const [categoryId, setCategoryId] = useState(categories[0]?.id || '')
  const [nameFa, setNameFa] = useState('')
  const [nameEn, setNameEn] = useState('')
  const [price, setPrice] = useState('')
  const [stockStatus, setStockStatus] = useState<StockStatus>('IN_STOCK')
  const [shortDescFa, setShortDescFa] = useState('')
  const [shortDescEn, setShortDescEn] = useState('')
  const [isActive, setIsActive] = useState(true)

  const openAddModal = () => {
    setEditingProduct(null)
    setCategoryId(categories[0]?.id || '')
    setNameFa('')
    setNameEn('')
    setPrice('')
    setStockStatus('IN_STOCK')
    setShortDescFa('')
    setShortDescEn('')
    setIsActive(true)
    setMessage(null)
    setModalOpen(true)
  }

  const openEditModal = (p: ProductItem) => {
    setEditingProduct(p)
    setCategoryId(p.categoryId)
    setNameFa(p.nameFa)
    setNameEn(p.nameEn || '')
    setPrice(p.price.toString())
    setStockStatus(p.stockStatus)
    setShortDescFa(p.shortDescFa || '')
    setShortDescEn(p.shortDescEn || '')
    setIsActive(p.isActive)
    setMessage(null)
    setModalOpen(true)
  }

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault()
    setMessage(null)

    const formData = new FormData()
    formData.append('categoryId', categoryId)
    formData.append('nameFa', nameFa)
    formData.append('nameEn', nameEn)
    formData.append('price', price)
    formData.append('stockStatus', stockStatus)
    formData.append('shortDescFa', shortDescFa)
    formData.append('shortDescEn', shortDescEn)
    formData.append('isActive', isActive ? 'true' : 'false')

    startTransition(async () => {
      let res
      if (editingProduct) {
        res = await updateProductAction(editingProduct.id, formData)
      } else {
        res = await createProductAction(formData)
      }

      if (res.error) {
        setMessage({ type: 'error', text: res.error })
      } else {
        setMessage({ type: 'success', text: res.message || (isEn ? 'Saved successfully' : 'با موفقیت ذخیره شد.') })
        setTimeout(() => setModalOpen(false), 800)
      }
    })
  }

  const handleDelete = (p: ProductItem) => {
    const confirmText = isEn
      ? `Are you sure you want to delete "${p.nameEn || p.nameFa}"?`
      : `آیا از حذف محصول "${p.nameFa}" اطمینان دارید؟`
    if (!window.confirm(confirmText)) return

    startTransition(async () => {
      const res = await deleteProductAction(p.id)
      if (res.error) {
        alert(res.error)
      }
    })
  }

  return (
    <div className="space-y-6">
      {/* Top Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            {isEn ? 'Pet Shop Product Catalog' : 'کاتالوگ محصولات پت‌شاپ'}
          </h1>
          <p className="text-sm text-muted-foreground">
            {isEn
              ? 'Manage dry food, wet food, accessories, and luxury pet supplies'
              : 'مدیریت محصولات غذایی، درمانی، بهداشتی و لوازم لوکس پت‌شاپ'}
          </p>
        </div>
        <button
          onClick={openAddModal}
          className="bg-gradient-to-r from-primary to-[#DFC07A] text-charcoal-950 font-bold px-4 py-2.5 rounded-xl text-xs shadow-gold hover:opacity-95 transition-all cursor-pointer flex items-center gap-1.5"
        >
          <span>➕</span>
          <span>{isEn ? 'Add Product' : 'افزودن محصول جدید'}</span>
        </button>
      </div>

      {/* Table Card */}
      <div className="bg-surface border border-border rounded-2xl overflow-hidden shadow-sm">
        <div className="p-4 border-b border-border bg-surface-elevated/40 flex items-center justify-between">
          <h2 className="text-xs font-bold text-foreground">
            {isEn ? `Product List (${products.length} items)` : `لیست محصولات موجود (${products.length} محصول)`}
          </h2>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-start">
            <thead className="bg-surface-elevated text-muted-foreground border-b border-border">
              <tr>
                <th className="px-5 py-3.5 text-start font-semibold">{isEn ? 'Product Name' : 'نام محصول'}</th>
                <th className="px-5 py-3.5 text-start font-semibold">{isEn ? 'Category' : 'دسته‌بندی'}</th>
                <th className="px-5 py-3.5 text-start font-semibold">{isEn ? 'Price (Toman)' : 'قیمت (تومان)'}</th>
                <th className="px-5 py-3.5 text-center font-semibold">{isEn ? 'Stock Status' : 'وضعیت موجودی'}</th>
                <th className="px-5 py-3.5 text-center font-semibold">{isEn ? 'Actions' : 'عملیات'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {products.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-center py-8 text-muted-foreground">
                    {isEn ? 'No products registered yet. Click "+ Add Product" to add one.' : 'محصولی در کاتالوگ ثبت نشده است. برای افزودن، بر روی "+ افزودن محصول جدید" کلیک کنید.'}
                  </td>
                </tr>
              ) : (
                products.map((item) => {
                  const pName = isEn ? (item.nameEn || item.nameFa) : item.nameFa
                  const catName = isEn ? (item.category?.nameEn || item.category?.nameFa) : item.category?.nameFa

                  return (
                    <tr key={item.id} className="hover:bg-surface-elevated/50 transition-colors">
                      <td className="px-5 py-4 font-semibold text-foreground">
                        <div>{pName}</div>
                        <div className="text-[11px] text-muted-foreground font-normal">
                          {isEn ? item.nameFa : (item.nameEn || item.slugFa)}
                        </div>
                      </td>
                      <td className="px-5 py-4 text-muted-foreground">
                        {catName || (isEn ? 'General' : 'عمومی')}
                      </td>
                      <td className="px-5 py-4 font-bold text-primary font-mono">
                        {item.price
                          ? (isEn ? item.price.toLocaleString('en-US') : item.price.toLocaleString('fa-IR'))
                          : '—'}
                      </td>
                      <td className="px-5 py-4 text-center">
                        <span
                          className={`text-[11px] px-2.5 py-0.5 rounded-full font-medium border ${
                            item.stockStatus === 'IN_STOCK'
                              ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                              : item.stockStatus === 'LOW_STOCK'
                              ? 'bg-amber-500/15 text-amber-400 border-amber-500/30'
                              : 'bg-rose-500/15 text-rose-400 border-rose-500/30'
                          }`}
                        >
                          {item.stockStatus === 'IN_STOCK' && (isEn ? 'In Stock' : 'موجود')}
                          {item.stockStatus === 'LOW_STOCK' && (isEn ? 'Low Stock' : 'محدود')}
                          {item.stockStatus === 'OUT_OF_STOCK' && (isEn ? 'Out of Stock' : 'ناموجود')}
                          {item.stockStatus === 'ON_BACKORDER' && (isEn ? 'Backorder' : 'پیش‌خرید')}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            type="button"
                            onClick={() => openEditModal(item)}
                            className="px-2.5 py-1 rounded-lg bg-surface-elevated hover:bg-primary/20 text-primary border border-primary/30 font-medium cursor-pointer"
                          >
                            ✏️ {isEn ? 'Edit' : 'ویرایش'}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(item)}
                            className="px-2.5 py-1 rounded-lg bg-surface-elevated hover:bg-red-500/20 text-red-400 border border-red-500/30 cursor-pointer"
                            title={isEn ? 'Delete product' : 'حذف محصول'}
                          >
                            🗑️
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Dialog */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#181A20] border border-primary/30 rounded-2xl w-full max-w-xl p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <h2 className="text-base font-bold text-foreground">
                {editingProduct
                  ? (isEn ? 'Edit Product' : 'ویرایش اطلاعات محصول')
                  : (isEn ? 'Add New Product' : 'افزودن محصول جدید به پت‌شاپ')}
              </h2>
              <button
                onClick={() => setModalOpen(false)}
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

            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-foreground/80 mb-1">
                  {isEn ? 'Category' : 'دسته‌بندی محصول'}
                </label>
                <select
                  value={categoryId}
                  onChange={(e) => setCategoryId(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl bg-surface-elevated border border-border text-xs text-foreground focus:border-primary outline-none"
                >
                  {categories.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {isEn ? (cat.nameEn || cat.nameFa) : cat.nameFa}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-foreground/80 mb-1">
                    {isEn ? 'Name (Persian) *' : 'نام محصول (فارسی) *'}
                  </label>
                  <input
                    type="text"
                    required
                    value={nameFa}
                    onChange={(e) => setNameFa(e.target.value)}
                    placeholder="مثال: غذای خشک سگ بالغ نژاد کوچک رویال کنین"
                    className="w-full px-3.5 py-2 rounded-xl bg-surface-elevated border border-border text-xs text-foreground focus:border-primary outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-foreground/80 mb-1">
                    {isEn ? 'Name (English)' : 'نام محصول (انگلیسی)'}
                  </label>
                  <input
                    type="text"
                    value={nameEn}
                    onChange={(e) => setNameEn(e.target.value)}
                    placeholder="e.g. Royal Canin Mini Adult Dry Food"
                    className="w-full px-3.5 py-2 rounded-xl bg-surface-elevated border border-border text-xs text-foreground focus:border-primary outline-none dir-ltr"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-foreground/80 mb-1">
                    {isEn ? 'Price in Tomans *' : 'قیمت به تومان *'}
                  </label>
                  <input
                    type="number"
                    required
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    placeholder="1250000"
                    className="w-full px-3.5 py-2 rounded-xl bg-surface-elevated border border-border text-xs text-foreground focus:border-primary outline-none font-mono dir-ltr"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-foreground/80 mb-1">
                    {isEn ? 'Stock Status' : 'وضعیت موجودی انبار'}
                  </label>
                  <select
                    value={stockStatus}
                    onChange={(e) => setStockStatus(e.target.value as StockStatus)}
                    className="w-full px-3.5 py-2 rounded-xl bg-surface-elevated border border-border text-xs text-foreground focus:border-primary outline-none"
                  >
                    <option value="IN_STOCK">{isEn ? 'In Stock' : 'موجود در انبار'}</option>
                    <option value="LOW_STOCK">{isEn ? 'Low Stock' : 'موجودی رو به اتمام'}</option>
                    <option value="OUT_OF_STOCK">{isEn ? 'Out of Stock' : 'ناموجود'}</option>
                    <option value="ON_BACKORDER">{isEn ? 'Backorder' : 'قابل پیش‌خرید'}</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-foreground/80 mb-1">
                  {isEn ? 'Short Description (Persian)' : 'توضیحات کوتاه محصول (فارسی)'}
                </label>
                <textarea
                  rows={2}
                  value={shortDescFa}
                  onChange={(e) => setShortDescFa(e.target.value)}
                  placeholder="مشخصات کلیدی و خواص تغذیه‌ای یا کاربردی..."
                  className="w-full px-3.5 py-2 rounded-xl bg-surface-elevated border border-border text-xs text-foreground focus:border-primary outline-none"
                />
              </div>

              <div className="flex items-center gap-2 pt-2">
                <input
                  type="checkbox"
                  id="prodActiveCheck"
                  checked={isActive}
                  onChange={(e) => setIsActive(e.target.checked)}
                  className="rounded border-border text-primary focus:ring-primary w-4 h-4 cursor-pointer"
                />
                <label htmlFor="prodActiveCheck" className="text-xs text-foreground cursor-pointer select-none">
                  {isEn ? 'Active & visible in online store' : 'فعال و قابل مشاهده در فروشگاه'}
                </label>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-border">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-border text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  {isEn ? 'Cancel' : 'انصراف'}
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="px-5 py-2 rounded-xl bg-primary text-charcoal-950 font-bold text-xs hover:opacity-90 active:scale-[0.99] transition-all shadow-gold disabled:opacity-50 cursor-pointer"
                >
                  {isPending ? (isEn ? 'Saving...' : 'در حال ذخیره...') : (isEn ? 'Save Product' : 'ذخیره محصول')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
