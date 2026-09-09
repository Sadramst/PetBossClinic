'use client'

import { useState, useMemo } from 'react'
import Image from 'next/image'
import { useLocale } from 'next-intl'
import { Link } from '@/i18n/routing'
import { StockStatus } from '@prisma/client'

export interface ShopCategory {
  id: string
  nameFa: string
  nameEn: string | null
  slugFa: string
  slugEn: string | null
  descriptionFa?: string | null
  descriptionEn?: string | null
  sortOrder: number
  imageId?: string | null
  _count?: {
    products: number
  }
}

export interface ShopProduct {
  id: string
  categoryId: string
  sku: string | null
  nameFa: string
  nameEn: string | null
  shortDescFa: string | null
  shortDescEn: string | null
  price: number
  stockStatus: StockStatus
  isActive: boolean
  createdAt: string | Date
  ogImageId?: string | null
  images?: Array<{
    imageId: string
    isPrimary?: boolean
  }>
  category: {
    id: string
    nameFa: string
    nameEn: string | null
    slugFa: string
    imageId?: string | null
  }
}

interface ShopCatalogClientProps {
  categories: ShopCategory[]
  products: ShopProduct[]
}

export function ShopCatalogClient({ categories, products }: ShopCatalogClientProps) {
  const locale = useLocale()
  const isEn = locale === 'en'

  const [selectedCategory, setSelectedCategory] = useState<string>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [sortBy, setSortBy] = useState<'newest' | 'priceAsc' | 'priceDesc' | 'inStock'>('newest')
  const [activeModalProduct, setActiveModalProduct] = useState<ShopProduct | null>(null)
  const [copiedSku, setCopiedSku] = useState<string | null>(null)

  // Filter and sort products
  const filteredProducts = useMemo(() => {
    return products
      .filter((p) => {
        // Category Filter
        if (selectedCategory !== 'all' && p.categoryId !== selectedCategory) {
          return false
        }
        // Search Filter
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase().trim()
          const matchFa = p.nameFa.toLowerCase().includes(q)
          const matchEn = p.nameEn ? p.nameEn.toLowerCase().includes(q) : false
          const matchSku = p.sku ? p.sku.toLowerCase().includes(q) : false
          const matchDescFa = p.shortDescFa ? p.shortDescFa.toLowerCase().includes(q) : false
          const matchCatFa = p.category.nameFa.toLowerCase().includes(q)
          const matchCatEn = p.category.nameEn ? p.category.nameEn.toLowerCase().includes(q) : false

          return matchFa || matchEn || matchSku || matchDescFa || matchCatFa || matchCatEn
        }
        return true
      })
      .sort((a, b) => {
        if (sortBy === 'priceAsc') return a.price - b.price
        if (sortBy === 'priceDesc') return b.price - a.price
        if (sortBy === 'inStock') {
          if (a.stockStatus === 'IN_STOCK' && b.stockStatus !== 'IN_STOCK') return -1
          if (a.stockStatus !== 'IN_STOCK' && b.stockStatus === 'IN_STOCK') return 1
          return 0
        }
        // newest
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      })
  }, [products, selectedCategory, searchQuery, sortBy])

  // Formatted price helper
  const formatPrice = (price: number) => {
    if (isEn) {
      return `${price.toLocaleString('en-US')} Tomans`
    }
    return `${price.toLocaleString('fa-IR')} تومان`
  }

  // Copy SKU handler
  const handleCopySku = (sku: string) => {
    navigator.clipboard.writeText(sku)
    setCopiedSku(sku)
    setTimeout(() => setCopiedSku(null), 2000)
  }

  return (
    <div className="min-h-screen bg-background text-foreground pb-20">
      {/* ═════════════════════════════════════════════════════════════ */}
      {/* 1. HERO & LUXURY BOUTIQUE HEADER */}
      {/* ═════════════════════════════════════════════════════════════ */}
      <section className="relative overflow-hidden border-b border-border-gold/40 bg-surface/60 backdrop-blur-md pt-12 pb-14 sm:pt-16 sm:pb-20">
        <div className="absolute inset-0 bg-gradient-to-b from-primary/5 via-transparent to-transparent pointer-events-none" />
        <div className="container-site relative z-10 text-center max-w-4xl mx-auto px-4">
          {/* Gold Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/10 border border-primary/30 text-primary text-xs sm:text-sm font-semibold mb-6 shadow-gold">
            <span>✨</span>
            <span>
              {isEn
                ? 'Pet Boss Signature Boutique & Veterinary Pet Shop'
                : 'ویترین اختصاصی بوتیک و پت‌شاپ کلینیک پت باس'}
            </span>
          </div>

          <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-foreground mb-6 leading-tight">
            {isEn ? (
              <>
                Super-Premium Nutrition & <span className="text-gradient-gold">Luxury Accessories</span>
              </>
            ) : (
              <>
                تغذیه سوپرپرمیوم و <span className="text-gradient-gold">ملزومات لوکس حیوانات خانگی</span>
              </>
            )}
          </h1>

          <p className="text-sm sm:text-base text-muted-foreground leading-relaxed max-w-2xl mx-auto mb-8">
            {isEn
              ? 'Carefully curated European and international brands, prescription diets, and bespoke accessories. All medical nutrition is approved and supervised by Pet Boss veterinary surgeons.'
              : 'مجموعه‌ای گلچین‌شده از اصیل‌ترین برندهای تغذیه درمانی، مکمل‌های تخصصی ارتوپدی و پوست، خاک‌های آنتی‌باکتریال و ملزومات رفاهی تحت نظارت مستقیم کادر جراحی و داخلی کلینیک پت باس.'}
          </p>

          {/* Quick Metrics Bar */}
          <div className="inline-flex flex-wrap items-center justify-center gap-4 sm:gap-8 px-6 py-3 rounded-2xl bg-surface-card/80 border border-border text-xs sm:text-sm font-medium text-foreground/90 shadow-sm">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>{isEn ? `${categories.length} Specialized Categories` : `${categories.length} دسته‌بندی تخصصی`}</span>
            </div>
            <span className="text-border hidden sm:inline">•</span>
            <div className="flex items-center gap-2">
              <span>💎</span>
              <span>{isEn ? `${products.length}+ Super-Premium Items` : `${products.length}+ قلم کالای معتبر و بااصالت`}</span>
            </div>
            <span className="text-border hidden sm:inline">•</span>
            <div className="flex items-center gap-2">
              <span>🩺</span>
              <span>{isEn ? 'Veterinary Guidance Included' : 'مشاوره تغذیه دامپزشک'}</span>
            </div>
          </div>
        </div>
      </section>

      {/* ═════════════════════════════════════════════════════════════ */}
      {/* 2. SEARCH & CONTROLS TOOLBAR */}
      {/* ═════════════════════════════════════════════════════════════ */}
      <section className="sticky top-20 z-40 bg-surface/95 backdrop-blur border-b border-border/80 py-4 shadow-md">
        <div className="container-site px-4">
          <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
            {/* Search Input */}
            <div className="relative flex-1 max-w-xl">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="absolute start-3.5 top-1/2 -translate-y-1/2 text-muted-foreground"
              >
                <circle cx="11" cy="11" r="8" />
                <path d="m21 21-4.3-4.3" />
              </svg>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={
                  isEn
                    ? 'Search products, brands (Royal Canin, Pro Plan...), or SKU...'
                    : 'جستجوی محصولات، برندها (رویال کنین، پروپلان، بیفار...) یا کد کالا...'
                }
                className="w-full ps-10 pe-9 py-2.5 rounded-xl bg-surface-elevated border border-border text-xs sm:text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute end-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground text-xs cursor-pointer"
                >
                  ✕
                </button>
              )}
            </div>

            {/* Sort Dropdown & Quick Stats */}
            <div className="flex items-center gap-3 justify-between md:justify-end">
              <span className="text-xs text-muted-foreground">
                {isEn ? (
                  <>Showing <strong className="text-foreground">{filteredProducts.length}</strong> items</>
                ) : (
                  <>نمایش <strong className="text-foreground">{filteredProducts.length}</strong> محصول</>
                )}
              </span>

              <div className="flex items-center gap-2">
                <label htmlFor="shopSort" className="text-xs text-muted-foreground hidden sm:inline">
                  {isEn ? 'Sort:' : 'مرتب‌سازی:'}
                </label>
                <select
                  id="shopSort"
                  value={sortBy}
                  onChange={(e) =>
                    setSortBy(
                      e.target.value as 'newest' | 'priceAsc' | 'priceDesc' | 'inStock'
                    )
                  }
                  className="px-3 py-2 rounded-xl bg-surface-elevated border border-border text-xs text-foreground focus:border-primary focus:outline-none cursor-pointer"
                >
                  <option value="newest">{isEn ? 'Newest Arrivals' : 'جدیدترین‌ها'}</option>
                  <option value="priceAsc">{isEn ? 'Price: Low to High' : 'ارزان‌ترین'}</option>
                  <option value="priceDesc">{isEn ? 'Price: High to Low' : 'گران‌ترین'}</option>
                  <option value="inStock">{isEn ? 'In-Stock First' : 'موجود در کلینیک'}</option>
                </select>
              </div>
            </div>
          </div>

          {/* ═════════════════════════════════════════════════════════════ */}
          {/* 3. 20-CATEGORY HORIZONTAL PILLS FILTER */}
          {/* ═════════════════════════════════════════════════════════════ */}
          <div className="mt-4 pt-3 border-t border-border/50 flex items-center gap-2 overflow-x-auto pb-1 scrollbar-thin">
            {/* 'All' Button */}
            <button
              type="button"
              onClick={() => setSelectedCategory('all')}
              className={`shrink-0 px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
                selectedCategory === 'all'
                  ? 'bg-gradient-gold text-charcoal-950 shadow-gold'
                  : 'bg-surface-elevated border border-border text-foreground hover:border-primary/50'
              }`}
            >
              <span>🐾</span>
              <span>{isEn ? 'All Catalog' : 'همه محصولات'}</span>
              <span className={`px-1.5 py-0.5 rounded-full text-[10px] ${
                selectedCategory === 'all' ? 'bg-charcoal-950/20 text-charcoal-950' : 'bg-surface-card text-muted-foreground'
              }`}>
                {products.length}
              </span>
            </button>

            {/* 20 Category Pills */}
            {categories.map((cat) => {
              const isSelected = selectedCategory === cat.id
              const catName = isEn ? (cat.nameEn || cat.nameFa) : cat.nameFa
              const count = cat._count?.products ?? 0

              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setSelectedCategory(cat.id)}
                  className={`shrink-0 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all flex items-center gap-2 cursor-pointer ${
                    isSelected
                      ? 'bg-gradient-gold text-charcoal-950 shadow-gold font-bold'
                      : 'bg-surface-elevated border border-border text-foreground hover:border-primary/50'
                  }`}
                >
                  {cat.imageId ? (
                    <Image
                      src={cat.imageId}
                      alt={catName}
                      width={16}
                      height={16}
                      className="w-4 h-4 rounded-full object-cover shrink-0 border border-primary/30"
                    />
                  ) : null}
                  <span>{catName}</span>
                  <span className={`px-1.5 py-0.5 rounded-full text-[10px] ${
                    isSelected ? 'bg-charcoal-950/20 text-charcoal-950' : 'bg-surface-card text-muted-foreground'
                  }`}>
                    {count}
                  </span>
                </button>
              )
            })}
          </div>
        </div>
      </section>

      {/* ═════════════════════════════════════════════════════════════ */}
      {/* 4. PRODUCT CARDS GRID */}
      {/* ═════════════════════════════════════════════════════════════ */}
      <main className="container-site px-4 pt-8">
        {filteredProducts.length === 0 ? (
          <div className="text-center py-20 bg-surface rounded-3xl border border-border p-8 max-w-xl mx-auto my-10">
            <span className="text-4xl mb-4 block">🔍</span>
            <h3 className="text-lg font-bold text-foreground mb-2">
              {isEn ? 'No products found' : 'محصولی با این مشخصات یافت نشد'}
            </h3>
            <p className="text-xs text-muted-foreground mb-6">
              {isEn
                ? 'Try changing your search term or select another category.'
                : 'لطفاً عبارت جستجو را تغییر دهید یا دسته‌بندی دیگری را انتخاب فرمایید.'}
            </p>
            <button
              type="button"
              onClick={() => {
                setSearchQuery('')
                setSelectedCategory('all')
              }}
              className="px-5 py-2 rounded-xl bg-gradient-gold text-charcoal-950 text-xs font-bold shadow-gold cursor-pointer"
            >
              {isEn ? 'Reset All Filters' : 'نمایش تمام محصولات'}
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {filteredProducts.map((product) => {
              const pName = isEn ? (product.nameEn || product.nameFa) : product.nameFa
              const pDesc = isEn ? (product.shortDescEn || product.shortDescFa) : product.shortDescFa
              const catName = isEn ? (product.category.nameEn || product.category.nameFa) : product.category.nameFa
              const isInStock = product.stockStatus === 'IN_STOCK'
              const productImage = product.images?.[0]?.imageId || product.ogImageId

              return (
                <div
                  key={product.id}
                  className="card-luxury rounded-2xl overflow-hidden flex flex-col group border border-border hover:border-primary/60 transition-all duration-300 hover:shadow-gold"
                >
                  {/* Visual Header / Showcase Banner */}
                  <div className="relative aspect-[4/3] w-full bg-gradient-to-br from-charcoal-900 to-charcoal-950 overflow-hidden border-b border-border/50 flex items-center justify-center text-center">
                    {/* Background Pattern */}
                    <div className="absolute inset-0 opacity-10 bg-[radial-gradient(#d4af37_1px,transparent_1px)] [background-size:16px_16px]" />

                    {/* Stock Status Badge */}
                    <div className="absolute top-3 start-3 z-20">
                      {isInStock ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 backdrop-blur-sm">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                          {isEn ? 'In Stock' : 'موجود در کلینیک'}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30 backdrop-blur-sm">
                          {isEn ? 'Limited / Contact' : 'سفارشی / استعلام'}
                        </span>
                      )}
                    </div>

                    {/* SKU badge */}
                    {product.sku && (
                      <button
                        type="button"
                        onClick={() => handleCopySku(product.sku!)}
                        title={isEn ? 'Click to copy SKU' : 'برای کپی کد کالا کلیک کنید'}
                        className="absolute top-3 end-3 z-20 text-[10px] font-mono px-2 py-0.5 rounded-md bg-surface/80 text-muted-foreground border border-border hover:border-primary transition-colors cursor-pointer backdrop-blur-sm"
                      >
                        {copiedSku === product.sku ? '✓ کپی شد' : product.sku}
                      </button>
                    )}

                    {/* Product Photo or Placeholder Graphic */}
                    {productImage ? (
                      <div className="absolute inset-0 w-full h-full overflow-hidden bg-charcoal-900">
                        <Image
                          src={productImage}
                          alt={pName}
                          fill
                          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                          className="object-cover transform group-hover:scale-105 transition-transform duration-700"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-charcoal-950/70 via-transparent to-transparent pointer-events-none" />
                      </div>
                    ) : (
                      <div className="relative z-10 flex flex-col items-center justify-center transform group-hover:scale-105 transition-transform duration-500 p-6">
                        <div className="w-16 h-16 rounded-2xl bg-primary/10 border border-border-gold/50 flex items-center justify-center shadow-gold mb-3 text-2xl">
                          🐾
                        </div>
                        <span className="text-xs font-bold text-primary max-w-[200px] truncate">
                          {catName}
                        </span>
                      </div>
                    )}

                    {/* Quick View Overlay on Hover */}
                    <div className="absolute inset-0 z-10 bg-charcoal-950/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2 p-4 backdrop-blur-xs">
                      <button
                        type="button"
                        onClick={() => setActiveModalProduct(product)}
                        className="px-4 py-2 rounded-xl bg-surface-elevated border border-primary text-primary font-bold text-xs hover:bg-primary hover:text-charcoal-950 transition-all shadow-gold cursor-pointer"
                      >
                        👁️ {isEn ? 'Quick Details' : 'مشاهده جزئیات'}
                      </button>
                    </div>
                  </div>

                  {/* Card Body */}
                  <div className="p-5 flex flex-col flex-grow">
                    {/* Category Name */}
                    <span className="text-[11px] font-semibold text-primary/90 mb-1.5 block">
                      {catName}
                    </span>

                    {/* Product Name */}
                    <h3 className="text-sm font-bold text-foreground leading-snug mb-2 group-hover:text-primary transition-colors line-clamp-2">
                      {pName}
                    </h3>

                    {/* Secondary Name if available */}
                    {product.nameEn && !isEn && (
                      <p className="text-[11px] text-muted-foreground font-mono truncate mb-2" dir="ltr">
                        {product.nameEn}
                      </p>
                    )}

                    {/* Short Description */}
                    {pDesc && (
                      <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2 mb-4 flex-grow">
                        {pDesc}
                      </p>
                    )}

                    {/* Price & Actions Footer */}
                    <div className="pt-3 border-t border-border/60 mt-auto flex flex-col gap-3">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] text-muted-foreground">
                          {isEn ? 'Price' : 'قیمت:'}
                        </span>
                        <span className="text-sm font-extrabold text-foreground tracking-tight text-gradient-gold">
                          {formatPrice(product.price)}
                        </span>
                      </div>

                      {/* Dual Action Buttons */}
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => setActiveModalProduct(product)}
                          className="w-full py-2 px-2 rounded-xl bg-surface-elevated border border-border text-foreground hover:border-primary text-xs font-semibold text-center transition-colors cursor-pointer"
                        >
                          {isEn ? 'Details' : 'جزئیات'}
                        </button>

                        <a
                          href="tel:+982126429715"
                          className="w-full py-2 px-2 rounded-xl bg-gradient-gold hover:opacity-95 text-charcoal-950 text-xs font-bold text-center shadow-gold transition-all flex items-center justify-center gap-1.5"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
                          <span>{isEn ? 'Call Clinic' : 'تماس و سفارش'}</span>
                        </a>
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* ═════════════════════════════════════════════════════════════ */}
        {/* 5. VETERINARY ADVISORY & QUALITY ASSURANCE BANNER */}
        {/* ═════════════════════════════════════════════════════════════ */}
        <div className="mt-16 rounded-3xl border-2 border-border-gold/50 bg-gradient-to-r from-surface via-surface-elevated to-surface p-8 sm:p-12 shadow-gold-lg relative overflow-hidden">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-center">
            <div className="lg:col-span-2 space-y-4">
              <span className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-primary/10 border border-primary/30 text-primary text-xs font-bold">
                🩺 {isEn ? 'Direct Veterinary Supervision' : 'ضمانت اصالت و سلامت تحت نظارت دامپزشک'}
              </span>
              <h2 className="text-2xl sm:text-3xl font-bold text-foreground">
                {isEn
                  ? 'Need a prescription diet or personalized consultation?'
                  : 'نیاز به رژیم غذایی درمانی یا مشاوره تخصصی خرید دارید؟'}
              </h2>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {isEn
                  ? 'All therapeutic foods, renal and urinary diets, and joint mobility supplements sold at Pet Boss Clinic are authentic, stored under strict climate conditions, and cross-referenced with your pet’s clinical records.'
                  : 'کلیه غذاهای درمانی (رنال، یورینری، هایپوآلرژنیک)، مکمل‌های مفاصل و خمیرهای هربال با ضمانت تاریخ انقضای معتبر و نگهداری در شرایط دمایی استاندارد کلینیک به مراجعین محترم عرضه می‌گردند.'}
              </p>
            </div>

            <div className="flex flex-col sm:flex-row lg:flex-col gap-3 justify-center">
              <a
                href="tel:+982126429715"
                className="px-6 py-3.5 rounded-full bg-gradient-gold text-charcoal-950 font-bold text-xs sm:text-sm text-center shadow-gold hover:opacity-90 transition-all flex items-center justify-center gap-2"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
                <span>{isEn ? 'Call Clinic Reception (021-26429715)' : 'تماس با پذیرش کلینیک (۰۲۱-۲۶۴۲۹۷۱۵)'}</span>
              </a>

              <Link
                href="/contact"
                className="px-6 py-3.5 rounded-full bg-surface-card border border-border-gold text-foreground font-bold text-xs sm:text-sm text-center hover:border-primary transition-all flex items-center justify-center gap-2"
              >
                <span>📝</span>
                <span>{isEn ? 'Submit Online Inquiry' : 'استعلام آنلاین و مشاوره'}</span>
              </Link>
            </div>
          </div>
        </div>
      </main>

      {/* ═════════════════════════════════════════════════════════════ */}
      {/* 6. MODAL: QUICK VIEW / PRODUCT DETAILS */}
      {/* ═════════════════════════════════════════════════════════════ */}
      {activeModalProduct && (
        <div
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in"
          onClick={() => setActiveModalProduct(null)}
        >
          <div
            className="bg-surface border border-primary/40 rounded-3xl w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6 sm:p-8 shadow-2xl space-y-6 relative"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close Button */}
            <button
              type="button"
              onClick={() => setActiveModalProduct(null)}
              className="absolute top-5 end-5 w-8 h-8 rounded-full bg-surface-elevated border border-border text-muted-foreground hover:text-foreground flex items-center justify-center text-sm cursor-pointer"
            >
              ✕
            </button>

            {/* Product Image Banner if available */}
            {(activeModalProduct.images?.[0]?.imageId || activeModalProduct.ogImageId) && (
              <div className="relative w-full h-56 sm:h-72 rounded-2xl overflow-hidden bg-charcoal-900 border border-border shadow-md mt-4">
                <Image
                  src={activeModalProduct.images?.[0]?.imageId || activeModalProduct.ogImageId || ''}
                  alt={isEn ? (activeModalProduct.nameEn || activeModalProduct.nameFa) : activeModalProduct.nameFa}
                  fill
                  sizes="(max-width: 640px) 100vw, 600px"
                  className="object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-charcoal-950/70 via-transparent to-transparent pointer-events-none" />
              </div>
            )}

            {/* Modal Header */}
            <div className="flex items-center gap-3">
              {activeModalProduct.images?.[0]?.imageId || activeModalProduct.ogImageId ? (
                <Image
                  src={activeModalProduct.images?.[0]?.imageId || activeModalProduct.ogImageId || ''}
                  alt=""
                  width={48}
                  height={48}
                  className="w-12 h-12 rounded-2xl object-cover border border-border-gold shadow-gold shrink-0 bg-surface-elevated"
                />
              ) : (
                <span className="w-12 h-12 rounded-2xl bg-primary/10 border border-border-gold flex items-center justify-center text-2xl shadow-gold shrink-0">
                  👑
                </span>
              )}
              <div>
                <span className="text-xs font-bold text-primary block">
                  {isEn
                    ? (activeModalProduct.category.nameEn || activeModalProduct.category.nameFa)
                    : activeModalProduct.category.nameFa}
                </span>
                <h3 className="text-lg sm:text-xl font-extrabold text-foreground">
                  {isEn ? (activeModalProduct.nameEn || activeModalProduct.nameFa) : activeModalProduct.nameFa}
                </h3>
                {activeModalProduct.nameEn && !isEn && (
                  <p className="text-xs text-muted-foreground font-mono" dir="ltr">
                    {activeModalProduct.nameEn}
                  </p>
                )}
              </div>
            </div>

            {/* Specification Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 p-4 rounded-2xl bg-surface-card border border-border text-xs">
              <div>
                <span className="text-muted-foreground block mb-1">{isEn ? 'SKU Code' : 'شناسه انبار (کد)'}</span>
                <span className="font-mono font-bold text-foreground">
                  {activeModalProduct.sku || '---'}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground block mb-1">{isEn ? 'Status' : 'وضعیت موجودی'}</span>
                <span className={`font-bold ${activeModalProduct.stockStatus === 'IN_STOCK' ? 'text-emerald-400' : 'text-amber-400'}`}>
                  {activeModalProduct.stockStatus === 'IN_STOCK'
                    ? (isEn ? 'In Stock' : 'موجود در کلینیک')
                    : (isEn ? 'Order on Request' : 'سفارشی / استعلام')}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground block mb-1">{isEn ? 'Price' : 'قیمت رسمی'}</span>
                <span className="font-extrabold text-primary">
                  {formatPrice(activeModalProduct.price)}
                </span>
              </div>
            </div>

            {/* Description */}
            <div>
              <h4 className="text-xs font-bold text-foreground uppercase tracking-wider mb-2">
                {isEn ? 'Product Description & Benefits' : 'توضیحات و ویژگی‌های تخصصی محصول'}
              </h4>
              <p className="text-sm text-muted-foreground leading-relaxed bg-surface-elevated p-4 rounded-2xl border border-border/60">
                {isEn
                  ? (activeModalProduct.shortDescEn || activeModalProduct.shortDescFa || 'No description provided.')
                  : (activeModalProduct.shortDescFa || 'توضیحاتی برای این محصول ثبت نشده است.')}
              </p>
            </div>

            {/* Direct Order Actions */}
            <div className="pt-4 border-t border-border flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="text-start">
                <span className="text-[11px] text-muted-foreground block">
                  {isEn ? 'Inquiries & Immediate Dispatch' : 'خرید حضوری در قیطریه یا ارسال فوری'}
                </span>
                <strong className="text-sm text-foreground">
                  {isEn ? 'Pet Boss Concierge' : 'پشتیبانی فروش کلینیک پت باس'}
                </strong>
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto">
                <a
                  href="tel:+982126429715"
                  className="flex-1 sm:flex-initial px-5 py-2.5 rounded-xl bg-gradient-gold text-charcoal-950 font-bold text-xs text-center shadow-gold hover:opacity-90 transition-all flex items-center justify-center gap-2"
                >
                  📞 {isEn ? 'Call Reception (021-26429715)' : 'تماس با پذیرش (۰۲۱-۲۶۴۲۹۷۱۵)'}
                </a>
                <Link
                  href="/contact"
                  className="flex-1 sm:flex-initial px-4 py-2.5 rounded-xl border border-border text-foreground hover:border-primary text-xs font-bold text-center transition-colors"
                >
                  📝 {isEn ? 'Online Inquiry' : 'استعلام آنلاین'}
                </Link>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
