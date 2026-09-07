'use client'

import React, { useState, useTransition } from 'react'
import {
  createProductAction,
  updateProductAction,
  deleteProductAction,
  createCategoryAction,
  updateCategoryAction,
  deleteCategoryAction,
} from '@/app/actions/products'
import { StockStatus } from '@prisma/client'

export interface ProductCategoryItem {
  id: string
  nameFa: string
  nameEn: string | null
  slugFa?: string
  slugEn?: string | null
  descriptionFa?: string | null
  descriptionEn?: string | null
  sortOrder?: number
  _count?: {
    products: number
  }
}

export interface ProductItem {
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
  category: {
    id: string
    nameFa: string
    nameEn: string | null
    slugFa?: string
  } | null
}

interface Props {
  products: ProductItem[]
  categories: ProductCategoryItem[]
  isEn: boolean
}

export function ProductsManager({ products, categories, isEn }: Props) {
  const [isPending, startTransition] = useTransition()
  const [activeTab, setActiveTab] = useState<'products' | 'categories'>('products')

  // Notification state
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const showMessage = (type: 'success' | 'error', text: string) => {
    setMessage({ type, text })
    setTimeout(() => setMessage(null), 5000)
  }

  // Filters
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>('ALL')
  const [searchQuery, setSearchQuery] = useState('')

  // Product Modal State
  const [productModalOpen, setProductModalOpen] = useState(false)
  const [editingProduct, setEditingProduct] = useState<ProductItem | null>(null)
  const [pCategoryId, setPCategoryId] = useState(categories[0]?.id || '')
  const [pNameFa, setPNameFa] = useState('')
  const [pNameEn, setPNameEn] = useState('')
  const [pPrice, setPPrice] = useState('')
  const [pStockStatus, setPStockStatus] = useState<StockStatus>('IN_STOCK')
  const [pShortDescFa, setPShortDescFa] = useState('')
  const [pShortDescEn, setPShortDescEn] = useState('')
  const [pIsActive, setPIsActive] = useState(true)

  // Category Modal State
  const [catModalOpen, setCatModalOpen] = useState(false)
  const [editingCat, setEditingCat] = useState<ProductCategoryItem | null>(null)
  const [cNameFa, setCNameFa] = useState('')
  const [cNameEn, setCNameEn] = useState('')
  const [cDescFa, setCDescFa] = useState('')
  const [cDescEn, setCDescEn] = useState('')
  const [cSortOrder, setCSortOrder] = useState('0')

  // Product Actions
  const openAddProductModal = (defaultCatId?: string) => {
    setEditingProduct(null)
    setPCategoryId(defaultCatId || (selectedCategoryFilter !== 'ALL' ? selectedCategoryFilter : categories[0]?.id || ''))
    setPNameFa('')
    setPNameEn('')
    setPPrice('')
    setPStockStatus('IN_STOCK')
    setPShortDescFa('')
    setPShortDescEn('')
    setPIsActive(true)
    setProductModalOpen(true)
  }

  const openEditProductModal = (p: ProductItem) => {
    setEditingProduct(p)
    setPCategoryId(p.categoryId)
    setPNameFa(p.nameFa)
    setPNameEn(p.nameEn || '')
    setPPrice(p.price.toString())
    setPStockStatus(p.stockStatus)
    setPShortDescFa(p.shortDescFa || '')
    setPShortDescEn(p.shortDescEn || '')
    setPIsActive(p.isActive)
    setProductModalOpen(true)
  }

  const handleSaveProduct = (e: React.FormEvent) => {
    e.preventDefault()
    const formData = new FormData()
    formData.append('categoryId', pCategoryId)
    formData.append('nameFa', pNameFa)
    formData.append('nameEn', pNameEn)
    formData.append('price', pPrice)
    formData.append('stockStatus', pStockStatus)
    formData.append('shortDescFa', pShortDescFa)
    formData.append('shortDescEn', pShortDescEn)
    formData.append('isActive', pIsActive ? 'true' : 'false')

    startTransition(async () => {
      let res
      if (editingProduct) {
        res = await updateProductAction(editingProduct.id, formData)
      } else {
        res = await createProductAction(formData)
      }
      if (res.error) {
        showMessage('error', res.error)
      } else {
        showMessage('success', res.message || (isEn ? 'Saved successfully' : 'عملیات با موفقیت انجام شد'))
        setProductModalOpen(false)
      }
    })
  }

  const handleDeleteProduct = (id: string, name: string) => {
    if (!confirm(isEn ? `Are you sure you want to delete "${name}"?` : `آیا از حذف محصول «${name}» اطمینان دارید؟`)) return
    startTransition(async () => {
      const res = await deleteProductAction(id)
      if (res.error) {
        showMessage('error', res.error)
      } else {
        showMessage('success', res.message || (isEn ? 'Deleted successfully' : 'محصول حذف گردید'))
      }
    })
  }

  // Category Actions
  const openAddCategoryModal = () => {
    setEditingCat(null)
    setCNameFa('')
    setCNameEn('')
    setCDescFa('')
    setCDescEn('')
    setCSortOrder((categories.length + 1).toString())
    setCatModalOpen(true)
  }

  const openEditCategoryModal = (cat: ProductCategoryItem) => {
    setEditingCat(cat)
    setCNameFa(cat.nameFa)
    setCNameEn(cat.nameEn || '')
    setCDescFa(cat.descriptionFa || '')
    setCDescEn(cat.descriptionEn || '')
    setCSortOrder(cat.sortOrder?.toString() || '0')
    setCatModalOpen(true)
  }

  const handleSaveCategory = (e: React.FormEvent) => {
    e.preventDefault()
    const formData = new FormData()
    formData.append('nameFa', cNameFa)
    formData.append('nameEn', cNameEn)
    formData.append('descriptionFa', cDescFa)
    formData.append('descriptionEn', cDescEn)
    formData.append('sortOrder', cSortOrder)
    formData.append('isActive', 'true')

    startTransition(async () => {
      let res
      if (editingCat) {
        res = await updateCategoryAction(editingCat.id, formData)
      } else {
        res = await createCategoryAction(formData)
      }
      if (res.error) {
        showMessage('error', res.error)
      } else {
        showMessage('success', res.message || (isEn ? 'Category saved' : 'دسته‌بندی با موفقیت ذخیره شد'))
        setCatModalOpen(false)
      }
    })
  }

  const handleDeleteCategory = (cat: ProductCategoryItem) => {
    if (!confirm(isEn ? `Delete category "${cat.nameFa}"?` : `آیا از حذف دسته‌بندی «${cat.nameFa}» اطمینان دارید؟`)) return
    startTransition(async () => {
      const res = await deleteCategoryAction(cat.id)
      if (res.error) {
        showMessage('error', res.error)
      } else {
        showMessage('success', res.message || (isEn ? 'Category deleted' : 'دسته‌بندی حذف شد'))
        if (selectedCategoryFilter === cat.id) {
          setSelectedCategoryFilter('ALL')
        }
      }
    })
  }

  // Filtered products
  const filteredProducts = products.filter((p) => {
    const matchesCat = selectedCategoryFilter === 'ALL' || p.categoryId === selectedCategoryFilter
    const q = searchQuery.toLowerCase().trim()
    const matchesSearch =
      !q ||
      p.nameFa.toLowerCase().includes(q) ||
      (p.nameEn && p.nameEn.toLowerCase().includes(q)) ||
      (p.category && p.category.nameFa.toLowerCase().includes(q)) ||
      (p.shortDescFa && p.shortDescFa.toLowerCase().includes(q))
    return matchesCat && matchesSearch
  })

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Notifications */}
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

      {/* Header & Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-border">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2.5">
            <span>🛍️</span>
            <span>{isEn ? 'Pet Shop & Boutique Management' : 'مدیریت پت‌شاپ و بوتیک لوکس'}</span>
          </h1>
          <p className="text-xs text-muted-foreground mt-1">
            {isEn
              ? `${products.length} Products across ${categories.length} Defined Market Categories`
              : `${products.length} محصول در ${categories.length} دسته‌بندی تخصصی بازار`}
          </p>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center gap-2 p-1 rounded-xl bg-surface border border-border">
          <button
            type="button"
            onClick={() => setActiveTab('products')}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
              activeTab === 'products'
                ? 'bg-primary text-charcoal-950 shadow-gold'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <span>📦</span>
            <span>{isEn ? 'Products' : 'محصولات پت‌شاپ'}</span>
            <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-black/20 font-mono">
              {products.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('categories')}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
              activeTab === 'categories'
                ? 'bg-primary text-charcoal-950 shadow-gold'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <span>🏷️</span>
            <span>{isEn ? 'Categories & Related Products' : 'دسته‌بندی‌ها و محصولات مرتبط'}</span>
            <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-black/20 font-mono">
              {categories.length}
            </span>
          </button>
        </div>
      </div>

      {/* ═════════════════════════════════════════════════════════════ */}
      {/* TAB 1: PRODUCTS LIST & FILTERING */}
      {/* ═════════════════════════════════════════════════════════════ */}
      {activeTab === 'products' && (
        <div className="space-y-4">
          {/* Action & Filter Bar */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-surface p-4 rounded-2xl border border-border">
            <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
              {/* Category Filter */}
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground font-semibold">
                  {isEn ? 'Category:' : 'دسته‌بندی:'}
                </span>
                <select
                  value={selectedCategoryFilter}
                  onChange={(e) => setSelectedCategoryFilter(e.target.value)}
                  className="px-3 py-1.5 rounded-xl bg-surface-elevated border border-border text-xs text-foreground outline-none focus:border-primary font-medium"
                >
                  <option value="ALL">
                    {isEn ? `All Categories (${categories.length})` : `همه دسته‌ها (${categories.length} دسته)`}
                  </option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nameFa} ({c._count?.products || 0})
                    </option>
                  ))}
                </select>
              </div>

              {/* Search */}
              <div className="relative flex-1 sm:w-64">
                <input
                  type="text"
                  placeholder={isEn ? 'Search products...' : 'جستجوی نام محصول، برند...'}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-xl bg-surface-elevated border border-border text-xs text-foreground outline-none focus:border-primary"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute end-2 top-1.5 text-xs text-muted-foreground hover:text-foreground"
                  >
                    ✕
                  </button>
                )}
              </div>
            </div>

            {/* Add Product Button */}
            <button
              type="button"
              onClick={() => openAddProductModal()}
              className="w-full sm:w-auto px-4 py-2 rounded-xl bg-gradient-gold text-charcoal-950 font-bold text-xs hover:opacity-90 transition-all shadow-gold flex items-center justify-center gap-2 cursor-pointer"
            >
              <span>+</span>
              <span>{isEn ? 'New Product' : 'افزودن محصول جدید'}</span>
            </button>
          </div>

          {/* Active filter alert badge if filtered */}
          {selectedCategoryFilter !== 'ALL' && (
            <div className="flex items-center justify-between p-3 bg-primary/10 border border-primary/30 rounded-xl text-xs text-primary">
              <span className="font-semibold">
                {isEn ? 'Filtering by Category:' : 'نمایش محصولات مرتبط با دسته‌بندی:'}{' '}
                {categories.find((c) => c.id === selectedCategoryFilter)?.nameFa} ({filteredProducts.length} محصول)
              </span>
              <button
                type="button"
                onClick={() => setSelectedCategoryFilter('ALL')}
                className="underline hover:opacity-80 font-bold"
              >
                {isEn ? 'Show All' : 'نمایش همه محصولات'}
              </button>
            </div>
          )}

          {/* Products Table */}
          <div className="bg-surface border border-border rounded-2xl overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-start">
                <thead className="bg-surface-elevated text-muted-foreground uppercase text-[10px] tracking-wider border-b border-border">
                  <tr>
                    <th className="p-3.5 text-start">{isEn ? 'Product Name' : 'نام محصول'}</th>
                    <th className="p-3.5 text-start">{isEn ? 'Category' : 'دسته‌بندی'}</th>
                    <th className="p-3.5 text-start">{isEn ? 'Price' : 'قیمت'}</th>
                    <th className="p-3.5 text-center">{isEn ? 'Status' : 'وضعیت انبار'}</th>
                    <th className="p-3.5 text-center">{isEn ? 'Actions' : 'عملیات'}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filteredProducts.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="p-8 text-center text-muted-foreground">
                        {isEn ? 'No products found matching criteria.' : 'هیچ محصولی با این مشخصات یافت نشد.'}
                      </td>
                    </tr>
                  ) : (
                    filteredProducts.map((p) => (
                      <tr key={p.id} className="hover:bg-surface-elevated/40 transition-colors">
                        <td className="p-3.5">
                          <p className="font-bold text-foreground">{p.nameFa}</p>
                          {p.nameEn && (
                            <p className="text-[10px] text-muted-foreground font-mono mt-0.5" dir="ltr">
                              {p.nameEn}
                            </p>
                          )}
                          {p.shortDescFa && (
                            <p className="text-[10px] text-muted-foreground line-clamp-1 mt-0.5">
                              {p.shortDescFa}
                            </p>
                          )}
                        </td>
                        <td className="p-3.5">
                          <button
                            type="button"
                            onClick={() => setSelectedCategoryFilter(p.categoryId)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-primary/10 hover:bg-primary/25 border border-primary/20 text-primary text-[11px] font-semibold transition-colors cursor-pointer"
                            title={isEn ? 'Filter by this category' : 'فیلتر بر اساس این دسته‌بندی'}
                          >
                            <span>🏷️</span>
                            <span>{p.category?.nameFa || 'نامشخص'}</span>
                          </button>
                        </td>
                        <td className="p-3.5 font-semibold text-foreground whitespace-nowrap">
                          {p.price.toLocaleString(isEn ? 'en-US' : 'fa-IR')}{' '}
                          <span className="text-[10px] text-muted-foreground font-normal">
                            {isEn ? 'Tomans' : 'تومان'}
                          </span>
                        </td>
                        <td className="p-3.5 text-center whitespace-nowrap">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              p.stockStatus === 'IN_STOCK'
                                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                                : p.stockStatus === 'LOW_STOCK'
                                ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                                : 'bg-red-500/10 text-red-400 border border-red-500/30'
                            }`}
                          >
                            {p.stockStatus === 'IN_STOCK'
                              ? isEn ? 'In Stock' : 'موجود در انبار'
                              : p.stockStatus === 'LOW_STOCK'
                              ? isEn ? 'Low Stock' : 'محدود'
                              : isEn ? 'Out of Stock' : 'ناموجود'}
                          </span>
                        </td>
                        <td className="p-3.5 text-center whitespace-nowrap">
                          <div className="flex items-center justify-center gap-2">
                            <button
                              type="button"
                              onClick={() => openEditProductModal(p)}
                              className="px-2.5 py-1 rounded-lg bg-surface-elevated hover:bg-primary/20 text-foreground hover:text-primary text-[11px] font-medium border border-border transition-colors cursor-pointer"
                            >
                              {isEn ? 'Edit' : 'ویرایش'}
                            </button>
                            <button
                              type="button"
                              disabled={isPending}
                              onClick={() => handleDeleteProduct(p.id, p.nameFa)}
                              className="px-2.5 py-1 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 text-[11px] font-medium border border-red-500/20 transition-colors cursor-pointer"
                            >
                              {isEn ? 'Delete' : 'حذف'}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ═════════════════════════════════════════════════════════════ */}
      {/* TAB 2: CATEGORIES & RELATED PRODUCTS DEFINITIONS */}
      {/* ═════════════════════════════════════════════════════════════ */}
      {activeTab === 'categories' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-surface p-4 rounded-2xl border border-border">
            <div>
              <h2 className="text-sm font-bold text-foreground flex items-center gap-2">
                <span>🏷️</span>
                <span>{isEn ? 'Defined Product Categories' : 'دسته‌بندی‌های تعریف‌شده پت‌شاپ'}</span>
              </h2>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                {isEn
                  ? 'Define new categories or click any category to inspect related products.'
                  : 'امکان تعریف دسته‌بندی جدید، ویرایش و مشاهده کلیه محصولات مرتبط با هر دسته.'}
              </p>
            </div>

            <button
              type="button"
              onClick={openAddCategoryModal}
              className="px-4 py-2 rounded-xl bg-gradient-gold text-charcoal-950 font-bold text-xs hover:opacity-90 transition-all shadow-gold flex items-center gap-1.5 cursor-pointer"
            >
              <span>+</span>
              <span>{isEn ? 'New Category' : 'تعریف دسته‌بندی جدید'}</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {categories.map((cat, idx) => {
              const productCount = cat._count?.products ?? 0
              return (
                <div
                  key={cat.id}
                  className="bg-surface border border-border hover:border-primary/40 rounded-2xl p-5 flex flex-col justify-between shadow-sm transition-all group"
                >
                  <div>
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="flex items-center gap-2">
                        <span className="w-6 h-6 rounded-full bg-primary/10 text-primary border border-primary/20 text-xs font-bold flex items-center justify-center font-mono">
                          {idx + 1}
                        </span>
                        <h3 className="text-sm font-bold text-foreground">
                          {cat.nameFa}
                        </h3>
                      </div>

                      <span className="px-2 py-0.5 rounded-full bg-primary/15 text-primary border border-primary/25 text-[11px] font-bold font-mono">
                        {productCount} {isEn ? 'products' : 'محصول'}
                      </span>
                    </div>

                    {cat.nameEn && (
                      <p className="text-[11px] text-muted-foreground font-mono mb-2" dir="ltr">
                        {cat.nameEn}
                      </p>
                    )}

                    {cat.descriptionFa && (
                      <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2 mb-4">
                        {cat.descriptionFa}
                      </p>
                    )}
                  </div>

                  <div className="pt-3 border-t border-border flex flex-col gap-2">
                    {/* View Related Products Button */}
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedCategoryFilter(cat.id)
                        setActiveTab('products')
                      }}
                      className="w-full px-3 py-1.5 rounded-xl bg-primary/10 hover:bg-primary text-primary hover:text-charcoal-950 font-bold text-xs border border-primary/30 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <span>🔍</span>
                      <span>{isEn ? `View ${productCount} Related Products` : `مشاهده ${productCount} محصول مرتبط`}</span>
                    </button>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => openAddProductModal(cat.id)}
                        className="flex-1 px-2.5 py-1.5 rounded-lg bg-surface-elevated hover:bg-surface-hover text-foreground text-[11px] font-medium border border-border transition-colors text-center"
                      >
                        + {isEn ? 'Add Product' : 'افزودن محصول به این دسته'}
                      </button>

                      <button
                        type="button"
                        onClick={() => openEditCategoryModal(cat)}
                        className="px-2.5 py-1.5 rounded-lg bg-surface-elevated hover:bg-primary/20 text-foreground hover:text-primary text-[11px] font-medium border border-border transition-colors"
                        title={isEn ? 'Edit Category' : 'ویرایش دسته‌بندی'}
                      >
                        ✏️
                      </button>

                      <button
                        type="button"
                        onClick={() => handleDeleteCategory(cat)}
                        className="px-2.5 py-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 text-[11px] font-medium border border-red-500/20 transition-colors"
                        title={isEn ? 'Delete Category' : 'حذف دسته‌بندی'}
                      >
                        🗑️
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ═════════════════════════════════════════════════════════════ */}
      {/* MODAL 1: ADD / EDIT PRODUCT */}
      {/* ═════════════════════════════════════════════════════════════ */}
      {productModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-surface border border-primary/30 rounded-2xl w-full max-w-xl p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <h3 className="text-base font-bold text-foreground flex items-center gap-2">
                <span>📦</span>
                <span>{editingProduct ? (isEn ? 'Edit Product' : 'ویرایش محصول') : (isEn ? 'New Product' : 'ثبت محصول جدید')}</span>
              </h3>
              <button
                type="button"
                onClick={() => setProductModalOpen(false)}
                className="text-muted-foreground hover:text-foreground text-sm"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveProduct} className="space-y-4">
              {/* Category (Mandatory) */}
              <div>
                <label className="block text-xs font-bold text-foreground mb-1">
                  {isEn ? 'Product Category *' : 'دسته‌بندی محصول *'}
                </label>
                <select
                  required
                  value={pCategoryId}
                  onChange={(e) => setPCategoryId(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-surface-elevated border border-border text-xs text-foreground outline-none focus:border-primary font-medium"
                >
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nameFa} {c.nameEn ? `(${c.nameEn})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              {/* Name Fa & En */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-foreground mb-1">
                    {isEn ? 'Name (Persian) *' : 'نام فارسی محصول *'}
                  </label>
                  <input
                    type="text"
                    required
                    value={pNameFa}
                    onChange={(e) => setPNameFa(e.target.value)}
                    placeholder="مثال: غذای خشک گربه ایندور ۲ کیلوگرم"
                    className="w-full px-3 py-2 rounded-xl bg-surface-elevated border border-border text-xs text-foreground outline-none focus:border-primary"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-foreground mb-1">
                    {isEn ? 'Name (English)' : 'نام انگلیسی محصول'}
                  </label>
                  <input
                    type="text"
                    value={pNameEn}
                    onChange={(e) => setPNameEn(e.target.value)}
                    placeholder="e.g. Royal Canin Indoor 2kg"
                    className="w-full px-3 py-2 rounded-xl bg-surface-elevated border border-border text-xs text-foreground outline-none focus:border-primary"
                    dir="ltr"
                  />
                </div>
              </div>

              {/* Price & Stock */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-foreground mb-1">
                    {isEn ? 'Price (Tomans) *' : 'قیمت محصول (تومان) *'}
                  </label>
                  <input
                    type="number"
                    required
                    min="0"
                    step="1000"
                    value={pPrice}
                    onChange={(e) => setPPrice(e.target.value)}
                    placeholder="مثال: ۲۴۵۰۰۰۰"
                    className="w-full px-3 py-2 rounded-xl bg-surface-elevated border border-border text-xs text-foreground outline-none focus:border-primary font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-foreground mb-1">
                    {isEn ? 'Stock Status' : 'وضعیت موجودی در انبار'}
                  </label>
                  <select
                    value={pStockStatus}
                    onChange={(e) => setPStockStatus(e.target.value as StockStatus)}
                    className="w-full px-3 py-2 rounded-xl bg-surface-elevated border border-border text-xs text-foreground outline-none focus:border-primary"
                  >
                    <option value="IN_STOCK">{isEn ? 'In Stock (Available)' : 'موجود در انبار'}</option>
                    <option value="LOW_STOCK">{isEn ? 'Low Stock (Urgent)' : 'تعداد محدود'}</option>
                    <option value="OUT_OF_STOCK">{isEn ? 'Out of Stock' : 'اتمام موجودی'}</option>
                    <option value="ON_BACKORDER">{isEn ? 'On Backorder' : 'پیش‌سفارش'}</option>
                  </select>
                </div>
              </div>

              {/* Descriptions */}
              <div>
                <label className="block text-xs font-bold text-foreground mb-1">
                  {isEn ? 'Short Description (Persian)' : 'توضیحات کوتاه (فارسی)'}
                </label>
                <textarea
                  rows={2}
                  value={pShortDescFa}
                  onChange={(e) => setPShortDescFa(e.target.value)}
                  placeholder="ویژگی‌های برجسته محصول..."
                  className="w-full px-3 py-2 rounded-xl bg-surface-elevated border border-border text-xs text-foreground outline-none focus:border-primary"
                />
              </div>

              {/* Active Toggle */}
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="pActive"
                  checked={pIsActive}
                  onChange={(e) => setPIsActive(e.target.checked)}
                  className="rounded text-primary focus:ring-primary h-4 w-4 bg-surface-elevated border-border cursor-pointer"
                />
                <label htmlFor="pActive" className="text-xs text-foreground font-semibold cursor-pointer">
                  {isEn ? 'Active & Visible in Shop Catalog' : 'محصول فعال و قابل مشاهده در ویترین پت‌شاپ'}
                </label>
              </div>

              {/* Modal Buttons */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-border">
                <button
                  type="button"
                  onClick={() => setProductModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-medium text-muted-foreground hover:text-foreground"
                >
                  {isEn ? 'Cancel' : 'انصراف'}
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="px-5 py-2 rounded-xl bg-gradient-gold text-charcoal-950 font-bold text-xs hover:opacity-90 transition-all shadow-gold cursor-pointer disabled:opacity-50"
                >
                  {isPending ? (isEn ? 'Saving...' : 'در حال ثبت...') : (isEn ? 'Save Product' : 'ذخیره محصول')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ═════════════════════════════════════════════════════════════ */}
      {/* MODAL 2: ADD / EDIT CATEGORY */}
      {/* ═════════════════════════════════════════════════════════════ */}
      {catModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-surface border border-primary/30 rounded-2xl w-full max-w-lg p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <h3 className="text-base font-bold text-foreground flex items-center gap-2">
                <span>🏷️</span>
                <span>{editingCat ? (isEn ? 'Edit Category' : 'ویرایش دسته‌بندی') : (isEn ? 'New Category' : 'تعریف دسته‌بندی جدید')}</span>
              </h3>
              <button
                type="button"
                onClick={() => setCatModalOpen(false)}
                className="text-muted-foreground hover:text-foreground text-sm"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveCategory} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-foreground mb-1">
                    {isEn ? 'Category Name (Persian) *' : 'نام فارسی دسته‌بندی *'}
                  </label>
                  <input
                    type="text"
                    required
                    value={cNameFa}
                    onChange={(e) => setCNameFa(e.target.value)}
                    placeholder="مثال: غذای خشک درمانی"
                    className="w-full px-3 py-2 rounded-xl bg-surface-elevated border border-border text-xs text-foreground outline-none focus:border-primary"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-foreground mb-1">
                    {isEn ? 'Category Name (English)' : 'نام انگلیسی دسته‌بندی'}
                  </label>
                  <input
                    type="text"
                    value={cNameEn}
                    onChange={(e) => setCNameEn(e.target.value)}
                    placeholder="e.g. Veterinary Diets"
                    className="w-full px-3 py-2 rounded-xl bg-surface-elevated border border-border text-xs text-foreground outline-none focus:border-primary"
                    dir="ltr"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-foreground mb-1">
                  {isEn ? 'Description (Persian)' : 'توضیحات دسته‌بندی (فارسی)'}
                </label>
                <textarea
                  rows={2}
                  value={cDescFa}
                  onChange={(e) => setCDescFa(e.target.value)}
                  placeholder="توضیح مختصر درباره محصولات این دسته‌بندی..."
                  className="w-full px-3 py-2 rounded-xl bg-surface-elevated border border-border text-xs text-foreground outline-none focus:border-primary"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-foreground mb-1">
                  {isEn ? 'Display Sort Order' : 'ترتیب نمایش (اولویت)'}
                </label>
                <input
                  type="number"
                  value={cSortOrder}
                  onChange={(e) => setCSortOrder(e.target.value)}
                  className="w-24 px-3 py-2 rounded-xl bg-surface-elevated border border-border text-xs text-foreground outline-none focus:border-primary font-mono"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-border">
                <button
                  type="button"
                  onClick={() => setCatModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-medium text-muted-foreground hover:text-foreground"
                >
                  {isEn ? 'Cancel' : 'انصراف'}
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="px-5 py-2 rounded-xl bg-gradient-gold text-charcoal-950 font-bold text-xs hover:opacity-90 transition-all shadow-gold cursor-pointer disabled:opacity-50"
                >
                  {isPending ? (isEn ? 'Saving...' : 'در حال ثبت...') : (isEn ? 'Save Category' : 'ذخیره دسته‌بندی')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
