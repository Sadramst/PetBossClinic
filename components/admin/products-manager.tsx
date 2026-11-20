'use client'
/* eslint-disable @next/next/no-img-element */

import React, { useEffect, useRef, useState, useTransition } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import {
  createProductAction,
  updateProductAction,
  deleteProductAction,
  toggleProductActiveAction,
  createCategoryAction,
  updateCategoryAction,
  deleteCategoryAction,
  toggleCategoryActiveAction,
} from '@/app/actions/products'
import { StockStatus } from '@prisma/client'
import { ProductsList } from '@/components/admin/products/products-list'
import type { ExpiryState } from '@/lib/shop/expiry'

export interface ProductCategoryItem {
  id: string
  nameFa: string
  nameEn: string | null
  slugFa?: string
  slugEn?: string | null
  descriptionFa?: string | null
  descriptionEn?: string | null
  sortOrder?: number
  imageId?: string | null
  isActive?: boolean
  _count?: {
    products: number
  }
}

export interface ProductItem {
  id: string
  categoryId: string
  sku?: string | null
  nameFa: string
  nameEn: string | null
  slugFa: string
  slugEn: string | null
  price: number
  stockStatus: StockStatus
  shortDescFa: string | null
  shortDescEn: string | null
  isActive: boolean
  isFeatured?: boolean
  tracksExpiry?: boolean
  ogImageId?: string | null
  images?: Array<{
    id: string
    imageId: string
    isPrimary: boolean
    sortOrder: number
  }>
  category: {
    id: string
    nameFa: string
    nameEn: string | null
    slugFa?: string
  } | null
}

export interface ProductListFilters {
  q: string
  cat: string
  status: string
  page: number
  size: number
}

export interface ProductListStats {
  total: number
  active: number
  inactive: number
  inStock: number
  outOfStock: number
  featured: number
}

interface Props {
  /** Only the current page, already filtered and sorted by the server. */
  products: ProductItem[]
  categories: ProductCategoryItem[]
  /** Nearest sellable expiry per product id (perishables only). */
  expiry?: Record<string, { state: ExpiryState; date: string | null; daysLeft: number | null }>
  canAdmin?: boolean
  /** Number of products matching the filters (all pages). */
  filteredTotal: number
  stats: ProductListStats
  filters: ProductListFilters
}

export type ProductStatusFilter = 'ALL' | 'ACTIVE' | 'INACTIVE' | 'IN_STOCK' | 'LOW_STOCK' | 'OUT_OF_STOCK' | 'FEATURED'

export function ProductsManager({ products, categories, filteredTotal, stats, filters, expiry = {}, canAdmin = false }: Props) {
  const [isPending, startTransition] = useTransition()
  const [activeTab, setActiveTab] = useState<'products' | 'categories'>('products')

  // Notification state
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const showMessage = (type: 'success' | 'error', text: string) => {
    setMessage({ type, text })
    setTimeout(() => setMessage(null), 5000)
  }

  // Filters & pagination live in the URL: the server filters, sorts and slices, so the browser only
  // ever receives one page of products (700+ products used to be sent on every visit).
  const router = useRouter()
  const pathname = usePathname()
  const [, startNavigation] = useTransition()
  const navigate = (patch: Partial<ProductListFilters>) => {
    const next = { ...filters, ...patch }
    const qs = new URLSearchParams()
    if (next.q) qs.set('q', next.q)
    if (next.cat && next.cat !== 'ALL') qs.set('cat', next.cat)
    if (next.status && next.status !== 'ALL') qs.set('status', next.status)
    if (next.page > 1) qs.set('page', String(next.page))
    if (next.size !== 50) qs.set('size', String(next.size))
    const query = qs.toString()
    startNavigation(() => router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false }))
  }
  const selectedCategoryFilter = filters.cat
  const setSelectedCategoryFilter = (cat: string) => navigate({ cat, page: 1 })
  const setStatusFilter = (status: ProductStatusFilter) => navigate({ status, page: 1 })
  const setCurrentPage = (update: number | ((p: number) => number)) =>
    navigate({ page: typeof update === 'function' ? update(filters.page) : update })

  // Search is typed locally and sent to the server after a short pause.
  const [searchQuery, setSearchInput] = useState(filters.q)
  const lastSentQuery = useRef(filters.q)
  useEffect(() => {
    if (searchQuery.trim() === lastSentQuery.current) return
    const t = setTimeout(() => {
      lastSentQuery.current = searchQuery.trim()
      navigate({ q: searchQuery.trim(), page: 1 })
    }, 350)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQuery])
  const setSearchQuery = setSearchInput

  // Product Modal State
  const [productModalOpen, setProductModalOpen] = useState(false)
  const [editingProduct, setEditingProduct] = useState<ProductItem | null>(null)
  const [pCategoryId, setPCategoryId] = useState(categories[0]?.id || '')
  const [pNameFa, setPNameFa] = useState('')
  const [pNameEn, setPNameEn] = useState('')
  const [pSku, setPSku] = useState('')
  const [pPrice, setPPrice] = useState('')
  const [pStockStatus, setPStockStatus] = useState<StockStatus>('IN_STOCK')
  const [pShortDescFa, setPShortDescFa] = useState('')
  const [pShortDescEn, setPShortDescEn] = useState('')
  const [pIsActive, setPIsActive] = useState(true)
  const [pIsFeatured, setPIsFeatured] = useState(false)
  const [pImageFile, setPImageFile] = useState<File | null>(null)
  const [pImageUrl, setPImageUrl] = useState('')
  const [pRemoveImage, setPRemoveImage] = useState(false)

  // Category Modal State
  const [catModalOpen, setCatModalOpen] = useState(false)
  const [editingCat, setEditingCat] = useState<ProductCategoryItem | null>(null)
  const [cNameFa, setCNameFa] = useState('')
  const [cNameEn, setCNameEn] = useState('')
  const [cDescFa, setCDescFa] = useState('')
  const [cDescEn, setCDescEn] = useState('')
  const [cSortOrder, setCSortOrder] = useState('0')
  const [cImageFile, setCImageFile] = useState<File | null>(null)
  const [cImageUrl, setCImageUrl] = useState('')
  const [cRemoveImage, setCRemoveImage] = useState(false)

  // Product Actions
  const openAddProductModal = (defaultCatId?: string) => {
    setEditingProduct(null)
    setPCategoryId(defaultCatId || (selectedCategoryFilter !== 'ALL' ? selectedCategoryFilter : categories[0]?.id || ''))
    setPNameFa('')
    setPNameEn('')
    setPSku('')
    setPPrice('')
    setPStockStatus('IN_STOCK')
    setPShortDescFa('')
    setPShortDescEn('')
    setPIsActive(true)
    setPIsFeatured(false)
    setPImageFile(null)
    setPImageUrl('')
    setPRemoveImage(false)
    setProductModalOpen(true)
  }

  const openEditProductModal = (p: ProductItem) => {
    setEditingProduct(p)
    setPCategoryId(p.categoryId)
    setPNameFa(p.nameFa)
    setPNameEn(p.nameEn || '')
    setPSku(p.sku || '')
    setPPrice(p.price.toString())
    setPStockStatus(p.stockStatus)
    setPShortDescFa(p.shortDescFa || '')
    setPShortDescEn(p.shortDescEn || '')
    setPIsActive(p.isActive)
    setPIsFeatured(Boolean(p.isFeatured))
    setPImageFile(null)
    setPImageUrl(p.images?.[0]?.imageId || p.ogImageId || '')
    setPRemoveImage(false)
    setProductModalOpen(true)
  }

  const handleSaveProduct = (e: React.FormEvent) => {
    e.preventDefault()
    const formData = new FormData()
    formData.append('categoryId', pCategoryId)
    formData.append('nameFa', pNameFa)
    formData.append('nameEn', pNameEn)
    formData.append('sku', pSku)
    formData.append('price', pPrice)
    formData.append('stockStatus', pStockStatus)
    formData.append('shortDescFa', pShortDescFa)
    formData.append('shortDescEn', pShortDescEn)
    formData.append('isActive', pIsActive ? 'true' : 'false')
    formData.append('isFeatured', pIsFeatured ? 'true' : 'false')

    if (pRemoveImage) {
      formData.append('removeImage', 'true')
    } else if (pImageFile) {
      formData.append('imageFile', pImageFile)
    } else if (pImageUrl) {
      formData.append('imageUrl', pImageUrl)
    }

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
        showMessage('success', res.message || ('عملیات با موفقیت انجام شد'))
        setProductModalOpen(false)
      }
    })
  }

  const handleDeleteProduct = (id: string, name: string) => {
    if (!confirm(`آیا از حذف محصول «${name}» اطمینان دارید؟`)) return
    startTransition(async () => {
      const res = await deleteProductAction(id)
      if (res.error) {
        showMessage('error', res.error)
      } else {
        showMessage('success', res.message || ('محصول حذف گردید'))
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
    setCImageFile(null)
    setCImageUrl('')
    setCRemoveImage(false)
    setCatModalOpen(true)
  }

  const openEditCategoryModal = (cat: ProductCategoryItem) => {
    setEditingCat(cat)
    setCNameFa(cat.nameFa)
    setCNameEn(cat.nameEn || '')
    setCDescFa(cat.descriptionFa || '')
    setCDescEn(cat.descriptionEn || '')
    setCSortOrder(cat.sortOrder?.toString() || '0')
    setCImageFile(null)
    setCImageUrl(cat.imageId || '')
    setCRemoveImage(false)
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

    if (cRemoveImage) {
      formData.append('removeImage', 'true')
    } else if (cImageFile) {
      formData.append('imageFile', cImageFile)
    } else if (cImageUrl) {
      formData.append('imageUrl', cImageUrl)
    }

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
        showMessage('success', res.message || ('دسته‌بندی با موفقیت ذخیره شد'))
        setCatModalOpen(false)
      }
    })
  }

  const handleDeleteCategory = (cat: ProductCategoryItem) => {
    if (!confirm(`آیا از حذف دسته‌بندی «${cat.nameFa}» اطمینان دارید؟`)) return
    startTransition(async () => {
      const res = await deleteCategoryAction(cat.id)
      if (res.error) {
        showMessage('error', res.error)
      } else {
        showMessage('success', res.message || ('دسته‌بندی حذف شد'))
        if (selectedCategoryFilter === cat.id) {
          setSelectedCategoryFilter('ALL')
        }
      }
    })
  }


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
            <span>مدیریت پت‌شاپ و بوتیک لوکس</span>
          </h1>
          <p className="text-xs text-muted-foreground mt-1">
            {`${stats.total} محصول همگام‌شده در ${categories.length} دسته‌بندی تخصصی بازار`}
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
            <span>محصولات پت‌شاپ</span>
            <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-black/20 font-mono">
              {stats.total}
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
            <span>دسته‌بندی‌ها و محصولات مرتبط</span>
            <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-black/20 font-mono">
              {categories.length}
            </span>
          </button>
        </div>
      </div>

      {/* Products tab: kit-based list (server filters, inline edit, bulk actions) */}
      {activeTab === 'products' && (
        <ProductsList
          rows={products.map((p) => ({
            id: p.id,
            nameFa: p.nameFa,
            sku: p.sku ?? null,
            price: p.price,
            stockStatus: p.stockStatus,
            isActive: p.isActive,
            isFeatured: Boolean(p.isFeatured),
            tracksExpiry: Boolean(p.tracksExpiry),
            categoryName: p.category?.nameFa ?? null,
            imageId: p.images?.[0]?.imageId ?? p.ogImageId ?? null,
            expiry: expiry[p.id] ?? null,
          }))}
          categories={categories.map((c) => ({ id: c.id, nameFa: c.nameFa }))}
          total={stats.total}
          filteredTotal={filteredTotal}
          stats={stats}
          canAdmin={canAdmin}
          onAdd={() => openAddProductModal()}
          onEdit={(id) => {
            const target = products.find((x) => x.id === id)
            if (target) openEditProductModal(target)
          }}
          onDelete={(id, name) => handleDeleteProduct(id, name)}
          onToggleActive={(id, next) => {
            startTransition(async () => {
              const res = await toggleProductActiveAction(id, next)
              if (res.error) showMessage('error', res.error)
              else showMessage('success', res.message || 'ذخیره شد.')
            })
          }}
        />
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
                <span>دسته‌بندی‌های تعریف‌شده پت‌شاپ</span>
              </h2>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                امکان تعریف دسته‌بندی جدید، ویرایش و مشاهده کلیه محصولات مرتبط با هر دسته.
              </p>
            </div>

            <button
              type="button"
              onClick={openAddCategoryModal}
              className="px-4 py-2 rounded-xl bg-gradient-gold text-charcoal-950 font-bold text-xs hover:opacity-90 transition-all shadow-gold flex items-center gap-1.5 cursor-pointer"
            >
              <span>+</span>
              <span>تعریف دسته‌بندی جدید</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {categories.map((cat, idx) => {
              const productCount = cat._count?.products ?? 0
              return (
                <div
                  key={cat.id}
                  className="bg-surface border border-border hover:border-primary/40 rounded-2xl overflow-hidden flex flex-col justify-between shadow-sm transition-all group"
                >
                  {cat.imageId ? (
                    <div className="relative h-28 w-full overflow-hidden bg-surface-elevated border-b border-border">
                      <img
                        src={cat.imageId}
                        alt={cat.nameFa}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-charcoal-950/80 via-transparent to-transparent" />
                    </div>
                  ) : null}
                  <div className="p-5 flex flex-col justify-between flex-1">
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
                        {productCount} محصول
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
                        setStatusFilter('ALL')
                        setSearchQuery('')
                        setCurrentPage(1)
                        setActiveTab('products')
                      }}
                      className="w-full px-3 py-1.5 rounded-xl bg-primary/10 hover:bg-primary text-primary hover:text-charcoal-950 font-bold text-xs border border-primary/30 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <span>🔍</span>
                      <span>{`مشاهده ${productCount} محصول مرتبط`}</span>
                    </button>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => openAddProductModal(cat.id)}
                        className="flex-1 px-2.5 py-1.5 rounded-lg bg-surface-elevated hover:bg-surface-hover text-foreground text-[11px] font-medium border border-border transition-colors text-center"
                      >
                        + افزودن محصول به این دسته
                      </button>

                      <button
                        type="button"
                        disabled={isPending}
                        onClick={() => {
                          startTransition(async () => {
                            const res = await toggleCategoryActiveAction(cat.id, cat.isActive === false ? true : false)
                            if (res.error) showMessage('error', res.error)
                            else showMessage('success', res.message || 'به‌روز شد')
                          })
                        }}
                        className={`px-2 py-1.5 rounded-lg text-[10px] font-bold border transition-colors cursor-pointer ${
                          cat.isActive !== false
                            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20'
                            : 'bg-red-500/10 text-red-400 border-red-500/30 hover:bg-red-500/20'
                        }`}
                        title={cat.isActive !== false ? ('دسته‌بندی در سایت فعال است') : ('دسته‌بندی در سایت غیرفعال است')}
                      >
                        {cat.isActive !== false ? '✓' : '✕'}
                      </button>

                      <button
                        type="button"
                        onClick={() => openEditCategoryModal(cat)}
                        className="px-2.5 py-1.5 rounded-lg bg-surface-elevated hover:bg-primary/20 text-foreground hover:text-primary text-[11px] font-medium border border-border transition-colors"
                        title="ویرایش دسته‌بندی"
                      >
                        ✏️
                      </button>

                      <button
                        type="button"
                        onClick={() => handleDeleteCategory(cat)}
                        className="px-2.5 py-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 text-[11px] font-medium border border-red-500/20 transition-colors"
                        title="حذف دسته‌بندی"
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
                <span>{editingProduct ? ('ویرایش محصول') : ('ثبت محصول جدید')}</span>
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
              {/* Category & SKU */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-foreground mb-1">
                    دسته‌بندی محصول *
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
                <div>
                  <label className="block text-xs font-bold text-foreground mb-1">
                    شناسه کالا (SKU)
                  </label>
                  <input
                    type="text"
                    value={pSku}
                    onChange={(e) => setPSku(e.target.value)}
                    placeholder="مثال: PB-CAT-001"
                    className="w-full px-3 py-2 rounded-xl bg-surface-elevated border border-border text-xs text-foreground outline-none focus:border-primary font-mono"
                    dir="ltr"
                  />
                </div>
              </div>

              {/* Name Fa & En */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-foreground mb-1">
                    نام فارسی محصول *
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
                    نام انگلیسی محصول
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
                    قیمت محصول (تومان) *
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
                    وضعیت موجودی در انبار
                  </label>
                  <select
                    value={pStockStatus}
                    onChange={(e) => setPStockStatus(e.target.value as StockStatus)}
                    className="w-full px-3 py-2 rounded-xl bg-surface-elevated border border-border text-xs text-foreground outline-none focus:border-primary"
                  >
                    <option value="IN_STOCK">موجود در انبار</option>
                    <option value="LOW_STOCK">تعداد محدود</option>
                    <option value="OUT_OF_STOCK">اتمام موجودی</option>
                    <option value="ON_BACKORDER">پیش‌سفارش</option>
                  </select>
                </div>
              </div>

              {/* Descriptions */}
              <div>
                <label className="block text-xs font-bold text-foreground mb-1">
                  توضیحات کوتاه (فارسی)
                </label>
                <textarea
                  rows={2}
                  value={pShortDescFa}
                  onChange={(e) => setPShortDescFa(e.target.value)}
                  placeholder="ویژگی‌های برجسته محصول..."
                  className="w-full px-3 py-2 rounded-xl bg-surface-elevated border border-border text-xs text-foreground outline-none focus:border-primary"
                />
              </div>

              {/* Product Image Management */}
              <div className="p-4 rounded-xl bg-surface-elevated border border-border space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-foreground flex items-center gap-1.5">
                    <span>🖼️</span>
                    <span>تصویر محصول</span>
                  </label>
                  {(pImageFile || (pImageUrl && !pRemoveImage)) && (
                    <button
                      type="button"
                      onClick={() => {
                        setPImageFile(null)
                        setPImageUrl('')
                        setPRemoveImage(true)
                      }}
                      className="text-[11px] text-red-400 hover:text-red-300 font-semibold cursor-pointer"
                    >
                      ✕ حذف تصویر
                    </button>
                  )}
                </div>

                {/* Current / Selected Image Preview */}
                {!pRemoveImage && (pImageFile || pImageUrl) ? (
                  <div className="flex items-center gap-3 p-2 bg-surface rounded-xl border border-border">
                    <img
                      src={pImageFile ? URL.createObjectURL(pImageFile) : pImageUrl}
                      alt="Product Preview"
                      className="w-16 h-16 rounded-lg object-cover border border-border shrink-0 bg-surface-elevated"
                    />
                    <div className="text-xs space-y-1 overflow-hidden min-w-0">
                      <p className="font-semibold text-foreground truncate">
                        {pImageFile ? pImageFile.name : pImageUrl}
                      </p>
                      <p className="text-[10px] text-muted-foreground">
                        {pImageFile ? `${(pImageFile.size / 1024).toFixed(1)} KB` : ('آدرس تصویر')}
                      </p>
                    </div>
                  </div>
                ) : pRemoveImage ? (
                  <div className="p-2 text-center text-xs text-amber-400 bg-amber-500/10 rounded-xl border border-amber-500/20">
                    تصویر این محصول حذف خواهد شد. پس از ثبت نهایی اعمال می‌شود.
                  </div>
                ) : null}

                {/* Upload File or URL Input */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  <div>
                    <label className="block text-[11px] text-muted-foreground mb-1">
                      آپلود فایل جدید:
                    </label>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => {
                        const file = e.target.files?.[0] || null
                        if (file) {
                          setPImageFile(file)
                          setPRemoveImage(false)
                        }
                      }}
                      className="w-full text-xs text-muted-foreground file:mr-2 file:py-1 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-primary/20 file:text-primary hover:file:bg-primary/30 cursor-pointer"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-muted-foreground mb-1">
                      یا آدرس تصویر:
                    </label>
                    <input
                      type="text"
                      value={pImageUrl}
                      onChange={(e) => {
                        setPImageUrl(e.target.value)
                        setPRemoveImage(false)
                      }}
                      placeholder="/images/products/... or https://..."
                      className="w-full px-3 py-1.5 rounded-lg bg-surface border border-border text-xs text-foreground outline-none focus:border-primary font-mono"
                      dir="ltr"
                    />
                  </div>
                </div>
              </div>

              {/* Active & Featured Toggles */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="pActive"
                    checked={pIsActive}
                    onChange={(e) => setPIsActive(e.target.checked)}
                    className="rounded text-primary focus:ring-primary h-4 w-4 bg-surface-elevated border-border cursor-pointer"
                  />
                  <label htmlFor="pActive" className="text-xs text-foreground font-semibold cursor-pointer">
                    محصول فعال در پت‌شاپ
                  </label>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="pFeatured"
                    checked={pIsFeatured}
                    onChange={(e) => setPIsFeatured(e.target.checked)}
                    className="rounded text-primary focus:ring-primary h-4 w-4 bg-surface-elevated border-border cursor-pointer"
                  />
                  <label htmlFor="pFeatured" className="text-xs text-amber-400 font-semibold cursor-pointer">
                    ⭐ نمایش در ویترین ویژه صفحه اصلی
                  </label>
                </div>
              </div>

              {/* Modal Buttons */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-border">
                <button
                  type="button"
                  onClick={() => setProductModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-medium text-muted-foreground hover:text-foreground"
                >
                  انصراف
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="px-5 py-2 rounded-xl bg-gradient-gold text-charcoal-950 font-bold text-xs hover:opacity-90 transition-all shadow-gold cursor-pointer disabled:opacity-50"
                >
                  {isPending ? ('در حال ثبت...') : ('ذخیره محصول')}
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
                <span>{editingCat ? ('ویرایش دسته‌بندی') : ('تعریف دسته‌بندی جدید')}</span>
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
                    نام فارسی دسته‌بندی *
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
                    نام انگلیسی دسته‌بندی
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
                  توضیحات دسته‌بندی (فارسی)
                </label>
                <textarea
                  rows={2}
                  value={cDescFa}
                  onChange={(e) => setCDescFa(e.target.value)}
                  placeholder="توضیح مختصر درباره محصولات این دسته‌بندی..."
                  className="w-full px-3 py-2 rounded-xl bg-surface-elevated border border-border text-xs text-foreground outline-none focus:border-primary"
                />
              </div>

              {/* Category Image Management */}
              <div className="p-4 rounded-xl bg-surface-elevated border border-border space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-foreground flex items-center gap-1.5">
                    <span>🖼️</span>
                    <span>تصویر یا بنر دسته‌بندی</span>
                  </label>
                  {(cImageFile || (cImageUrl && !cRemoveImage)) && (
                    <button
                      type="button"
                      onClick={() => {
                        setCImageFile(null)
                        setCImageUrl('')
                        setCRemoveImage(true)
                      }}
                      className="text-[11px] text-red-400 hover:text-red-300 font-semibold cursor-pointer"
                    >
                      ✕ حذف تصویر
                    </button>
                  )}
                </div>

                {/* Current / Selected Image Preview */}
                {!cRemoveImage && (cImageFile || cImageUrl) ? (
                  <div className="flex items-center gap-3 p-2 bg-surface rounded-xl border border-border">
                    <img
                      src={cImageFile ? URL.createObjectURL(cImageFile) : cImageUrl}
                      alt="Category Preview"
                      className="w-16 h-16 rounded-lg object-cover border border-border shrink-0 bg-surface-elevated"
                    />
                    <div className="text-xs space-y-1 overflow-hidden min-w-0">
                      <p className="font-semibold text-foreground truncate">
                        {cImageFile ? cImageFile.name : cImageUrl}
                      </p>
                      <p className="text-[10px] text-muted-foreground">
                        {cImageFile ? `${(cImageFile.size / 1024).toFixed(1)} KB` : ('آدرس تصویر')}
                      </p>
                    </div>
                  </div>
                ) : cRemoveImage ? (
                  <div className="p-2 text-center text-xs text-amber-400 bg-amber-500/10 rounded-xl border border-amber-500/20">
                    تصویر این دسته‌بندی حذف خواهد شد. پس از ذخیره اعمال می‌شود.
                  </div>
                ) : null}

                {/* Upload File or URL Input */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  <div>
                    <label className="block text-[11px] text-muted-foreground mb-1">
                      آپلود فایل جدید:
                    </label>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => {
                        const file = e.target.files?.[0] || null
                        if (file) {
                          setCImageFile(file)
                          setCRemoveImage(false)
                        }
                      }}
                      className="w-full text-xs text-muted-foreground file:mr-2 file:py-1 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-primary/20 file:text-primary hover:file:bg-primary/30 cursor-pointer"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-muted-foreground mb-1">
                      یا آدرس تصویر:
                    </label>
                    <input
                      type="text"
                      value={cImageUrl}
                      onChange={(e) => {
                        setCImageUrl(e.target.value)
                        setCRemoveImage(false)
                      }}
                      placeholder="/images/categories/... or https://..."
                      className="w-full px-3 py-1.5 rounded-lg bg-surface border border-border text-xs text-foreground outline-none focus:border-primary font-mono"
                      dir="ltr"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-foreground mb-1">
                  ترتیب نمایش (اولویت)
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
                  انصراف
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="px-5 py-2 rounded-xl bg-gradient-gold text-charcoal-950 font-bold text-xs hover:opacity-90 transition-all shadow-gold cursor-pointer disabled:opacity-50"
                >
                  {isPending ? ('در حال ثبت...') : ('ذخیره دسته‌بندی')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
