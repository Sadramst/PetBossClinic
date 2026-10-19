'use client'
/* eslint-disable @next/next/no-img-element */

import React, { useState, useTransition } from 'react'
import {
  createProductAction,
  updateProductAction,
  deleteProductAction,
  toggleProductFeaturedAction,
  toggleProductActiveAction,
  createCategoryAction,
  updateCategoryAction,
  deleteCategoryAction,
  toggleCategoryActiveAction,
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

interface Props {
  products: ProductItem[]
  categories: ProductCategoryItem[]
  isEn: boolean
}

export type ProductStatusFilter = 'ALL' | 'ACTIVE' | 'INACTIVE' | 'IN_STOCK' | 'LOW_STOCK' | 'OUT_OF_STOCK' | 'FEATURED'

export function ProductsManager({ products, categories, isEn }: Props) {
  const [isPending, startTransition] = useTransition()
  const [activeTab, setActiveTab] = useState<'products' | 'categories'>('products')

  // Notification state
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const showMessage = (type: 'success' | 'error', text: string) => {
    setMessage({ type, text })
    setTimeout(() => setMessage(null), 5000)
  }

  // Filters & Pagination
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>('ALL')
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<ProductStatusFilter>('ALL')
  const [currentPage, setCurrentPage] = useState<number>(1)
  const [pageSize, setPageSize] = useState<number>(50)

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

  // Filtered products with SKU, category, name, and status filter
  const filteredProducts = products.filter((p) => {
    const matchesCat = selectedCategoryFilter === 'ALL' || p.categoryId === selectedCategoryFilter
    const q = searchQuery.toLowerCase().trim()
    const matchesSearch =
      !q ||
      p.nameFa.toLowerCase().includes(q) ||
      (p.nameEn && p.nameEn.toLowerCase().includes(q)) ||
      (p.sku && p.sku.toLowerCase().includes(q)) ||
      (p.category && p.category.nameFa.toLowerCase().includes(q)) ||
      (p.shortDescFa && p.shortDescFa.toLowerCase().includes(q))

    let matchesStatus = true
    if (statusFilter === 'ACTIVE') matchesStatus = p.isActive
    else if (statusFilter === 'INACTIVE') matchesStatus = !p.isActive
    else if (statusFilter === 'IN_STOCK') matchesStatus = p.stockStatus === 'IN_STOCK'
    else if (statusFilter === 'LOW_STOCK') matchesStatus = p.stockStatus === 'LOW_STOCK'
    else if (statusFilter === 'OUT_OF_STOCK') matchesStatus = p.stockStatus === 'OUT_OF_STOCK'
    else if (statusFilter === 'FEATURED') matchesStatus = Boolean(p.isFeatured)

    return matchesCat && matchesSearch && matchesStatus
  })

  // Pagination calculation
  const totalPages = pageSize === -1 ? 1 : Math.max(1, Math.ceil(filteredProducts.length / pageSize))
  const paginatedProducts = pageSize === -1
    ? filteredProducts
    : filteredProducts.slice((currentPage - 1) * pageSize, currentPage * pageSize)

  const activeCount = products.filter((p) => p.isActive).length
  const inactiveCount = products.filter((p) => !p.isActive).length
  const inStockCount = products.filter((p) => p.stockStatus === 'IN_STOCK').length
  const outOfStockCount = products.filter((p) => p.stockStatus === 'OUT_OF_STOCK').length
  const featuredCount = products.filter((p) => p.isFeatured).length

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
              ? `${products.length} Products synchronized across ${categories.length} Defined Market Categories`
              : `${products.length} محصول همگام‌شده در ${categories.length} دسته‌بندی تخصصی بازار`}
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
          {/* Inventory Sync Status Overview Pills */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
            <button
              type="button"
              onClick={() => { setStatusFilter('ALL'); setSelectedCategoryFilter('ALL'); setCurrentPage(1); }}
              className={`p-3 rounded-xl border text-start transition-all cursor-pointer ${
                statusFilter === 'ALL' && selectedCategoryFilter === 'ALL'
                  ? 'bg-primary/15 border-primary shadow-gold text-foreground'
                  : 'bg-surface border-border text-muted-foreground hover:text-foreground'
              }`}
            >
              <div className="text-[10px] font-bold uppercase tracking-wider">{isEn ? 'Total Products' : 'کل موجودی انبار'}</div>
              <div className="text-xl font-black text-foreground mt-0.5">{products.length}</div>
              <div className="text-[10px] text-emerald-400 font-semibold mt-0.5">100% {isEn ? 'Synced' : 'همگام در پنل'}</div>
            </button>

            <button
              type="button"
              onClick={() => { setStatusFilter('ACTIVE'); setCurrentPage(1); }}
              className={`p-3 rounded-xl border text-start transition-all cursor-pointer ${
                statusFilter === 'ACTIVE'
                  ? 'bg-emerald-500/15 border-emerald-500 text-foreground'
                  : 'bg-surface border-border text-muted-foreground hover:text-foreground'
              }`}
            >
              <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-400">{isEn ? 'Active on Site' : 'فعال در فروشگاه'}</div>
              <div className="text-xl font-black text-emerald-400 mt-0.5">{activeCount}</div>
              <div className="text-[10px] text-muted-foreground mt-0.5">{isEn ? 'Visible to customers' : 'قابل مشاهده کاربران'}</div>
            </button>

            <button
              type="button"
              onClick={() => { setStatusFilter('INACTIVE'); setCurrentPage(1); }}
              className={`p-3 rounded-xl border text-start transition-all cursor-pointer ${
                statusFilter === 'INACTIVE'
                  ? 'bg-red-500/15 border-red-500 text-foreground'
                  : 'bg-surface border-border text-muted-foreground hover:text-foreground'
              }`}
            >
              <div className="text-[10px] font-bold uppercase tracking-wider text-red-400">{isEn ? 'Hidden / Inactive' : 'مخفی و غیرفعال'}</div>
              <div className="text-xl font-black text-red-400 mt-0.5">{inactiveCount}</div>
              <div className="text-[10px] text-muted-foreground mt-0.5">{isEn ? 'Hidden from shop' : 'مخفی از ویترین'}</div>
            </button>

            <button
              type="button"
              onClick={() => { setStatusFilter('IN_STOCK'); setCurrentPage(1); }}
              className={`p-3 rounded-xl border text-start transition-all cursor-pointer ${
                statusFilter === 'IN_STOCK'
                  ? 'bg-emerald-500/15 border-emerald-500 text-foreground'
                  : 'bg-surface border-border text-muted-foreground hover:text-foreground'
              }`}
            >
              <div className="text-[10px] font-bold uppercase tracking-wider text-foreground">{isEn ? 'In Stock' : 'موجود'}</div>
              <div className="text-xl font-black text-foreground mt-0.5">{inStockCount}</div>
              <div className="text-[10px] text-muted-foreground mt-0.5">{isEn ? 'Ready for order' : 'آماده سفارش'}</div>
            </button>

            <button
              type="button"
              onClick={() => { setStatusFilter('OUT_OF_STOCK'); setCurrentPage(1); }}
              className={`p-3 rounded-xl border text-start transition-all cursor-pointer ${
                statusFilter === 'OUT_OF_STOCK'
                  ? 'bg-amber-500/15 border-amber-500 text-foreground'
                  : 'bg-surface border-border text-muted-foreground hover:text-foreground'
              }`}
            >
              <div className="text-[10px] font-bold uppercase tracking-wider text-amber-400">{isEn ? 'Out of Stock' : 'ناموجود'}</div>
              <div className="text-xl font-black text-amber-400 mt-0.5">{outOfStockCount}</div>
              <div className="text-[10px] text-muted-foreground mt-0.5">{isEn ? 'Needs restock' : 'نیاز به تامین'}</div>
            </button>

            <button
              type="button"
              onClick={() => { setStatusFilter('FEATURED'); setCurrentPage(1); }}
              className={`p-3 rounded-xl border text-start transition-all cursor-pointer ${
                statusFilter === 'FEATURED'
                  ? 'bg-amber-500/15 border-amber-500 text-foreground'
                  : 'bg-surface border-border text-muted-foreground hover:text-foreground'
              }`}
            >
              <div className="text-[10px] font-bold uppercase tracking-wider text-amber-300">⭐ {isEn ? 'Featured' : 'ویژه صفحه اول'}</div>
              <div className="text-xl font-black text-amber-300 mt-0.5">{featuredCount}</div>
              <div className="text-[10px] text-muted-foreground mt-0.5">{isEn ? 'Homepage showcase' : 'ویترین صفحه اول'}</div>
            </button>
          </div>

          {/* Action & Filter Bar */}
          <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3 bg-surface p-4 rounded-2xl border border-border">
            <div className="flex flex-wrap items-center gap-3">
              {/* Category Filter */}
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground font-semibold">
                  {isEn ? 'Category:' : 'دسته‌بندی:'}
                </span>
                <select
                  value={selectedCategoryFilter}
                  onChange={(e) => {
                    setSelectedCategoryFilter(e.target.value)
                    setCurrentPage(1)
                  }}
                  className="px-3 py-1.5 rounded-xl bg-surface-elevated border border-border text-xs text-foreground outline-none focus:border-primary font-medium"
                >
                  <option value="ALL">
                    {isEn ? `All Categories (${categories.length})` : `همه دسته‌ها (${categories.length} دسته)`}
                  </option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nameFa} ({c._count?.products || 0}) {c.isActive === false ? ' [غیرفعال]' : ''}
                    </option>
                  ))}
                </select>
              </div>

              {/* Status Filter */}
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground font-semibold">
                  {isEn ? 'Status:' : 'وضعیت:'}
                </span>
                <select
                  value={statusFilter}
                  onChange={(e) => {
                    setStatusFilter(e.target.value as ProductStatusFilter)
                    setCurrentPage(1)
                  }}
                  className="px-3 py-1.5 rounded-xl bg-surface-elevated border border-border text-xs text-foreground outline-none focus:border-primary font-medium"
                >
                  <option value="ALL">{isEn ? 'All Statuses' : 'همه وضعیت‌ها'}</option>
                  <option value="ACTIVE">{isEn ? 'Active on Site' : '✓ فقط فعال در سایت'}</option>
                  <option value="INACTIVE">{isEn ? 'Hidden / Inactive' : '✕ فقط مخفی / غیرفعال'}</option>
                  <option value="IN_STOCK">{isEn ? 'In Stock' : 'موجود در انبار'}</option>
                  <option value="LOW_STOCK">{isEn ? 'Low Stock' : 'موجودی محدود'}</option>
                  <option value="OUT_OF_STOCK">{isEn ? 'Out of Stock' : 'ناموجود'}</option>
                  <option value="FEATURED">{isEn ? 'Featured on Homepage' : '⭐ ویژه صفحه اصلی'}</option>
                </select>
              </div>

              {/* Search */}
              <div className="relative flex-1 min-w-[200px] sm:w-64">
                <input
                  type="text"
                  placeholder={isEn ? 'Search name, SKU barcode, brand...' : 'جستجوی نام، بارکد SKU، مشخصات...'}
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value)
                    setCurrentPage(1)
                  }}
                  className="w-full px-3 py-1.5 rounded-xl bg-surface-elevated border border-border text-xs text-foreground outline-none focus:border-primary"
                />
                {searchQuery && (
                  <button
                    onClick={() => {
                      setSearchQuery('')
                      setCurrentPage(1)
                    }}
                    className="absolute end-2 top-1.5 text-xs text-muted-foreground hover:text-foreground cursor-pointer"
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
              className="w-full sm:w-auto px-4 py-2 rounded-xl bg-gradient-gold text-charcoal-950 font-bold text-xs hover:opacity-90 transition-all shadow-gold flex items-center justify-center gap-2 cursor-pointer shrink-0"
            >
              <span>+</span>
              <span>{isEn ? 'New Product' : 'افزودن محصول جدید'}</span>
            </button>
          </div>

          {/* Active filter alert badge if filtered */}
          {(selectedCategoryFilter !== 'ALL' || statusFilter !== 'ALL' || searchQuery) && (
            <div className="flex items-center justify-between p-3 bg-primary/10 border border-primary/30 rounded-xl text-xs text-primary">
              <span className="font-semibold">
                {isEn ? 'Active Filters:' : 'فیلتر فعال:'}{' '}
                {selectedCategoryFilter !== 'ALL' ? `[دسته‌بندی: ${categories.find((c) => c.id === selectedCategoryFilter)?.nameFa}] ` : ''}
                {statusFilter !== 'ALL' ? `[وضعیت: ${statusFilter}] ` : ''}
                {searchQuery ? `[جستجو: "${searchQuery}"] ` : ''}
                ({filteredProducts.length} محصول یافت شد)
              </span>
              <button
                type="button"
                onClick={() => {
                  setSelectedCategoryFilter('ALL')
                  setStatusFilter('ALL')
                  setSearchQuery('')
                  setCurrentPage(1)
                }}
                className="underline hover:opacity-80 font-bold cursor-pointer"
              >
                {isEn ? 'Reset All Filters' : 'نمایش همه محصولات'}
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
                    <th className="p-3.5 text-center">{isEn ? 'Stock' : 'وضعیت انبار'}</th>
                    <th className="p-3.5 text-center">{isEn ? 'Active on Site' : 'نمایش در سایت'}</th>
                    <th className="p-3.5 text-center">{isEn ? 'Featured' : 'ویژه'}</th>
                    <th className="p-3.5 text-center">{isEn ? 'Actions' : 'عملیات'}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {paginatedProducts.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="p-8 text-center text-muted-foreground">
                        {isEn ? 'No products found matching criteria.' : 'هیچ محصولی با این مشخصات یافت نشد.'}
                      </td>
                    </tr>
                  ) : (
                    paginatedProducts.map((p) => {
                      const cat = categories.find((c) => c.id === p.categoryId);
                      const catImg = cat?.imageId || '/images/categories/other.jpg';
                      const displayImg = p.images?.[0]?.imageId || p.ogImageId || catImg;

                      return (
                        <tr key={p.id} className="hover:bg-surface-elevated/40 transition-colors">
                          <td className="p-3.5">
                            <div className="flex items-center gap-3">
                            {displayImg ? (
                              <img
                                src={displayImg}
                                alt={p.nameFa}
                                onError={(e) => {
                                  const target = e.currentTarget;
                                  if (catImg && target.src !== catImg) {
                                    target.src = catImg;
                                  } else {
                                    target.src = '/images/categories/other.jpg';
                                  }
                                }}
                                className="w-11 h-11 rounded-xl object-cover border border-border shrink-0 bg-surface-elevated shadow-xs"
                              />
                            ) : (
                              <div className="w-11 h-11 rounded-xl bg-surface-elevated border border-dashed border-border flex items-center justify-center text-base shrink-0 text-muted-foreground">
                                🐾
                              </div>
                            )}
                            <div className="min-w-0">
                              <p className="font-bold text-foreground truncate">{p.nameFa}</p>
                              {p.sku && (
                                <span className="inline-block text-[10px] font-mono px-1.5 py-0.2 rounded bg-surface-elevated text-primary border border-border-gold/30 mt-0.5">
                                  {p.sku}
                                </span>
                              )}
                              {p.nameEn && (
                                <p className="text-[10px] text-muted-foreground font-mono mt-0.5 truncate" dir="ltr">
                                  {p.nameEn}
                                </p>
                              )}
                              {p.shortDescFa && (
                                <p className="text-[10px] text-muted-foreground line-clamp-1 mt-0.5">
                                  {p.shortDescFa}
                                </p>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="p-3.5">
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedCategoryFilter(p.categoryId)
                              setCurrentPage(1)
                            }}
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
                          <button
                            type="button"
                            disabled={isPending}
                            onClick={() => {
                              startTransition(async () => {
                                const res = await toggleProductActiveAction(p.id, !p.isActive)
                                if (res.error) showMessage('error', res.error)
                                else showMessage('success', res.message || 'به‌روز شد')
                              })
                            }}
                            className={`px-2.5 py-1 rounded-full text-[11px] font-bold border transition-colors cursor-pointer ${
                              p.isActive
                                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20'
                                : 'bg-red-500/10 text-red-400 border-red-500/30 hover:bg-red-500/20'
                            }`}
                            title={p.isActive ? (isEn ? 'Click to hide from website' : 'کلیک برای مخفی کردن از سایت') : (isEn ? 'Click to activate on website' : 'کلیک برای فعال و نمایش در سایت')}
                          >
                            {p.isActive ? (isEn ? '✓ Active' : '✓ فعال در سایت') : (isEn ? '✕ Hidden' : '✕ مخفی از سایت')}
                          </button>
                        </td>
                        <td className="p-3.5 text-center whitespace-nowrap">
                          <button
                            type="button"
                            disabled={isPending}
                            onClick={() => {
                              startTransition(async () => {
                                const res = await toggleProductFeaturedAction(p.id, !p.isFeatured)
                                if (res.error) showMessage('error', res.error)
                                else showMessage('success', res.message || 'به‌روز شد')
                              })
                            }}
                            className={`px-2.5 py-1 rounded-full text-[11px] font-bold border transition-colors cursor-pointer ${
                              p.isFeatured
                                ? 'bg-amber-500/10 text-amber-400 border-amber-500/30 hover:bg-amber-500/20'
                                : 'bg-surface-elevated text-muted-foreground border-border hover:text-foreground'
                            }`}
                            title={p.isFeatured ? (isEn ? 'Remove from featured' : 'حذف از محصولات ویژه صفحه اصلی') : (isEn ? 'Set as featured' : 'انتخاب به عنوان محصول ویژه صفحه اصلی')}
                          >
                            {p.isFeatured ? '⭐ ' + (isEn ? 'Featured' : 'ویژه') : '☆ ' + (isEn ? 'Standard' : 'عادی')}
                          </button>
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
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            {filteredProducts.length > 0 && (
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-4 bg-surface-elevated/40 border-t border-border text-xs">
                <div className="text-muted-foreground flex items-center gap-2">
                  <span>
                    {isEn
                      ? `Showing ${pageSize === -1 ? 1 : Math.min((currentPage - 1) * pageSize + 1, filteredProducts.length)} to ${pageSize === -1 ? filteredProducts.length : Math.min(currentPage * pageSize, filteredProducts.length)} of ${filteredProducts.length} filtered items (Total DB inventory: ${products.length} products)`
                      : `نمایش ${pageSize === -1 ? 1 : Math.min((currentPage - 1) * pageSize + 1, filteredProducts.length)} تا ${pageSize === -1 ? filteredProducts.length : Math.min(currentPage * pageSize, filteredProducts.length)} از ${filteredProducts.length} محصول (کل موجودی انبار: ${products.length} کالا)`}
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  {/* Page Size Selector */}
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <span>{isEn ? 'Per page:' : 'تعداد در صفحه:'}</span>
                    <select
                      value={pageSize}
                      onChange={(e) => {
                        setPageSize(Number(e.target.value))
                        setCurrentPage(1)
                      }}
                      className="px-2 py-1 rounded-lg bg-surface border border-border text-xs text-foreground outline-none focus:border-primary"
                    >
                      <option value={25}>25</option>
                      <option value={50}>50</option>
                      <option value={100}>100</option>
                      <option value={-1}>{isEn ? 'All' : 'همه'}</option>
                    </select>
                  </div>

                  {/* Page Switcher */}
                  {totalPages > 1 && (
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        disabled={currentPage <= 1}
                        onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                        className="px-2.5 py-1 rounded-lg border border-border bg-surface text-foreground hover:bg-surface-elevated disabled:opacity-30 disabled:pointer-events-none cursor-pointer"
                      >
                        {isEn ? 'Previous' : 'قبلی'}
                      </button>
                      <span className="px-3 py-1 font-mono font-bold text-primary">
                        {currentPage} / {totalPages}
                      </span>
                      <button
                        type="button"
                        disabled={currentPage >= totalPages}
                        onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                        className="px-2.5 py-1 rounded-lg border border-border bg-surface text-foreground hover:bg-surface-elevated disabled:opacity-30 disabled:pointer-events-none cursor-pointer"
                      >
                        {isEn ? 'Next' : 'بعدی'}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}
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
                        setStatusFilter('ALL')
                        setSearchQuery('')
                        setCurrentPage(1)
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
                        title={cat.isActive !== false ? (isEn ? 'Category active on site' : 'دسته‌بندی در سایت فعال است') : (isEn ? 'Category hidden from site' : 'دسته‌بندی در سایت غیرفعال است')}
                      >
                        {cat.isActive !== false ? '✓' : '✕'}
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
              {/* Category & SKU */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
                <div>
                  <label className="block text-xs font-bold text-foreground mb-1">
                    {isEn ? 'SKU / Inventory Code' : 'شناسه کالا (SKU)'}
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

              {/* Product Image Management */}
              <div className="p-4 rounded-xl bg-surface-elevated border border-border space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-foreground flex items-center gap-1.5">
                    <span>🖼️</span>
                    <span>{isEn ? 'Product Image' : 'تصویر محصول'}</span>
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
                      {isEn ? '✕ Remove Image' : '✕ حذف تصویر'}
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
                        {pImageFile ? `${(pImageFile.size / 1024).toFixed(1)} KB` : (isEn ? 'Image URL linked' : 'آدرس تصویر')}
                      </p>
                    </div>
                  </div>
                ) : pRemoveImage ? (
                  <div className="p-2 text-center text-xs text-amber-400 bg-amber-500/10 rounded-xl border border-amber-500/20">
                    {isEn ? 'Image marked for removal. Click Save to apply.' : 'تصویر این محصول حذف خواهد شد. پس از ثبت نهایی اعمال می‌شود.'}
                  </div>
                ) : null}

                {/* Upload File or URL Input */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  <div>
                    <label className="block text-[11px] text-muted-foreground mb-1">
                      {isEn ? 'Upload File (JPG, PNG, WEBP)' : 'آپلود فایل جدید:'}
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
                      {isEn ? 'Or Image URL / Path:' : 'یا آدرس تصویر:'}
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
                    {isEn ? 'Active & Visible in Shop Catalog' : 'محصول فعال در پت‌شاپ'}
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
                    ⭐ {isEn ? 'Featured on Homepage' : 'نمایش در ویترین ویژه صفحه اصلی'}
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

              {/* Category Image Management */}
              <div className="p-4 rounded-xl bg-surface-elevated border border-border space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-foreground flex items-center gap-1.5">
                    <span>🖼️</span>
                    <span>{isEn ? 'Category Image / Banner' : 'تصویر یا بنر دسته‌بندی'}</span>
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
                      {isEn ? '✕ Remove Image' : '✕ حذف تصویر'}
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
                        {cImageFile ? `${(cImageFile.size / 1024).toFixed(1)} KB` : (isEn ? 'Image URL linked' : 'آدرس تصویر')}
                      </p>
                    </div>
                  </div>
                ) : cRemoveImage ? (
                  <div className="p-2 text-center text-xs text-amber-400 bg-amber-500/10 rounded-xl border border-amber-500/20">
                    {isEn ? 'Image marked for removal. Click Save to apply.' : 'تصویر این دسته‌بندی حذف خواهد شد. پس از ذخیره اعمال می‌شود.'}
                  </div>
                ) : null}

                {/* Upload File or URL Input */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  <div>
                    <label className="block text-[11px] text-muted-foreground mb-1">
                      {isEn ? 'Upload File (JPG, PNG, WEBP)' : 'آپلود فایل جدید:'}
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
                      {isEn ? 'Or Image URL / Path:' : 'یا آدرس تصویر:'}
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
