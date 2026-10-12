'use client'

import { useState, useMemo, useRef, useEffect } from 'react'
import Image from 'next/image'
import { useLocale } from 'next-intl'
import { Link } from '@/i18n/routing'
import { StockStatus } from '@prisma/client'
import { formatPrice } from '@/lib/format/price'
import { toPersianDigits } from '@/lib/utils/phone'

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
  whatsappNumber?: string | null
  phone?: string
}

type SpeciesFilter = 'all' | 'cat' | 'dog' | 'health' | 'play'

export function ShopCatalogClient({
  categories,
  products,
  whatsappNumber,
  phone = '',
}: ShopCatalogClientProps) {
  const locale = useLocale()
  const isEn = locale === 'en'

  const [selectedCategory, setSelectedCategory] = useState<string>('all')
  const [speciesFilter, setSpeciesFilter] = useState<SpeciesFilter>('all')
  const [onlyInStock, setOnlyInStock] = useState<boolean>(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [sortBy, setSortBy] = useState<'newest' | 'priceAsc' | 'priceDesc' | 'inStock'>('newest')
  const [activeModalProduct, setActiveModalProduct] = useState<ShopProduct | null>(null)
  const [copiedSku, setCopiedSku] = useState<string | null>(null)

  const PAGE_SIZE = 24
  const [visibleCount, setVisibleCount] = useState<number>(PAGE_SIZE)

  // Reset pagination count on filter/search changes
  useEffect(() => {
    setVisibleCount(PAGE_SIZE)
  }, [selectedCategory, speciesFilter, onlyInStock, searchQuery, sortBy])

  const productsSectionRef = useRef<HTMLDivElement>(null)

  // Filter Categories by Species Tabs
  const visibleCategories = useMemo(() => {
    if (speciesFilter === 'all') return categories
    if (speciesFilter === 'cat') {
      return categories.filter(c => 
        c.nameFa.includes('گربه') || 
        (c.nameEn && c.nameEn.toLowerCase().includes('cat'))
      )
    }
    if (speciesFilter === 'dog') {
      return categories.filter(c => 
        c.nameFa.includes('سگ') || 
        (c.nameEn && c.nameEn.toLowerCase().includes('dog'))
      )
    }
    if (speciesFilter === 'health') {
      return categories.filter(c => 
        c.nameFa.includes('دارویی') || 
        c.nameFa.includes('مکمل') || 
        c.nameFa.includes('بهداشتی') || 
        c.nameFa.includes('گرومینگ')
      )
    }
    if (speciesFilter === 'play') {
      return categories.filter(c => 
        c.nameFa.includes('اسباب بازی') || 
        c.nameFa.includes('قلاده') || 
        c.nameFa.includes('اکسسوری') || 
        c.nameFa.includes('لباس') || 
        c.nameFa.includes('باکس')
      )
    }
    return categories
  }, [categories, speciesFilter])

  // Filter and sort products
  const filteredProducts = useMemo(() => {
    return products
      .filter((p) => {
        // Species Quick Filter
        if (speciesFilter === 'cat') {
          const isCat = p.nameFa.includes('گربه') || p.category.nameFa.includes('گربه') || (p.nameFa.toLowerCase().includes('cat'))
          if (!isCat) return false
        } else if (speciesFilter === 'dog') {
          const isDog = p.nameFa.includes('سگ') || p.category.nameFa.includes('سگ') || (p.nameFa.toLowerCase().includes('dog'))
          if (!isDog) return false
        } else if (speciesFilter === 'health') {
          const isHealth = p.category.nameFa.includes('دارویی') || p.category.nameFa.includes('بهداشتی')
          if (!isHealth) return false
        } else if (speciesFilter === 'play') {
          const isPlay = p.category.nameFa.includes('اسباب بازی') || p.category.nameFa.includes('قلاده') || p.category.nameFa.includes('اکسسوری') || p.category.nameFa.includes('لباس')
          if (!isPlay) return false
        }

        // Category Filter
        if (selectedCategory !== 'all' && p.categoryId !== selectedCategory) {
          return false
        }

        // Only In-Stock toggle
        if (onlyInStock && p.stockStatus !== 'IN_STOCK') {
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
  }, [products, selectedCategory, speciesFilter, onlyInStock, searchQuery, sortBy])

  const visibleProducts = useMemo(() => {
    return filteredProducts.slice(0, visibleCount)
  }, [filteredProducts, visibleCount])

  // Copy SKU handler
  const handleCopySku = (sku: string) => {
    navigator.clipboard.writeText(sku)
    setCopiedSku(sku)
    setTimeout(() => setCopiedSku(null), 2000)
  }

  // Smooth scroll to products
  const scrollToProducts = () => {
    productsSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <div className="min-h-screen bg-background text-foreground pb-20">
      {/* ═════════════════════════════════════════════════════════════ */}
      {/* 1. HERO & LUXURY BOUTIQUE HEADER */}
      {/* ═════════════════════════════════════════════════════════════ */}
      <section className="relative overflow-hidden border-b border-border-gold/40 bg-gradient-hero pt-12 pb-12 sm:pt-16 sm:pb-16">
        <div className="absolute inset-0 bg-gradient-to-b from-primary/5 via-transparent to-transparent pointer-events-none" />
        <div className="container-site relative z-10 text-center max-w-4xl mx-auto px-4">
          {/* Gold Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/10 border border-primary/30 text-primary text-xs sm:text-sm font-semibold mb-6 shadow-gold animate-fade-in">
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
                Super-Premium Nutrition & <span className="text-gradient-gold">Luxury Pet Supplies</span>
              </>
            ) : (
              <>
                تغذیه سوپرپرمیوم و <span className="text-gradient-gold">ملزومات لوکس پت‌شاپ</span>
              </>
            )}
          </h1>

          <p className="text-sm sm:text-base text-muted-foreground leading-relaxed max-w-2xl mx-auto mb-8">
            {isEn
              ? 'Over 700+ curated European nutrition formulas, organic shampoos, designer accessories, and veterinary wellness supplies with guidance from Pet Boss clinic veterinarians in Tehran.'
              : 'بیش از ۷۰۰ قلم کالای اورجینال شامل رژیم‌های غذایی معتبر اروپایی، مکمل‌های درمانی، اسباب‌بازی‌های هوشمند، قلاده‌های دست‌دوز و ملزومات گرومینگ تحت نظارت مستقیم کادر درمان کلینیک پت باس.'}
          </p>

          {/* Quick Metrics Bar */}
          <div className="inline-flex flex-wrap items-center justify-center gap-4 sm:gap-8 px-6 py-3 rounded-2xl bg-surface-card/80 border border-border text-xs sm:text-sm font-medium text-foreground/90 shadow-sm">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>{isEn ? `${categories.length} Exclusive Categories` : `${categories.length} دسته‌بندی تخصصی`}</span>
            </div>
            <span className="text-border hidden sm:inline">•</span>
            <div className="flex items-center gap-2">
              <span>💎</span>
              <span>{isEn ? `${products.length}+ Verified Products` : `${products.length}+ قلم کالای اورجینال انبار`}</span>
            </div>
            <span className="text-border hidden sm:inline">•</span>
            <div className="flex items-center gap-2">
              <span>🩺</span>
              <span>{isEn ? 'Veterinary Guidance Included' : 'تضمین اصالت و مشاوره دامپزشک'}</span>
            </div>
          </div>
        </div>
      </section>

      {/* ═════════════════════════════════════════════════════════════ */}
      {/* 2. LUXURY CATEGORY SHOWCASE (CAROUSEL / VISUAL GRID) */}
      {/* ═════════════════════════════════════════════════════════════ */}
      <section className="py-8 bg-surface border-b border-border/80">
        <div className="container-site px-4">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg sm:text-xl font-bold text-foreground flex items-center gap-2">
                <span>🏷️</span>
                <span>{isEn ? 'Browse by Boutique Category' : 'دسته‌بندی‌های اختصاصی بوتیک'}</span>
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                {isEn ? 'Select a category to explore specialized products' : 'جهت مشاهده اقلام هر دسته، روی کارت موردنظر کلیک کنید'}
              </p>
            </div>
            {selectedCategory !== 'all' && (
              <button
                type="button"
                onClick={() => setSelectedCategory('all')}
                className="text-xs font-bold text-primary hover:underline flex items-center gap-1 cursor-pointer"
              >
                <span>↺</span>
                <span>{isEn ? 'Show All Categories' : 'نمایش همه دسته‌ها'}</span>
              </button>
            )}
          </div>

          {/* Visual Cards Scrollable Grid */}
          <div className="flex items-stretch gap-4 overflow-x-auto pb-4 pt-1 scrollbar-thin scroll-smooth">
            {/* 'All Categories' Card */}
            <button
              type="button"
              onClick={() => {
                setSelectedCategory('all')
                scrollToProducts()
              }}
              className={`w-40 sm:w-48 shrink-0 rounded-2xl overflow-hidden border p-4 text-start flex flex-col justify-between transition-all duration-300 cursor-pointer ${
                selectedCategory === 'all'
                  ? 'bg-gradient-to-br from-primary/20 via-surface-elevated to-surface border-primary shadow-gold ring-2 ring-primary/40'
                  : 'bg-surface-elevated border-border hover:border-primary/50'
              }`}
            >
              <div className="flex items-center justify-between mb-3">
                <span className="w-10 h-10 rounded-xl bg-primary/20 text-primary flex items-center justify-center text-xl">
                  🐾
                </span>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                  selectedCategory === 'all' ? 'bg-primary text-charcoal-950 font-extrabold' : 'bg-surface-card text-muted-foreground'
                }`}>
                  {products.length}
                </span>
              </div>
              <div>
                <h3 className="text-sm font-bold text-foreground">
                  {isEn ? 'All Products' : 'همه محصولات'}
                </h3>
                <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-1">
                  {isEn ? 'Complete boutique catalog' : 'کاتالوگ جامع پت‌شاپ'}
                </p>
              </div>
            </button>

            {/* 16 Category Visual Cards */}
            {visibleCategories.map((cat) => {
              const isSelected = selectedCategory === cat.id
              const catName = isEn ? (cat.nameEn || cat.nameFa) : cat.nameFa
              const count = cat._count?.products ?? 0
              const categoryImg = cat.imageId || '/images/categories/other.jpg'

              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => {
                    setSelectedCategory(cat.id)
                    scrollToProducts()
                  }}
                  className={`group relative w-44 sm:w-52 shrink-0 aspect-[4/3] rounded-2xl overflow-hidden border transition-all duration-300 cursor-pointer text-start flex flex-col justify-end p-3.5 shadow-sm ${
                    isSelected
                      ? 'border-primary ring-2 ring-primary/50 shadow-gold transform scale-[1.02]'
                      : 'border-border/80 hover:border-primary/60 hover:shadow-md'
                  }`}
                >
                  {/* Category Image */}
                  <Image
                    src={categoryImg}
                    alt={catName}
                    fill
                    sizes="220px"
                    className="object-cover transform group-hover:scale-105 transition-transform duration-500"
                  />
                  {/* Gradient Overlay for Readable Text */}
                  <div className="absolute inset-0 bg-gradient-to-t from-charcoal-950 via-charcoal-950/60 to-transparent pointer-events-none" />

                  {/* Top Badge (Item Count) */}
                  <div className="absolute top-2.5 end-2.5 z-10">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold backdrop-blur-md shadow-xs ${
                      isSelected
                        ? 'bg-gradient-gold text-charcoal-950 font-black'
                        : 'bg-charcoal-950/70 text-white border border-white/10'
                    }`}>
                      {count} {isEn ? 'items' : 'قلم'}
                    </span>
                  </div>

                  {/* Text Container */}
                  <div className="relative z-10">
                    <h3 className={`text-xs sm:text-sm font-bold leading-tight drop-shadow-md ${
                      isSelected ? 'text-primary' : 'text-white group-hover:text-primary transition-colors'
                    }`}>
                      {catName}
                    </h3>
                    {cat.descriptionFa && (
                      <p className="text-[10px] text-white/70 line-clamp-1 mt-0.5 drop-shadow-xs">
                        {isEn ? (cat.descriptionEn || '') : cat.descriptionFa}
                      </p>
                    )}
                  </div>
                </button>
              )
            })}
          </div>
        </div>
      </section>

      {/* ═════════════════════════════════════════════════════════════ */}
      {/* 3. TOOLBAR, SPECIES TABS & CONTROLS */}
      {/* ═════════════════════════════════════════════════════════════ */}
      <section ref={productsSectionRef} className="sticky top-20 z-40 bg-surface/95 backdrop-blur border-b border-border/80 py-4 shadow-md">
        <div className="container-site px-4">
          <div className="flex flex-col gap-3">
            {/* Top Row: Species Filter Tabs */}
            <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-thin">
              <span className="text-xs text-muted-foreground font-semibold shrink-0 hidden sm:inline">
                {isEn ? 'Filter by Pet:' : 'فیلتر بر اساس نیاز:'}
              </span>

              {[
                { id: 'all', labelFa: '✨ همه اقلام', labelEn: 'All' },
                { id: 'cat', labelFa: '🐱 ویژه گربه‌ها', labelEn: 'Cats' },
                { id: 'dog', labelFa: '🐶 ویژه سگ‌ها', labelEn: 'Dogs' },
                { id: 'health', labelFa: '🩺 دارو و سلامت', labelEn: 'Health & Care' },
                { id: 'play', labelFa: '🎾 بازی و پوشاک', labelEn: 'Toys & Gear' },
              ].map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => {
                    setSpeciesFilter(tab.id as SpeciesFilter)
                    setSelectedCategory('all')
                  }}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold shrink-0 transition-all cursor-pointer ${
                    speciesFilter === tab.id
                      ? 'bg-primary text-charcoal-950 shadow-gold'
                      : 'bg-surface-elevated border border-border text-foreground hover:border-primary/50'
                  }`}
                >
                  {isEn ? tab.labelEn : tab.labelFa}
                </button>
              ))}

              {/* Only In-Stock Switch */}
              <label className="ms-auto shrink-0 flex items-center gap-2 text-xs font-semibold cursor-pointer bg-surface-elevated border border-border px-3 py-1.5 rounded-xl hover:border-primary/50">
                <input
                  type="checkbox"
                  checked={onlyInStock}
                  onChange={(e) => setOnlyInStock(e.target.checked)}
                  className="rounded text-primary focus:ring-primary cursor-pointer"
                />
                <span className="text-emerald-500 font-bold">●</span>
                <span>{isEn ? 'In-Stock Only' : 'فقط کالاهای موجود'}</span>
              </label>
            </div>

            {/* Bottom Row: Search & Sorting */}
            <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 pt-2 border-t border-border/50">
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
                      ? 'Search products, brands (Royal Canin, Babin, Bioline...), or SKU...'
                      : 'جستجوی محصولات، برندها (رویال کنین، بابین، تریکسی، ونپي...) یا بارکد کالا...'
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
                    <option value="inStock">{isEn ? 'In-Stock First' : 'موجود در کلینیک'}</option>
                    <option value="priceAsc">{isEn ? 'Price: Low to High' : 'ارزان‌ترین'}</option>
                    <option value="priceDesc">{isEn ? 'Price: High to Low' : 'گران‌ترین'}</option>
                  </select>
                </div>
              </div>
            </div>
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
                setSpeciesFilter('all')
                setOnlyInStock(false)
              }}
              className="px-5 py-2 rounded-xl bg-gradient-gold text-charcoal-950 text-xs font-bold shadow-gold cursor-pointer"
            >
              {isEn ? 'Reset All Filters' : 'نمایش تمام محصولات'}
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {visibleProducts.map((product) => {
              const pName = isEn ? (product.nameEn || product.nameFa) : product.nameFa
              const pDesc = isEn ? (product.shortDescEn || product.shortDescFa) : product.shortDescFa
              const catName = isEn ? (product.category.nameEn || product.category.nameFa) : product.category.nameFa
              const isInStock = product.stockStatus === 'IN_STOCK'
              const productImage = product.images?.[0]?.imageId || product.category.imageId || '/images/categories/other.jpg'
              const isBase64 = productImage.startsWith('data:')

              // WhatsApp link (only if whatsappNumber is configured in settings)
              const whatsappText = encodeURIComponent(
                `سلام وقت بخیر، درخواست استعلام موجودی و خرید محصول "${product.nameFa}" ${product.sku ? `با کد ${product.sku}` : ''} در پت‌شاپ کلینیک پت‌باس را دارم.`
              )
              const whatsappUrl = whatsappNumber
                ? `https://wa.me/${whatsappNumber.replace(/\D/g, '')}?text=${whatsappText}`
                : null
              const telUrl = `tel:${phone.replace(/\s+/g, '')}`

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
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 backdrop-blur-sm shadow-xs">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                          {isEn ? 'In Stock' : 'موجود در کلینیک'}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30 backdrop-blur-sm shadow-xs">
                          {isEn ? 'Inquire / Order' : 'سفارشی / استعلام'}
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

                    {/* Product Photo */}
                    <div className="absolute inset-0 w-full h-full overflow-hidden bg-charcoal-900">
                      <Image
                        src={productImage}
                        alt={pName}
                        fill
                        unoptimized={isBase64}
                        sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                        className="object-cover transform group-hover:scale-105 transition-transform duration-700"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-charcoal-950/70 via-transparent to-transparent pointer-events-none" />
                    </div>

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
                          {isEn ? 'Price:' : 'قیمت:'}
                        </span>
                        <span className="text-sm font-extrabold text-foreground tracking-tight text-gradient-gold">
                          {formatPrice(product.price, isEn ? 'en' : 'fa')}
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

                        {whatsappUrl ? (
                          <a
                            href={whatsappUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="w-full py-2 px-2 rounded-xl bg-gradient-gold hover:opacity-95 text-charcoal-950 text-xs font-bold text-center shadow-gold transition-all flex items-center justify-center gap-1.5"
                          >
                            <span>💬</span>
                            <span>{isEn ? 'Order' : 'سفارش'}</span>
                          </a>
                        ) : (
                          <a
                            href={telUrl}
                            className="w-full py-2 px-2 rounded-xl bg-gradient-gold hover:opacity-95 text-charcoal-950 text-xs font-bold text-center shadow-gold transition-all flex items-center justify-center gap-1.5"
                          >
                            <span>📞</span>
                            <span>{isEn ? 'Call' : 'تماس'}</span>
                          </a>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}

            {/* Load More Pagination */}
            {visibleCount < filteredProducts.length && (
              <div className="col-span-full mt-10 text-center">
                <button
                  type="button"
                  onClick={() => setVisibleCount((prev) => prev + PAGE_SIZE)}
                  className="px-8 py-3.5 rounded-2xl bg-surface-card border-2 border-primary/40 hover:border-primary text-foreground text-sm font-bold shadow-gold transition-all duration-300 hover:scale-[1.02] active:scale-[0.98] cursor-pointer inline-flex items-center gap-3"
                >
                  <span>✨ {isEn ? 'Load More Products' : 'مشاهده محصولات بیشتر'}</span>
                  <span className="text-xs px-2.5 py-0.5 rounded-full bg-primary/20 text-primary font-mono font-bold">
                    {isEn ? `${visibleProducts.length} of ${filteredProducts.length}` : `${toPersianDigits(visibleProducts.length)} از ${toPersianDigits(filteredProducts.length)}`}
                  </span>
                </button>
              </div>
            )}
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
                  ? 'Need prescription food or personalized consultation?'
                  : 'نیاز به رژیم غذایی درمانی یا مشاوره تخصصی خرید دارید؟'}
              </h2>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {isEn
                  ? 'All therapeutic foods, renal and urinary diets, joint mobility supplements, and care products sold at Pet Boss Clinic are authentic, stored under strict climate conditions, and cross-referenced with your pet’s clinical health records.'
                  : 'کلیه غذاهای درمانی (رنال، یورینری، هایپوآلرژنیک)، مکمل‌های مفاصل و خمیرهای هربال با ضمانت تاریخ انقضای معتبر و نگهداری در شرایط دمایی استاندارد کلینیک به مراجعین محترم عرضه می‌گردند.'}
              </p>
            </div>

            <div className="flex flex-col sm:flex-row lg:flex-col gap-3 justify-center">
              {phone && (
                <a
                  href={`tel:${phone.replace(/[^0-9+]/g, '')}`}
                  className="px-6 py-3.5 rounded-full bg-gradient-gold text-charcoal-950 font-bold text-xs sm:text-sm text-center shadow-gold hover:opacity-90 transition-all flex items-center justify-center gap-2"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
                  <span>{isEn ? `Call Clinic Reception (${phone})` : `تماس با پذیرش کلینیک (${phone})`}</span>
                </a>
              )}

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
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-charcoal-950/80 backdrop-blur-md animate-fade-in"
          onClick={() => setActiveModalProduct(null)}
        >
          <div
            className="card-luxury rounded-3xl max-w-2xl w-full overflow-hidden border border-border-gold shadow-gold-lg max-h-[90vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between p-5 border-b border-border bg-surface-elevated">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-primary/10 text-primary border border-primary/30">
                  {isEn
                    ? (activeModalProduct.category.nameEn || activeModalProduct.category.nameFa)
                    : activeModalProduct.category.nameFa}
                </span>
                {activeModalProduct.stockStatus === 'IN_STOCK' ? (
                  <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                    {isEn ? 'In Stock' : 'موجود در کلینیک'}
                  </span>
                ) : (
                  <span className="text-[10px] font-bold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20">
                    {isEn ? 'Inquire / Order' : 'سفارشی / استعلام موجودی'}
                  </span>
                )}
              </div>
              <button
                type="button"
                onClick={() => setActiveModalProduct(null)}
                className="w-8 h-8 rounded-full bg-surface hover:bg-surface-card border border-border flex items-center justify-center text-muted-foreground hover:text-foreground text-sm cursor-pointer transition-colors"
              >
                ✕
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-6">
              {/* Image Preview */}
              <div className="relative aspect-[16/10] w-full rounded-2xl overflow-hidden bg-charcoal-900 border border-border flex items-center justify-center">
                {(() => {
                  const modalImg = activeModalProduct.images?.[0]?.imageId || activeModalProduct.category.imageId || '/images/categories/other.jpg'
                  const isBase64 = modalImg.startsWith('data:')
                  return (
                    <Image
                      src={modalImg}
                      alt={activeModalProduct.nameFa}
                      fill
                      unoptimized={isBase64}
                      className="object-cover"
                    />
                  )
                })()}
                <div className="absolute inset-0 bg-gradient-to-t from-charcoal-950/80 via-transparent to-transparent pointer-events-none" />
              </div>

              {/* Title */}
              <div>
                <h2 className="text-xl sm:text-2xl font-black text-foreground mb-1 leading-snug">
                  {isEn ? (activeModalProduct.nameEn || activeModalProduct.nameFa) : activeModalProduct.nameFa}
                </h2>
                {isEn && activeModalProduct.nameFa && (
                  <p className="text-xs text-muted-foreground font-mono">
                    {activeModalProduct.nameFa}
                  </p>
                )}
              </div>

              {/* Price Row */}
              <div className="p-4 rounded-2xl bg-surface-elevated border border-border-gold/30 flex items-center justify-between">
                <span className="text-xs font-semibold text-muted-foreground">
                  {isEn ? 'Boutique Price:' : 'قیمت در پت‌شاپ پت باس:'}
                </span>
                <span className="text-xl font-extrabold text-gradient-gold">
                  {formatPrice(activeModalProduct.price, isEn ? 'en' : 'fa')}
                </span>
              </div>

              {/* Specs Grid */}
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="p-3 rounded-xl bg-surface-elevated border border-border">
                  <span className="text-muted-foreground block mb-1">
                    {isEn ? 'SKU / Barcode' : 'کد کالا / بارکد:'}
                  </span>
                  <div className="flex items-center justify-between">
                    <span className="font-mono font-bold text-foreground">
                      {activeModalProduct.sku || 'PB-SPECIAL'}
                    </span>
                    {activeModalProduct.sku && (
                      <button
                        type="button"
                        onClick={() => handleCopySku(activeModalProduct.sku!)}
                        className="text-[10px] text-primary hover:underline cursor-pointer"
                      >
                        {copiedSku === activeModalProduct.sku ? '✓ کپی شد' : 'کپی'}
                      </button>
                    )}
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-surface-elevated border border-border">
                  <span className="text-muted-foreground block mb-1">
                    {isEn ? 'Category' : 'دسته‌بندی:'}
                  </span>
                  <span className="font-bold text-foreground">
                    {isEn
                      ? (activeModalProduct.category.nameEn || activeModalProduct.category.nameFa)
                      : activeModalProduct.category.nameFa}
                  </span>
                </div>
              </div>

              {/* Description */}
              <div className="space-y-2">
                <h4 className="text-xs font-bold text-foreground uppercase tracking-wider">
                  {isEn ? 'Description & Guidance' : 'توضیحات و راهنمای مصرف'}
                </h4>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {activeModalProduct.shortDescFa ||
                    'این محصول با ضمانت تاریخ انقضای معتبر و نگهداری در شرایط دمایی استاندارد کلینیک پت باس عرضه می‌شود.'}
                </p>
              </div>

              {/* Veterinary Quality Notice */}
              <div className="p-3.5 rounded-xl bg-primary/5 border border-primary/20 text-[11px] text-muted-foreground leading-relaxed flex items-start gap-2.5">
                <span className="text-primary text-base">🩺</span>
                <span>
                  {isEn
                    ? 'Authenticity & storage condition strictly certified by Pet Boss veterinary surgeons. For prescription diets, please consult our on-duty doctors.'
                    : 'اصالت فیزیکی، شرایط حمل و انقضای این کالا توسط دامپزشکان کلینیک پت باس تضمین شده است. جهت هماهنگی ارسال فوری پیک در تهران یا دریافت مشاوره تغذیه، با کلینیک تماس حاصل فرمایید.'}
                </span>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="p-5 border-t border-border bg-surface-elevated flex flex-col sm:flex-row items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setActiveModalProduct(null)}
                className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-surface border border-border text-foreground hover:bg-surface-card text-xs font-bold cursor-pointer"
              >
                {isEn ? 'Close' : 'بستن'}
              </button>

              {whatsappNumber && (
                <a
                  href={`https://wa.me/${whatsappNumber.replace(/\D/g, '')}?text=${encodeURIComponent(
                    `سلام وقت بخیر، درخواست استعلام موجودی و خرید محصول "${activeModalProduct.nameFa}" ${activeModalProduct.sku ? `با کد ${activeModalProduct.sku}` : ''} در پت‌شاپ کلینیک پت‌باس را دارم.`
                  )}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-gradient-gold text-charcoal-950 text-xs font-bold shadow-gold hover:opacity-95 text-center flex items-center justify-center gap-2 cursor-pointer"
                >
                  <span>💬</span>
                  <span>{isEn ? 'Order via WhatsApp' : 'سفارش آنلاین در واتس‌اپ'}</span>
                </a>
              )}

              <a
                href={`tel:${phone.replace(/\s+/g, '')}`}
                className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-surface-card border border-border-gold text-primary text-xs font-bold hover:border-primary text-center flex items-center justify-center gap-2"
              >
                <span>📞</span>
                <span>{isEn ? 'Call Reception' : `تماس با کلینیک (${phone})`}</span>
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
