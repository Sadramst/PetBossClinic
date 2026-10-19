'use client'

import { useState, useMemo, useRef, useEffect, useCallback } from 'react'
import Image from 'next/image'
import { useLocale } from 'next-intl'
import { Link } from '@/i18n/routing'
import { StockStatus } from '@prisma/client'
import { formatPrice } from '@/lib/format/price'
import { toPersianDigits } from '@/lib/utils/phone'
import {
  parseAIQueryIntent,
  scoreProductAIRelevance,
  getRelatedThematicProducts,
  SPECIAL_NEEDS_LEXICON,
  QUICK_AI_PROMPTS,
  AIIntentResult,
} from '@/lib/shop/ai-engine'

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
  comparePrice?: number | null
  stockStatus: StockStatus
  isActive: boolean
  isFeatured?: boolean
  createdAt: string | Date
  ogImageId?: string | null
  brand?: {
    id: string
    nameFa: string
    nameEn: string | null
  } | null
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
type SortOption = 'featured' | 'newest' | 'priceAsc' | 'priceDesc' | 'discount' | 'inStock'

export function ShopCatalogClient({
  categories,
  products,
  whatsappNumber,
  phone = '',
}: ShopCatalogClientProps) {
  const locale = useLocale()
  const isEn = locale === 'en'

  // ─── Filter States ──────────────────────────────────────────
  const [selectedCategory, setSelectedCategory] = useState<string>('all')
  const [speciesFilter, setSpeciesFilter] = useState<SpeciesFilter>('all')
  const [onlyInStock, setOnlyInStock] = useState<boolean>(false)
  const [onlyDiscounted, setOnlyDiscounted] = useState<boolean>(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [sortBy, setSortBy] = useState<SortOption>('featured')
  const [selectedNeeds, setSelectedNeeds] = useState<string[]>([])
  const [selectedBrand, setSelectedBrand] = useState<string>('all')
  const [minPrice, setMinPrice] = useState<number | ''>('')
  const [maxPrice, setMaxPrice] = useState<number | ''>('')

  // ─── AI Search State ────────────────────────────────────────
  const [aiInput, setAiInput] = useState('')
  const [activeAiQuery, setActiveAiQuery] = useState('')
  const [aiResult, setAiResult] = useState<AIIntentResult | null>(null)

  // ─── View & UI States ───────────────────────────────────────
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
  const [isMobileFiltersOpen, setIsMobileFiltersOpen] = useState(false)
  const [activeModalProduct, setActiveModalProduct] = useState<ShopProduct | null>(null)
  const [copiedSku, setCopiedSku] = useState<string | null>(null)

  const PAGE_SIZE = 24
  const [visibleCount, setVisibleCount] = useState<number>(PAGE_SIZE)

  const productsSectionRef = useRef<HTMLDivElement>(null)

  // Reset pagination on filter change
  useEffect(() => {
    setVisibleCount(PAGE_SIZE)
  }, [
    selectedCategory,
    speciesFilter,
    onlyInStock,
    onlyDiscounted,
    searchQuery,
    sortBy,
    selectedNeeds,
    selectedBrand,
    minPrice,
    maxPrice,
    activeAiQuery,
  ])

  // Calculate catalog price bounds
  const { catalogMinPrice, catalogMaxPrice } = useMemo(() => {
    if (products.length === 0) return { catalogMinPrice: 0, catalogMaxPrice: 10000000 }
    let min = Infinity
    let max = -Infinity
    for (const p of products) {
      if (p.price < min) min = p.price
      if (p.price > max) max = p.price
    }
    return {
      catalogMinPrice: min === Infinity ? 0 : min,
      catalogMaxPrice: max === -Infinity ? 10000000 : max,
    }
  }, [products])

  // Extract available brands with product counts
  const availableBrands = useMemo(() => {
    const brandMap = new Map<string, number>()
    for (const p of products) {
      if (p.brand?.nameFa) {
        brandMap.set(p.brand.nameFa, (brandMap.get(p.brand.nameFa) || 0) + 1)
      } else {
        // Fallback: extract well-known pet food brands from name
        const match = p.nameFa.match(/(رویال کنین|ببین|بابین|تریکسی|جوسرا|جیم کت|ونپی|بیولین|سلبن|رفلکس|هپی کت|دکتر کلودرز)/i)
        if (match) {
          brandMap.set(match[1], (brandMap.get(match[1]) || 0) + 1)
        }
      }
    }
    return Array.from(brandMap.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
  }, [products])

  // Helper to determine category visibility per species
  const getCategoriesForSpecies = useCallback((species: SpeciesFilter) => {
    if (species === 'all') return categories
    if (species === 'cat') {
      return categories.filter(
        (c) =>
          (c.nameFa.includes('گربه') ||
            (c.nameEn && c.nameEn.toLowerCase().includes('cat')) ||
            (c.slugFa && c.slugFa.toLowerCase().includes('cat')) ||
            (c.slugEn && c.slugEn.toLowerCase().includes('cat'))) &&
          !c.nameFa.includes('سگ') &&
          (!c.nameEn || !c.nameEn.toLowerCase().includes('dog'))
      )
    }
    if (species === 'dog') {
      return categories.filter(
        (c) =>
          (c.nameFa.includes('سگ') ||
            (c.nameEn && c.nameEn.toLowerCase().includes('dog')) ||
            (c.slugFa && c.slugFa.toLowerCase().includes('dog')) ||
            (c.slugEn && c.slugEn.toLowerCase().includes('dog'))) &&
          !c.nameFa.includes('گربه') &&
          (!c.nameEn || !c.nameEn.toLowerCase().includes('cat'))
      )
    }
    if (species === 'health') {
      return categories.filter(
        (c) =>
          c.nameFa.includes('دارویی') ||
          c.nameFa.includes('مکمل') ||
          c.nameFa.includes('بهداشتی') ||
          c.nameFa.includes('گرومینگ') ||
          (c.slugFa && (c.slugFa.includes('medicines') || c.slugFa.includes('hygiene')))
      )
    }
    if (species === 'play') {
      return categories.filter(
        (c) =>
          c.nameFa.includes('اسباب بازی') ||
          c.nameFa.includes('سرگرمی') ||
          c.nameFa.includes('قلاده') ||
          c.nameFa.includes('اکسسوری') ||
          c.nameFa.includes('لباس') ||
          c.nameFa.includes('باکس') ||
          (c.slugFa &&
            (c.slugFa.includes('toys') ||
              c.slugFa.includes('collars') ||
              c.slugFa.includes('carriers') ||
              c.slugFa.includes('apparel')))
      )
    }
    return categories
  }, [categories])

  // Filter Categories by Species Tabs for the showcase carousel & advance filter sidebar
  const visibleCategories = useMemo(() => {
    return getCategoriesForSpecies(speciesFilter)
  }, [getCategoriesForSpecies, speciesFilter])

  // Count products per category taking speciesFilter into account
  const categoryCounts = useMemo(() => {
    const counts = new Map<string, number>()
    for (const p of products) {
      let matchesSpecies = true
      if (speciesFilter === 'cat') {
        matchesSpecies = Boolean(
          p.nameFa.includes('گربه') ||
          p.category.nameFa.includes('گربه') ||
          (p.nameEn && p.nameEn.toLowerCase().includes('cat')) ||
          (p.category.nameEn && p.category.nameEn.toLowerCase().includes('cat'))
        )
      } else if (speciesFilter === 'dog') {
        matchesSpecies = Boolean(
          p.nameFa.includes('سگ') ||
          p.category.nameFa.includes('سگ') ||
          (p.nameEn && p.nameEn.toLowerCase().includes('dog')) ||
          (p.category.nameEn && p.category.nameEn.toLowerCase().includes('dog'))
        )
      } else if (speciesFilter === 'health') {
        matchesSpecies =
          p.category.nameFa.includes('دارویی') ||
          p.category.nameFa.includes('مکمل') ||
          p.category.nameFa.includes('بهداشتی') ||
          p.category.slugFa.includes('medicines') ||
          p.category.slugFa.includes('hygiene')
      } else if (speciesFilter === 'play') {
        matchesSpecies =
          p.category.nameFa.includes('اسباب بازی') ||
          p.category.nameFa.includes('قلاده') ||
          p.category.nameFa.includes('اکسسوری') ||
          p.category.nameFa.includes('لباس') ||
          p.category.slugFa.includes('toys') ||
          p.category.slugFa.includes('collars')
      }
      if (matchesSpecies) {
        counts.set(p.categoryId, (counts.get(p.categoryId) || 0) + 1)
      }
    }
    return counts
  }, [products, speciesFilter])

  const totalSpeciesProductsCount = useMemo(() => {
    if (speciesFilter === 'all') return products.length
    let total = 0
    for (const c of visibleCategories) {
      total += categoryCounts.get(c.id) || 0
    }
    return total
  }, [speciesFilter, products.length, visibleCategories, categoryCounts])

  const handleSpeciesChange = useCallback((newSpecies: SpeciesFilter) => {
    setSpeciesFilter(newSpecies)
    if (selectedCategory !== 'all') {
      const allowed = getCategoriesForSpecies(newSpecies)
      if (!allowed.some((c) => c.id === selectedCategory)) {
        setSelectedCategory('all')
      }
    }
  }, [selectedCategory, getCategoriesForSpecies])

  // ─── AI Search Execution ────────────────────────────────────
  const handleRunAiSearch = (query: string) => {
    const q = query.trim()
    if (!q) {
      setActiveAiQuery('')
      setAiResult(null)
      return
    }
    setActiveAiQuery(q)
    setAiInput(q)
    const result = parseAIQueryIntent(q)
    setAiResult(result)

    // Automatically align species filter if strongly detected
    if (result.detectedSpecies === 'cat') handleSpeciesChange('cat')
    else if (result.detectedSpecies === 'dog') handleSpeciesChange('dog')

    // Scroll to products
    productsSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  const handleClearAiSearch = () => {
    setActiveAiQuery('')
    setAiInput('')
    setAiResult(null)
  }

  // ─── Filter & Sort Products ─────────────────────────────────
  const filteredProducts = useMemo(() => {
    return products
      .filter((p) => {
        // 1. Species Filter
        if (speciesFilter === 'cat') {
          const isCat =
            p.nameFa.includes('گربه') ||
            p.category.nameFa.includes('گربه') ||
            (p.nameEn && p.nameEn.toLowerCase().includes('cat')) ||
            (p.category.nameEn && p.category.nameEn.toLowerCase().includes('cat'))
          if (!isCat) return false
        } else if (speciesFilter === 'dog') {
          const isDog =
            p.nameFa.includes('سگ') ||
            p.category.nameFa.includes('سگ') ||
            (p.nameEn && p.nameEn.toLowerCase().includes('dog')) ||
            (p.category.nameEn && p.category.nameEn.toLowerCase().includes('dog'))
          if (!isDog) return false
        } else if (speciesFilter === 'health') {
          const isHealth =
            p.category.nameFa.includes('دارویی') ||
            p.category.nameFa.includes('مکمل') ||
            p.category.nameFa.includes('بهداشتی') ||
            p.category.slugFa.includes('medicines') ||
            p.category.slugFa.includes('hygiene')
          if (!isHealth) return false
        } else if (speciesFilter === 'play') {
          const isPlay =
            p.category.nameFa.includes('اسباب بازی') ||
            p.category.nameFa.includes('قلاده') ||
            p.category.nameFa.includes('اکسسوری') ||
            p.category.nameFa.includes('لباس') ||
            p.category.slugFa.includes('toys') ||
            p.category.slugFa.includes('collars')
          if (!isPlay) return false
        }

        // 2. Category Filter
        if (selectedCategory !== 'all' && p.categoryId !== selectedCategory) {
          return false
        }

        // 3. Only In-Stock Filter
        if (onlyInStock && p.stockStatus !== 'IN_STOCK') {
          return false
        }

        // 4. Only Discounted Filter
        if (onlyDiscounted) {
          const isDiscounted = p.comparePrice && p.comparePrice > p.price
          if (!isDiscounted) return false
        }

        // 5. Price Range Filter
        if (typeof minPrice === 'number' && p.price < minPrice) return false
        if (typeof maxPrice === 'number' && p.price > maxPrice) return false

        // 6. Brand Filter
        if (selectedBrand !== 'all') {
          const pBrand = p.brand?.nameFa || ''
          const matches =
            pBrand === selectedBrand ||
            p.nameFa.toLowerCase().includes(selectedBrand.toLowerCase())
          if (!matches) return false
        }

        // 7. Special Health & Care Needs Filter
        if (selectedNeeds.length > 0) {
          const pText = `${p.nameFa} ${p.shortDescFa || ''} ${p.category.nameFa}`.toLowerCase()
          const matchesAllNeeds = selectedNeeds.every((needKey) => {
            const def = SPECIAL_NEEDS_LEXICON[needKey]
            return def ? def.terms.some((t) => pText.includes(t.toLowerCase())) : true
          })
          if (!matchesAllNeeds) return false
        }

        // 8. AI Intent Search vs Keyword Search
        if (activeAiQuery && aiResult) {
          const score = scoreProductAIRelevance(p, activeAiQuery, aiResult)
          return score > 0
        }

        // 9. Standard Search Filter
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase().trim()
          const matchFa = p.nameFa.toLowerCase().includes(q)
          const matchEn = p.nameEn ? p.nameEn.toLowerCase().includes(q) : false
          const matchSku = p.sku ? p.sku.toLowerCase().includes(q) : false
          const matchDescFa = p.shortDescFa ? p.shortDescFa.toLowerCase().includes(q) : false
          const matchCatFa = p.category.nameFa.toLowerCase().includes(q)
          const matchCatEn = p.category.nameEn ? p.category.nameEn.toLowerCase().includes(q) : false
          const matchBrand = p.brand?.nameFa?.toLowerCase().includes(q) || false

          return matchFa || matchEn || matchSku || matchDescFa || matchCatFa || matchCatEn || matchBrand
        }

        return true
      })
      .sort((a, b) => {
        // If AI search is active, sort strictly by AI relevance score
        if (activeAiQuery && aiResult) {
          const scoreA = scoreProductAIRelevance(a, activeAiQuery, aiResult)
          const scoreB = scoreProductAIRelevance(b, activeAiQuery, aiResult)
          if (scoreB !== scoreA) return scoreB - scoreA
        }

        if (sortBy === 'priceAsc') return a.price - b.price
        if (sortBy === 'priceDesc') return b.price - a.price
        if (sortBy === 'discount') {
          const discA = a.comparePrice && a.comparePrice > a.price ? a.comparePrice - a.price : 0
          const discB = b.comparePrice && b.comparePrice > b.price ? b.comparePrice - b.price : 0
          return discB - discA
        }
        if (sortBy === 'inStock') {
          if (a.stockStatus === 'IN_STOCK' && b.stockStatus !== 'IN_STOCK') return -1
          if (a.stockStatus !== 'IN_STOCK' && b.stockStatus === 'IN_STOCK') return 1
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        }
        if (sortBy === 'featured') {
          if (a.isFeatured && !b.isFeatured) return -1
          if (!a.isFeatured && b.isFeatured) return 1
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        }
        // newest
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      })
  }, [
    products,
    speciesFilter,
    selectedCategory,
    onlyInStock,
    onlyDiscounted,
    minPrice,
    maxPrice,
    selectedBrand,
    selectedNeeds,
    activeAiQuery,
    aiResult,
    searchQuery,
    sortBy,
  ])

  const visibleProducts = useMemo(() => {
    return filteredProducts.slice(0, visibleCount)
  }, [filteredProducts, visibleCount])

  // Count active filters
  const activeFiltersCount = useMemo(() => {
    let count = 0
    if (selectedCategory !== 'all') count++
    if (speciesFilter !== 'all') count++
    if (onlyInStock) count++
    if (onlyDiscounted) count++
    if (searchQuery.trim()) count++
    if (activeAiQuery) count++
    if (selectedBrand !== 'all') count++
    if (selectedNeeds.length > 0) count += selectedNeeds.length
    if (typeof minPrice === 'number' || typeof maxPrice === 'number') count++
    return count
  }, [
    selectedCategory,
    speciesFilter,
    onlyInStock,
    onlyDiscounted,
    searchQuery,
    activeAiQuery,
    selectedBrand,
    selectedNeeds,
    minPrice,
    maxPrice,
  ])

  // Reset all filters
  const handleResetAllFilters = () => {
    setSelectedCategory('all')
    setSpeciesFilter('all')
    setOnlyInStock(false)
    setOnlyDiscounted(false)
    setSearchQuery('')
    setSelectedBrand('all')
    setSelectedNeeds([])
    setMinPrice('')
    setMaxPrice('')
    setActiveAiQuery('')
    setAiInput('')
    setAiResult(null)
  }

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

  // Thematic complementary products for the active modal
  const modalRecommendations = useMemo(() => {
    if (!activeModalProduct) return null
    return getRelatedThematicProducts(activeModalProduct, products, 4)
  }, [activeModalProduct, products])

  return (
    <div className="min-h-screen bg-background text-foreground pb-24">
      {/* ═════════════════════════════════════════════════════════════ */}
      {/* 1. HERO & LUXURY BOUTIQUE HEADER */}
      {/* ═════════════════════════════════════════════════════════════ */}
      <section className="relative overflow-hidden border-b border-border-gold/40 bg-gradient-hero pt-10 pb-12 sm:pt-14 sm:pb-16">
        <div className="absolute inset-0 bg-gradient-to-b from-primary/5 via-transparent to-transparent pointer-events-none" />
        <div className="container-site relative z-10 text-center max-w-4xl mx-auto px-4">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/10 border border-primary/30 text-primary text-xs sm:text-sm font-semibold mb-5 shadow-gold animate-fade-in">
            <span>✨</span>
            <span>
              {isEn
                ? 'Pet Boss Signature Boutique & Veterinary Pet Shop'
                : 'ویترین اختصاصی بوتیک و پت‌شاپ کلینیک دامپزشکی پت باس'}
            </span>
          </div>

          <h1 className="text-2xl sm:text-4xl md:text-5xl font-black tracking-tight text-foreground mb-4 leading-tight">
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

          <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed max-w-2xl mx-auto mb-6">
            {isEn
              ? 'Over 700+ curated European nutrition formulas, organic shampoos, designer accessories, and veterinary wellness supplies with guidance from Pet Boss clinic veterinarians in Tehran.'
              : 'بیش از ۷۰۰ قلم کالای اورجینال شامل رژیم‌های غذایی معتبر اروپایی، مکمل‌های درمانی، اسباب‌بازی‌های هوشمند، قلاده‌های دست‌دوز و ملزومات گرومینگ تحت نظارت مستقیم کادر درمان کلینیک پت باس.'}
          </p>

          {/* Quick Metrics Bar */}
          <div className="inline-flex flex-wrap items-center justify-center gap-4 sm:gap-6 px-6 py-2.5 rounded-2xl bg-surface-card/90 border border-border text-xs font-medium text-foreground/90 shadow-xs">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>{isEn ? `${categories.length} Categories` : `${categories.length} دسته‌بندی تخصصی`}</span>
            </div>
            <span className="text-border hidden sm:inline">•</span>
            <div className="flex items-center gap-2">
              <span>💎</span>
              <span>{isEn ? `${products.length}+ Verified Products` : `${products.length}+ کالای تضمینی انبار`}</span>
            </div>
            <span className="text-border hidden sm:inline">•</span>
            <div className="flex items-center gap-2">
              <span>🩺</span>
              <span>{isEn ? 'Veterinary Guidance' : 'تضمین سلامت با نظارت دامپزشک'}</span>
            </div>
          </div>
        </div>
      </section>

      {/* ═════════════════════════════════════════════════════════════ */}
      {/* 2. CATEGORY SHOWCASE CAROUSEL */}
      {/* ═════════════════════════════════════════════════════════════ */}
      <section className="py-6 bg-surface border-b border-border/70">
        <div className="container-site px-4">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h2 className="text-base sm:text-lg font-bold text-foreground flex items-center gap-2">
                <span>🏷️</span>
                <span>{isEn ? 'Browse by Boutique Category' : 'دسته‌بندی‌های اختصاصی بوتیک'}</span>
              </h2>
            </div>
            {selectedCategory !== 'all' && (
              <button
                type="button"
                onClick={() => setSelectedCategory('all')}
                className="text-xs font-bold text-primary hover:underline flex items-center gap-1 cursor-pointer"
              >
                <span>↺</span>
                <span>{isEn ? 'All Categories' : 'نمایش همه دسته‌ها'}</span>
              </button>
            )}
          </div>

          <div className="flex items-stretch gap-3.5 overflow-x-auto pb-3 pt-1 scrollbar-thin scroll-smooth">
            {/* All Categories Card */}
            <button
              type="button"
              onClick={() => {
                setSelectedCategory('all')
                scrollToProducts()
              }}
              className={`w-36 sm:w-44 shrink-0 rounded-2xl overflow-hidden border p-3.5 text-start flex flex-col justify-between transition-all duration-300 cursor-pointer ${
                selectedCategory === 'all'
                  ? 'bg-gradient-to-br from-primary/20 via-surface-elevated to-surface border-primary shadow-gold ring-2 ring-primary/40'
                  : 'bg-surface-elevated border-border hover:border-primary/50'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="w-8 h-8 rounded-xl bg-primary/20 text-primary flex items-center justify-center text-lg">
                  🐾
                </span>
                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                    selectedCategory === 'all'
                      ? 'bg-primary text-charcoal-950 font-black'
                      : 'bg-surface-card text-muted-foreground'
                  }`}
                >
                  {speciesFilter === 'all' ? products.length : totalSpeciesProductsCount}
                </span>
              </div>
              <div>
                <h3 className="text-xs sm:text-sm font-bold text-foreground">
                  {isEn ? 'All Products' : 'همه محصولات'}
                </h3>
                <p className="text-[10px] text-muted-foreground mt-0.5 line-clamp-1">
                  {isEn ? 'Complete boutique catalog' : 'کاتالوگ جامع پت‌شاپ'}
                </p>
              </div>
            </button>

            {/* Category Cards */}
            {visibleCategories.map((cat) => {
              const isSelected = selectedCategory === cat.id
              const catName = isEn ? cat.nameEn || cat.nameFa : cat.nameFa
              const count = categoryCounts.get(cat.id) ?? cat._count?.products ?? 0
              const categoryImg = cat.imageId || '/images/categories/other.jpg'

              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => {
                    setSelectedCategory(cat.id)
                    scrollToProducts()
                  }}
                  className={`group relative w-40 sm:w-48 shrink-0 aspect-[4/3] rounded-2xl overflow-hidden border transition-all duration-300 cursor-pointer text-start flex flex-col justify-end p-3 shadow-xs ${
                    isSelected
                      ? 'border-primary ring-2 ring-primary/50 shadow-gold transform scale-[1.02]'
                      : 'border-border/80 hover:border-primary/60 hover:shadow-sm'
                  }`}
                >
                  <Image
                    src={categoryImg}
                    alt={catName}
                    fill
                    sizes="200px"
                    className="object-cover transform group-hover:scale-105 transition-transform duration-500"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-charcoal-950 via-charcoal-950/60 to-transparent pointer-events-none" />

                  <div className="absolute top-2 end-2 z-10">
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold backdrop-blur-md shadow-xs ${
                        isSelected
                          ? 'bg-gradient-gold text-charcoal-950 font-black'
                          : 'bg-charcoal-950/70 text-white border border-white/10'
                      }`}
                    >
                      {count} {isEn ? 'items' : 'قلم'}
                    </span>
                  </div>

                  <div className="relative z-10">
                    <h3
                      className={`text-xs sm:text-sm font-bold leading-tight drop-shadow-md ${
                        isSelected ? 'text-primary' : 'text-white group-hover:text-primary transition-colors'
                      }`}
                    >
                      {catName}
                    </h3>
                  </div>
                </button>
              )
            })}
          </div>
        </div>
      </section>

      {/* ═════════════════════════════════════════════════════════════ */}
      {/* 3. AI SMART SHOPPING ASSISTANT BAR & CLINICAL ADVISOR */}
      {/* ═════════════════════════════════════════════════════════════ */}
      <section className="py-5 bg-gradient-to-b from-surface via-surface-elevated/40 to-background border-b border-border/60">
        <div className="container-site px-4">
          <div className="rounded-2xl border-2 border-primary/30 bg-surface-elevated/90 p-4 sm:p-5 shadow-gold-sm relative overflow-hidden">
            <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4">
              {/* Header Label */}
              <div className="flex items-center gap-3 shrink-0">
                <span className="w-10 h-10 rounded-2xl bg-gradient-gold flex items-center justify-center text-xl shadow-gold text-charcoal-950">
                  🤖
                </span>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-sm sm:text-base font-extrabold text-foreground flex items-center gap-1.5">
                      <span>{isEn ? 'Pet Boss AI Smart Search & Advisor' : 'دستیار هوشمند جستجو و راهنمای پت‌باس'}</span>
                    </h2>
                    <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                      AI Powered
                    </span>
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    {isEn
                      ? 'Type any natural pet question (e.g. "neutered cat food", "puppy bone chew", "hairball relief")'
                      : 'سؤال خود را طبیعی بپرسید (مثلاً: «غذای گربه عقیم‌شده»، «تشویقی دندان توله سگ»، «خمیر مالت هربال»)'}
                  </p>
                </div>
              </div>

              {/* AI Natural Input */}
              <div className="flex-1 max-w-xl">
                <form
                  onSubmit={(e) => {
                    e.preventDefault()
                    handleRunAiSearch(aiInput)
                  }}
                  className="relative flex items-center"
                >
                  <input
                    type="text"
                    value={aiInput}
                    onChange={(e) => setAiInput(e.target.value)}
                    placeholder={
                      isEn
                        ? 'Ask AI: e.g. "My cat is neutered and needs weight control food"...'
                        : 'از هوش مصنوعی بپرسید: مثلاً «گربه من عقیم شده و اضافه وزن داره چی پیشنهاد میدین؟»...'
                    }
                    className="w-full ps-10 pe-24 py-2.5 rounded-xl bg-surface border border-primary/40 text-xs sm:text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all shadow-inner"
                  />
                  <span className="absolute start-3 top-1/2 -translate-y-1/2 text-primary text-base">
                    ✨
                  </span>
                  <div className="absolute end-1.5 top-1/2 -translate-y-1/2 flex items-center gap-1">
                    {aiInput && (
                      <button
                        type="button"
                        onClick={handleClearAiSearch}
                        className="p-1 rounded-md text-muted-foreground hover:text-foreground text-xs cursor-pointer"
                      >
                        ✕
                      </button>
                    )}
                    <button
                      type="submit"
                      className="px-3 py-1.5 rounded-lg bg-gradient-gold text-charcoal-950 text-xs font-bold shadow-xs hover:opacity-90 transition-opacity cursor-pointer"
                    >
                      {isEn ? 'Ask AI' : 'جستجو'}
                    </button>
                  </div>
                </form>
              </div>
            </div>

            {/* Quick Prompt Chips */}
            <div className="mt-3.5 pt-3 border-t border-border/40 flex items-center gap-2 overflow-x-auto pb-1 scrollbar-thin">
              <span className="text-[11px] font-bold text-muted-foreground shrink-0">
                {isEn ? 'Suggested Questions:' : 'پرسش‌های پرتکرار:'}
              </span>
              {QUICK_AI_PROMPTS.map((prompt, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => handleRunAiSearch(prompt.query)}
                  className={`text-[11px] px-2.5 py-1 rounded-lg border font-semibold shrink-0 transition-all cursor-pointer ${
                    activeAiQuery === prompt.query
                      ? 'bg-primary text-charcoal-950 border-primary font-bold shadow-xs'
                      : 'bg-surface border-border text-foreground/80 hover:border-primary/60 hover:text-primary'
                  }`}
                >
                  {isEn ? prompt.labelEn : prompt.labelFa}
                </button>
              ))}
            </div>

            {/* Clinical Vet Guidance Banner (Appears when AI Search is active and generated advice) */}
            {activeAiQuery && aiResult && (
              <div className="mt-4 p-3.5 rounded-xl bg-gradient-to-r from-emerald-500/10 via-primary/10 to-transparent border border-emerald-500/30 flex items-start gap-3 animate-fade-in">
                <span className="text-xl shrink-0 mt-0.5">🩺</span>
                <div className="flex-1 text-xs">
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <strong className="text-emerald-400 font-bold">
                      {isEn ? 'Pet Boss Clinical AI Recommendation' : 'توصیه بالینی هوش مصنوعی کلینیک پت‌باس:'}
                    </strong>
                    <button
                      type="button"
                      onClick={handleClearAiSearch}
                      className="text-[10px] text-muted-foreground hover:text-foreground font-semibold cursor-pointer underline"
                    >
                      {isEn ? 'Clear AI Guidance' : 'بستن راهنما'}
                    </button>
                  </div>
                  <p className="text-foreground/90 leading-relaxed">
                    {isEn ? aiResult.adviceEn || aiResult.adviceFa : aiResult.adviceFa}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ═════════════════════════════════════════════════════════════ */}
      {/* 4. MAIN SHOPPING WORKSPACE (AMAZON / DIGIKALA SIDEBAR & GRID) */}
      {/* ═════════════════════════════════════════════════════════════ */}
      <section ref={productsSectionRef} className="container-site px-4 pt-6">
        {/* Active Filter Chips Bar */}
        {activeFiltersCount > 0 && (
          <div className="mb-5 p-3 rounded-2xl bg-surface-elevated border border-border/80 flex flex-wrap items-center gap-2 animate-fade-in">
            <span className="text-xs font-bold text-muted-foreground me-1">
              {isEn ? 'Active Filters:' : 'فیلترهای اعمال‌شده:'}
            </span>

            {/* AI Query Chip */}
            {activeAiQuery && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-primary/20 text-primary border border-primary/30">
                <span>🤖 {activeAiQuery}</span>
                <button
                  type="button"
                  onClick={handleClearAiSearch}
                  className="hover:text-red-400 cursor-pointer"
                >
                  ✕
                </button>
              </span>
            )}

            {/* Keyword Search Chip */}
            {searchQuery.trim() && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-surface-card text-foreground border border-border">
                <span>🔍 {searchQuery}</span>
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="hover:text-red-400 cursor-pointer"
                >
                  ✕
                </button>
              </span>
            )}

            {/* Species Chip */}
            {speciesFilter !== 'all' && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-surface-card text-foreground border border-border">
                <span>
                  {speciesFilter === 'cat'
                    ? isEn ? '🐱 Cats' : '🐱 گربه‌ها'
                    : speciesFilter === 'dog'
                    ? isEn ? '🐶 Dogs' : '🐶 سگ‌ها'
                    : speciesFilter === 'health'
                    ? isEn ? '🩺 Health' : '🩺 سلامت و دارو'
                    : isEn ? '🎾 Toys' : '🎾 بازی و پوشاک'}
                </span>
                <button
                  type="button"
                  onClick={() => handleSpeciesChange('all')}
                  className="hover:text-red-400 cursor-pointer"
                >
                  ✕
                </button>
              </span>
            )}

            {/* Category Chip */}
            {selectedCategory !== 'all' && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-surface-card text-foreground border border-border">
                <span>
                  🏷️{' '}
                  {(() => {
                    const c = categories.find((cat) => cat.id === selectedCategory)
                    return isEn ? c?.nameEn || c?.nameFa : c?.nameFa
                  })()}
                </span>
                <button
                  type="button"
                  onClick={() => setSelectedCategory('all')}
                  className="hover:text-red-400 cursor-pointer"
                >
                  ✕
                </button>
              </span>
            )}

            {/* In-Stock Chip */}
            {onlyInStock && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                <span>● {isEn ? 'In Stock Only' : 'فقط کالاهای موجود'}</span>
                <button
                  type="button"
                  onClick={() => setOnlyInStock(false)}
                  className="hover:text-red-400 cursor-pointer"
                >
                  ✕
                </button>
              </span>
            )}

            {/* Discounted Chip */}
            {onlyDiscounted && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-500/10 text-amber-400 border border-amber-500/30">
                <span>🏷️ {isEn ? 'On Sale' : 'کالاهای تخفیف‌دار'}</span>
                <button
                  type="button"
                  onClick={() => setOnlyDiscounted(false)}
                  className="hover:text-red-400 cursor-pointer"
                >
                  ✕
                </button>
              </span>
            )}

            {/* Brand Chip */}
            {selectedBrand !== 'all' && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-surface-card text-foreground border border-border">
                <span>🏢 {selectedBrand}</span>
                <button
                  type="button"
                  onClick={() => setSelectedBrand('all')}
                  className="hover:text-red-400 cursor-pointer"
                >
                  ✕
                </button>
              </span>
            )}

            {/* Special Needs Chips */}
            {selectedNeeds.map((needKey) => {
              const def = SPECIAL_NEEDS_LEXICON[needKey]
              if (!def) return null
              return (
                <span
                  key={needKey}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-primary/10 text-primary border border-primary/20"
                >
                  <span>✨ {isEn ? def.en : def.fa}</span>
                  <button
                    type="button"
                    onClick={() =>
                      setSelectedNeeds((prev) => prev.filter((k) => k !== needKey))
                    }
                    className="hover:text-red-400 cursor-pointer"
                  >
                    ✕
                  </button>
                </span>
              )
            })}

            {/* Price Chip */}
            {(typeof minPrice === 'number' || typeof maxPrice === 'number') && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-surface-card text-foreground border border-border">
                <span>
                  💰{' '}
                  {typeof minPrice === 'number'
                    ? isEn
                      ? `From ${minPrice.toLocaleString()}`
                      : `از ${toPersianDigits(minPrice.toLocaleString())}`
                    : ''}
                  {typeof maxPrice === 'number'
                    ? isEn
                      ? ` Up to ${maxPrice.toLocaleString()}`
                      : ` تا ${toPersianDigits(maxPrice.toLocaleString())}`
                    : ''}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setMinPrice('')
                    setMaxPrice('')
                  }}
                  className="hover:text-red-400 cursor-pointer"
                >
                  ✕
                </button>
              </span>
            )}

            {/* Clear All Button */}
            <button
              type="button"
              onClick={handleResetAllFilters}
              className="ms-auto text-xs font-bold text-red-400 hover:text-red-300 transition-colors flex items-center gap-1 cursor-pointer"
            >
              <span>🗑️</span>
              <span>{isEn ? 'Clear All Filters' : 'حذف همه فیلترها'}</span>
            </button>
          </div>
        )}

        {/* 2-Column Responsive Layout: Sidebar & Products */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8 items-start">
          {/* ═════════════════════════════════════════════════════════ */}
          {/* DESKTOP FILTER SIDEBAR (Col 1 - Digikala & Amazon Style) */}
          {/* ═════════════════════════════════════════════════════════ */}
          <aside className="hidden lg:block lg:col-span-1 sticky top-24 space-y-5 rounded-3xl bg-surface-elevated/80 border border-border/80 p-5 shadow-sm max-h-[calc(100vh-7rem)] overflow-y-auto scrollbar-thin">
            {/* Sidebar Header */}
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <h3 className="font-extrabold text-foreground text-sm flex items-center gap-2">
                <span>🎛️</span>
                <span>{isEn ? 'Filters & Criteria' : 'فیلترهای پیشرفته'}</span>
              </h3>
              {activeFiltersCount > 0 && (
                <button
                  type="button"
                  onClick={handleResetAllFilters}
                  className="text-xs font-bold text-primary hover:underline cursor-pointer"
                >
                  {isEn ? 'Clear' : 'حذف فیلترها'}
                </button>
              )}
            </div>

            {/* Quick Switch: In Stock Only */}
            <div className="flex items-center justify-between p-3 rounded-2xl bg-surface border border-border hover:border-primary/40 transition-colors">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-xs font-bold text-foreground">
                  {isEn ? 'In-Stock Only' : 'فقط کالاهای موجود'}
                </span>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={onlyInStock}
                  onChange={(e) => setOnlyInStock(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-9 h-5 bg-charcoal-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-500" />
              </label>
            </div>

            {/* Quick Switch: Discounted Only */}
            <div className="flex items-center justify-between p-3 rounded-2xl bg-surface border border-border hover:border-primary/40 transition-colors">
              <div className="flex items-center gap-2">
                <span>🏷️</span>
                <span className="text-xs font-bold text-foreground">
                  {isEn ? 'On Sale / Deals' : 'کالاهای تخفیف‌دار و حراج'}
                </span>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={onlyDiscounted}
                  onChange={(e) => setOnlyDiscounted(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-9 h-5 bg-charcoal-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary" />
              </label>
            </div>

            {/* Species Filter Pills */}
            <div className="space-y-2 pt-2 border-t border-border/60">
              <h4 className="text-xs font-bold text-foreground/90">
                {isEn ? 'Pet Species' : 'نوع حیوان خانگی'}
              </h4>
              <div className="grid grid-cols-2 gap-1.5">
                {[
                  { id: 'all', labelFa: '✨ همه', labelEn: 'All' },
                  { id: 'cat', labelFa: '🐱 گربه‌ها', labelEn: 'Cats' },
                  { id: 'dog', labelFa: '🐶 سگ‌ها', labelEn: 'Dogs' },
                  { id: 'health', labelFa: '🩺 سلامت', labelEn: 'Health' },
                ].map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => handleSpeciesChange(s.id as SpeciesFilter)}
                    className={`py-2 px-2.5 rounded-xl text-xs font-bold text-center transition-all cursor-pointer ${
                      speciesFilter === s.id
                        ? 'bg-primary text-charcoal-950 shadow-gold'
                        : 'bg-surface border border-border text-foreground/80 hover:border-primary/50'
                    }`}
                  >
                    {isEn ? s.labelEn : s.labelFa}
                  </button>
                ))}
              </div>
            </div>

            {/* Category Filter List */}
            <div className="space-y-2 pt-2 border-t border-border/60">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-foreground/90">
                  {isEn ? 'Categories' : 'دسته‌بندی کالا'}
                </h4>
                {selectedCategory !== 'all' && (
                  <button
                    type="button"
                    onClick={() => setSelectedCategory('all')}
                    className="text-[10px] text-primary hover:underline cursor-pointer"
                  >
                    {isEn ? 'Reset' : 'همه'}
                  </button>
                )}
              </div>
              <div className="max-h-48 overflow-y-auto space-y-1 pe-1 scrollbar-thin">
                <button
                  type="button"
                  onClick={() => setSelectedCategory('all')}
                  className={`w-full text-start px-2.5 py-1.5 rounded-xl text-xs font-medium flex items-center justify-between transition-colors cursor-pointer ${
                    selectedCategory === 'all'
                      ? 'bg-primary/20 text-primary font-bold'
                      : 'text-muted-foreground hover:bg-surface hover:text-foreground'
                  }`}
                >
                  <span>{isEn ? 'All Categories' : 'همه دسته‌ها'}</span>
                  <span className="text-[10px] font-mono">{totalSpeciesProductsCount}</span>
                </button>
                {visibleCategories.map((cat) => {
                  const isSelected = selectedCategory === cat.id
                  const count = categoryCounts.get(cat.id) ?? cat._count?.products ?? 0
                  return (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => setSelectedCategory(cat.id)}
                      className={`w-full text-start px-2.5 py-1.5 rounded-xl text-xs font-medium flex items-center justify-between transition-colors cursor-pointer ${
                        isSelected
                          ? 'bg-primary/20 text-primary font-bold'
                          : 'text-muted-foreground hover:bg-surface hover:text-foreground'
                      }`}
                    >
                      <span className="truncate">
                        {isEn ? cat.nameEn || cat.nameFa : cat.nameFa}
                      </span>
                      <span className="text-[10px] font-mono shrink-0">{count}</span>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Price Range Filter (Digikala style) */}
            <div className="space-y-3 pt-2 border-t border-border/60">
              <h4 className="text-xs font-bold text-foreground/90">
                {isEn ? 'Price Range (Tomans)' : 'محدوده قیمت (تومان)'}
              </h4>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <span className="text-[10px] text-muted-foreground block mb-1">
                    {isEn ? 'Min Price' : 'حداقل قیمت'}
                  </span>
                  <input
                    type="number"
                    value={minPrice}
                    placeholder={catalogMinPrice > 0 ? catalogMinPrice.toString() : '۰'}
                    onChange={(e) =>
                      setMinPrice(e.target.value === '' ? '' : Number(e.target.value))
                    }
                    className="w-full px-2.5 py-1.5 rounded-xl bg-surface border border-border text-xs text-foreground focus:outline-none focus:border-primary"
                  />
                </div>
                <div>
                  <span className="text-[10px] text-muted-foreground block mb-1">
                    {isEn ? 'Max Price' : 'حداکثر قیمت'}
                  </span>
                  <input
                    type="number"
                    value={maxPrice}
                    placeholder={catalogMaxPrice.toString()}
                    onChange={(e) =>
                      setMaxPrice(e.target.value === '' ? '' : Number(e.target.value))
                    }
                    className="w-full px-2.5 py-1.5 rounded-xl bg-surface border border-border text-xs text-foreground focus:outline-none focus:border-primary"
                  />
                </div>
              </div>

              {/* Quick Price Bracket Chips */}
              <div className="flex flex-wrap gap-1">
                {[
                  { labelFa: 'زیر ۵۰۰ ت', labelEn: '< 500k', min: 0, max: 500000 },
                  { labelFa: '۵۰۰ ت تا ۱.۵ م', labelEn: '500k - 1.5M', min: 500000, max: 1500000 },
                  { labelFa: '۱.۵ م تا ۳ م', labelEn: '1.5M - 3M', min: 1500000, max: 3000000 },
                  { labelFa: 'بالای ۳ م', labelEn: '> 3M', min: 3000000, max: '' },
                ].map((b, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => {
                      setMinPrice(b.min)
                      setMaxPrice(b.max as number | '')
                    }}
                    className="text-[10px] px-2 py-0.5 rounded-md bg-surface border border-border hover:border-primary text-muted-foreground hover:text-foreground cursor-pointer transition-colors"
                  >
                    {isEn ? b.labelEn : b.labelFa}
                  </button>
                ))}
              </div>
            </div>

            {/* Special Care & Dietary Needs Filter */}
            <div className="space-y-2 pt-2 border-t border-border/60">
              <h4 className="text-xs font-bold text-foreground/90">
                {isEn ? 'Special Dietary & Clinical Needs' : 'نیازهای درمانی و مراقبتی'}
              </h4>
              <div className="space-y-1.5 max-h-44 overflow-y-auto pe-1 scrollbar-thin">
                {Object.entries(SPECIAL_NEEDS_LEXICON).map(([key, def]) => {
                  const isChecked = selectedNeeds.includes(key)
                  return (
                    <label
                      key={key}
                      className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedNeeds((prev) => [...prev, key])
                          } else {
                            setSelectedNeeds((prev) => prev.filter((k) => k !== key))
                          }
                        }}
                        className="rounded text-primary focus:ring-primary cursor-pointer"
                      />
                      <span className={isChecked ? 'text-primary font-bold' : ''}>
                        {isEn ? def.en : def.fa}
                      </span>
                    </label>
                  )
                })}
              </div>
            </div>

            {/* Brands Filter */}
            {availableBrands.length > 0 && (
              <div className="space-y-2 pt-2 border-t border-border/60">
                <h4 className="text-xs font-bold text-foreground/90">
                  {isEn ? 'Brand / Manufacturer' : 'برند کالا'}
                </h4>
                <div className="max-h-36 overflow-y-auto space-y-1 pe-1 scrollbar-thin">
                  <button
                    type="button"
                    onClick={() => setSelectedBrand('all')}
                    className={`w-full text-start px-2 py-1 rounded-lg text-xs flex items-center justify-between cursor-pointer ${
                      selectedBrand === 'all'
                        ? 'bg-primary/20 text-primary font-bold'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    <span>{isEn ? 'All Brands' : 'همه برندها'}</span>
                  </button>
                  {availableBrands.map((b) => (
                    <button
                      key={b.name}
                      type="button"
                      onClick={() => setSelectedBrand(b.name)}
                      className={`w-full text-start px-2 py-1 rounded-lg text-xs flex items-center justify-between cursor-pointer ${
                        selectedBrand === b.name
                          ? 'bg-primary/20 text-primary font-bold'
                          : 'text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      <span className="truncate">{b.name}</span>
                      <span className="text-[10px] font-mono shrink-0">{b.count}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </aside>

          {/* ═════════════════════════════════════════════════════════ */}
          {/* MAIN PRODUCT CATALOG (Col 2,3,4) */}
          {/* ═════════════════════════════════════════════════════════ */}
          <main className="lg:col-span-3 space-y-6">
            {/* Top Toolbar: Search, Sort Tabs, View Switcher & Mobile Filter Trigger */}
            <div className="p-4 rounded-3xl bg-surface-elevated/90 border border-border/80 shadow-sm space-y-3">
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                {/* Instant Search Input */}
                <div className="relative flex-1">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="absolute start-3 top-1/2 -translate-y-1/2 text-muted-foreground"
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
                        ? 'Search products, brands, or barcode SKU...'
                        : 'جستجوی کالا، برند (رویال کنین، بابین...) یا بارکد...'
                    }
                    className="w-full ps-9 pe-8 py-2 rounded-xl bg-surface border border-border text-xs sm:text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary transition-all"
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => setSearchQuery('')}
                      className="absolute end-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground text-xs cursor-pointer"
                    >
                      ✕
                    </button>
                  )}
                </div>

                {/* Mobile Filter Trigger Button */}
                <button
                  type="button"
                  onClick={() => setIsMobileFiltersOpen(true)}
                  className="lg:hidden px-4 py-2 rounded-xl bg-surface border border-primary/50 text-foreground text-xs font-bold flex items-center justify-center gap-2 shadow-sm cursor-pointer"
                >
                  <span>🎛️</span>
                  <span>{isEn ? 'Filters' : 'فیلترها'}</span>
                  {activeFiltersCount > 0 && (
                    <span className="w-5 h-5 rounded-full bg-primary text-charcoal-950 text-[10px] font-black flex items-center justify-center">
                      {activeFiltersCount}
                    </span>
                  )}
                </button>

                {/* View Mode Switcher (Grid vs List) */}
                <div className="hidden sm:flex items-center gap-1 bg-surface p-1 rounded-xl border border-border">
                  <button
                    type="button"
                    onClick={() => setViewMode('grid')}
                    title={isEn ? 'Grid View' : 'نمایش شبکه‌ای'}
                    className={`p-1.5 rounded-lg text-xs cursor-pointer transition-colors ${
                      viewMode === 'grid'
                        ? 'bg-primary text-charcoal-950 font-bold'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="7" height="7" x="3" y="3" rx="1"/><rect width="7" height="7" x="14" y="3" rx="1"/><rect width="7" height="7" x="14" y="14" rx="1"/><rect width="7" height="7" x="3" y="14" rx="1"/></svg>
                  </button>
                  <button
                    type="button"
                    onClick={() => setViewMode('list')}
                    title={isEn ? 'List View' : 'نمایش لیستی'}
                    className={`p-1.5 rounded-lg text-xs cursor-pointer transition-colors ${
                      viewMode === 'list'
                        ? 'bg-primary text-charcoal-950 font-bold'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="8" x2="21" y1="6" y2="6"/><line x1="8" x2="21" y1="12" y2="12"/><line x1="8" x2="21" y1="18" y2="18"/><line x1="3" x2="3.01" y1="6" y2="6"/><line x1="3" x2="3.01" y1="12" y2="12"/><line x1="3" x2="3.01" y1="18" y2="18"/></svg>
                  </button>
                </div>
              </div>

              {/* Bottom Row: Digikala Style Sort Tabs & Product Counter */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pt-2 border-t border-border/40 text-xs">
                {/* Sort Bar (Tabs on Desktop, Dropdown on Mobile) */}
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 max-w-full scrollbar-thin">
                  <span className="text-muted-foreground font-semibold shrink-0 me-1">
                    {isEn ? 'Sort by:' : 'مرتب‌سازی:'}
                  </span>
                  {[
                    { id: 'featured', labelFa: 'پرفروش‌ترین', labelEn: 'Featured' },
                    { id: 'newest', labelFa: 'جدیدترین', labelEn: 'Newest' },
                    { id: 'priceAsc', labelFa: 'ارزان‌ترین', labelEn: 'Price: Low' },
                    { id: 'priceDesc', labelFa: 'گران‌ترین', labelEn: 'Price: High' },
                    { id: 'discount', labelFa: 'بیشترین تخفیف', labelEn: 'Best Discount' },
                    { id: 'inStock', labelFa: 'موجود در انبار', labelEn: 'In Stock' },
                  ].map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => setSortBy(s.id as SortOption)}
                      className={`px-2.5 py-1 rounded-lg shrink-0 font-medium transition-all cursor-pointer ${
                        sortBy === s.id
                          ? 'bg-primary text-charcoal-950 font-bold shadow-xs'
                          : 'text-muted-foreground hover:bg-surface hover:text-foreground'
                      }`}
                    >
                      {isEn ? s.labelEn : s.labelFa}
                    </button>
                  ))}
                </div>

                {/* Counter */}
                <span className="text-muted-foreground shrink-0">
                  {isEn ? (
                    <>
                      Showing <strong className="text-foreground">{visibleProducts.length}</strong> of{' '}
                      <strong className="text-foreground">{filteredProducts.length}</strong> items
                    </>
                  ) : (
                    <>
                      نمایش <strong className="text-foreground">{toPersianDigits(visibleProducts.length)}</strong> از{' '}
                      <strong className="text-foreground">{toPersianDigits(filteredProducts.length)}</strong> محصول
                    </>
                  )}
                </span>
              </div>
            </div>

            {/* Products Render: Grid or List */}
            {filteredProducts.length === 0 ? (
              <div className="text-center py-20 bg-surface-elevated rounded-3xl border border-border p-8 max-w-xl mx-auto my-6">
                <span className="text-4xl mb-4 block">🔍</span>
                <h3 className="text-lg font-bold text-foreground mb-2">
                  {isEn ? 'No products match your filters' : 'محصولی با این مشخصات یافت نشد'}
                </h3>
                <p className="text-xs text-muted-foreground mb-6">
                  {isEn
                    ? 'Try clearing some filters or searching with a different term.'
                    : 'لطفاً برخی فیلترها را حذف کرده یا عبارت جستجو را تغییر دهید.'}
                </p>
                <button
                  type="button"
                  onClick={handleResetAllFilters}
                  className="px-5 py-2.5 rounded-xl bg-gradient-gold text-charcoal-950 text-xs font-bold shadow-gold cursor-pointer"
                >
                  {isEn ? 'Reset All Filters' : 'حذف همه فیلترها و مشاهده همه'}
                </button>
              </div>
            ) : viewMode === 'grid' ? (
              /* GRID VIEW */
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5">
                {visibleProducts.map((product) => {
                  const pName = isEn ? product.nameEn || product.nameFa : product.nameFa
                  const pDesc = isEn ? product.shortDescEn || product.shortDescFa : product.shortDescFa
                  const catName = isEn
                    ? product.category.nameEn || product.category.nameFa
                    : product.category.nameFa
                  const isInStock = product.stockStatus === 'IN_STOCK'
                  const productImage =
                    product.images?.[0]?.imageId ||
                    product.category.imageId ||
                    '/images/categories/other.jpg'
                  const isBase64 = productImage.startsWith('data:')
                  const hasDiscount = product.comparePrice && product.comparePrice > product.price
                  const discountPercent = hasDiscount
                    ? Math.round(((product.comparePrice! - product.price) / product.comparePrice!) * 100)
                    : 0

                  const whatsappText = encodeURIComponent(
                    `سلام وقت بخیر، درخواست استعلام موجودی و خرید محصول "${product.nameFa}" ${
                      product.sku ? `با کد ${product.sku}` : ''
                    } در پت‌شاپ کلینیک پت‌باس را دارم.`
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
                      {/* Image Frame */}
                      <div className="relative aspect-[4/3] w-full bg-gradient-to-br from-charcoal-900 to-charcoal-950 overflow-hidden border-b border-border/50 flex items-center justify-center text-center">
                        <div className="absolute inset-0 opacity-10 bg-[radial-gradient(#d4af37_1px,transparent_1px)] [background-size:16px_16px]" />

                        {/* Top Badges: Stock Status & Discount */}
                        <div className="absolute top-2.5 start-2.5 z-20 flex flex-col gap-1 items-start">
                          {isInStock ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 backdrop-blur-sm">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                              {isEn ? 'In Stock' : 'موجود در کلینیک'}
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30 backdrop-blur-sm">
                              {isEn ? 'Inquire / Order' : 'سفارشی / استعلام'}
                            </span>
                          )}
                          {hasDiscount && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-red-500 text-white shadow-xs">
                              {isEn ? `${discountPercent}% OFF` : `${toPersianDigits(discountPercent)}٪ تخفیف`}
                            </span>
                          )}
                        </div>

                        {/* SKU Badge */}
                        {product.sku && (
                          <button
                            type="button"
                            onClick={() => handleCopySku(product.sku!)}
                            title={isEn ? 'Click to copy SKU' : 'برای کپی کد کالا کلیک کنید'}
                            className="absolute top-2.5 end-2.5 z-20 text-[10px] font-mono px-2 py-0.5 rounded-md bg-surface/85 text-muted-foreground border border-border hover:border-primary transition-colors cursor-pointer backdrop-blur-sm"
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

                        {/* Quick View Button on Hover */}
                        <div className="absolute inset-0 z-10 bg-charcoal-950/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2 p-4 backdrop-blur-xs">
                          <button
                            type="button"
                            onClick={() => setActiveModalProduct(product)}
                            className="px-4 py-2 rounded-xl bg-surface-elevated border border-primary text-primary font-bold text-xs hover:bg-primary hover:text-charcoal-950 transition-all shadow-gold cursor-pointer"
                          >
                            👁️ {isEn ? 'Details & Bundles' : 'مشاهده جزئیات و اقلام مکمل'}
                          </button>
                        </div>
                      </div>

                      {/* Card Body */}
                      <div className="p-4 flex flex-col flex-grow">
                        <span className="text-[11px] font-semibold text-primary/90 mb-1 block">
                          {catName}
                        </span>

                        <h3 className="text-sm font-bold text-foreground leading-snug mb-1.5 group-hover:text-primary transition-colors line-clamp-2">
                          {pName}
                        </h3>

                        {pDesc && (
                          <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2 mb-3 flex-grow">
                            {pDesc}
                          </p>
                        )}

                        {/* Price & Actions */}
                        <div className="pt-3 border-t border-border/60 mt-auto flex flex-col gap-2.5">
                          <div className="flex items-center justify-between">
                            <span className="text-[11px] text-muted-foreground">
                              {isEn ? 'Price:' : 'قیمت:'}
                            </span>
                            <div className="text-end">
                              {hasDiscount && (
                                <span className="block text-[11px] text-muted-foreground line-through">
                                  {formatPrice(product.comparePrice, isEn ? 'en' : 'fa')}
                                </span>
                              )}
                              <span className="text-sm font-extrabold text-foreground tracking-tight text-gradient-gold">
                                {formatPrice(product.price, isEn ? 'en' : 'fa')}
                              </span>
                            </div>
                          </div>

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
                                className="w-full py-2 px-2 rounded-xl bg-gradient-gold hover:opacity-95 text-charcoal-950 text-xs font-bold text-center shadow-gold transition-all flex items-center justify-center gap-1"
                              >
                                <span>💬</span>
                                <span>{isEn ? 'Order' : 'سفارش'}</span>
                              </a>
                            ) : (
                              <a
                                href={telUrl}
                                className="w-full py-2 px-2 rounded-xl bg-gradient-gold hover:opacity-95 text-charcoal-950 text-xs font-bold text-center shadow-gold transition-all flex items-center justify-center gap-1"
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
              </div>
            ) : (
              /* LIST VIEW */
              <div className="space-y-3">
                {visibleProducts.map((product) => {
                  const pName = isEn ? product.nameEn || product.nameFa : product.nameFa
                  const pDesc = isEn ? product.shortDescEn || product.shortDescFa : product.shortDescFa
                  const catName = isEn
                    ? product.category.nameEn || product.category.nameFa
                    : product.category.nameFa
                  const isInStock = product.stockStatus === 'IN_STOCK'
                  const productImage =
                    product.images?.[0]?.imageId ||
                    product.category.imageId ||
                    '/images/categories/other.jpg'
                  const isBase64 = productImage.startsWith('data:')
                  const hasDiscount = product.comparePrice && product.comparePrice > product.price

                  const whatsappText = encodeURIComponent(
                    `سلام وقت بخیر، درخواست استعلام موجودی و خرید محصول "${product.nameFa}" ${
                      product.sku ? `با کد ${product.sku}` : ''
                    } در پت‌شاپ کلینیک پت‌باس را دارم.`
                  )
                  const whatsappUrl = whatsappNumber
                    ? `https://wa.me/${whatsappNumber.replace(/\D/g, '')}?text=${whatsappText}`
                    : null
                  const telUrl = `tel:${phone.replace(/\s+/g, '')}`

                  return (
                    <div
                      key={product.id}
                      className="card-luxury rounded-2xl overflow-hidden border border-border hover:border-primary/60 transition-all p-3 sm:p-4 flex flex-col sm:flex-row items-stretch sm:items-center gap-4 hover:shadow-gold"
                    >
                      {/* Image */}
                      <div className="relative w-full sm:w-32 h-32 sm:h-28 rounded-xl overflow-hidden bg-charcoal-900 shrink-0">
                        <Image
                          src={productImage}
                          alt={pName}
                          fill
                          unoptimized={isBase64}
                          className="object-cover"
                        />
                        {isInStock ? (
                          <span className="absolute top-2 start-2 w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                        ) : null}
                      </div>

                      {/* Info */}
                      <div className="flex-1 space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="text-[11px] font-semibold text-primary">{catName}</span>
                          {product.sku && (
                            <span className="text-[10px] font-mono text-muted-foreground bg-surface px-1.5 py-0.5 rounded border border-border">
                              {product.sku}
                            </span>
                          )}
                        </div>
                        <h3 className="text-sm font-bold text-foreground hover:text-primary transition-colors">
                          {pName}
                        </h3>
                        {pDesc && <p className="text-xs text-muted-foreground line-clamp-1">{pDesc}</p>}
                      </div>

                      {/* Price & Actions */}
                      <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-center gap-2 shrink-0 border-t sm:border-t-0 sm:border-s border-border pt-3 sm:pt-0 sm:ps-4">
                        <div className="text-start sm:text-end">
                          {hasDiscount && (
                            <span className="block text-[11px] text-muted-foreground line-through">
                              {formatPrice(product.comparePrice, isEn ? 'en' : 'fa')}
                            </span>
                          )}
                          <span className="text-sm font-black text-gradient-gold">
                            {formatPrice(product.price, isEn ? 'en' : 'fa')}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setActiveModalProduct(product)}
                            className="px-3 py-1.5 rounded-xl bg-surface border border-border text-foreground hover:border-primary text-xs font-semibold cursor-pointer"
                          >
                            {isEn ? 'Details' : 'جزئیات'}
                          </button>
                          {whatsappUrl ? (
                            <a
                              href={whatsappUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="px-3 py-1.5 rounded-xl bg-gradient-gold text-charcoal-950 text-xs font-bold shadow-xs hover:opacity-90"
                            >
                              💬 {isEn ? 'Order' : 'سفارش'}
                            </a>
                          ) : (
                            <a
                              href={telUrl}
                              className="px-3 py-1.5 rounded-xl bg-gradient-gold text-charcoal-950 text-xs font-bold shadow-xs hover:opacity-90"
                            >
                              📞 {isEn ? 'Call' : 'تماس'}
                            </a>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

            {/* Load More Pagination */}
            {visibleCount < filteredProducts.length && (
              <div className="mt-10 text-center">
                <button
                  type="button"
                  onClick={() => setVisibleCount((prev) => prev + PAGE_SIZE)}
                  className="px-8 py-3.5 rounded-2xl bg-surface-card border-2 border-primary/40 hover:border-primary text-foreground text-sm font-bold shadow-gold transition-all duration-300 hover:scale-[1.02] active:scale-[0.98] cursor-pointer inline-flex items-center gap-3"
                >
                  <span>✨ {isEn ? 'Load More Products' : 'مشاهده محصولات بیشتر'}</span>
                  <span className="text-xs px-2.5 py-0.5 rounded-full bg-primary/20 text-primary font-mono font-bold">
                    {isEn
                      ? `${visibleProducts.length} of ${filteredProducts.length}`
                      : `${toPersianDigits(visibleProducts.length)} از ${toPersianDigits(
                          filteredProducts.length
                        )}`}
                  </span>
                </button>
              </div>
            )}
          </main>
        </div>

        {/* ═════════════════════════════════════════════════════════════ */}
        {/* 5. VETERINARY ADVISORY & CLINICAL QUALITY ASSURANCE BANNER */}
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
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
                  </svg>
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
      </section>

      {/* ═════════════════════════════════════════════════════════════ */}
      {/* 6. MOBILE FILTER SLIDE-OVER DRAWER */}
      {/* ═════════════════════════════════════════════════════════════ */}
      {isMobileFiltersOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-charcoal-950/80 backdrop-blur-sm animate-fade-in"
          onClick={() => setIsMobileFiltersOpen(false)}
        >
          <div
            className="w-full sm:max-w-md max-h-[85vh] bg-surface-elevated rounded-t-3xl sm:rounded-3xl border border-border p-6 overflow-y-auto space-y-5 shadow-gold-lg flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <h3 className="font-extrabold text-foreground text-sm flex items-center gap-2">
                <span>🎛️</span>
                <span>{isEn ? 'Filter Products' : 'فیلتر محصولات'}</span>
              </h3>
              <button
                type="button"
                onClick={() => setIsMobileFiltersOpen(false)}
                className="w-8 h-8 rounded-full bg-surface flex items-center justify-center text-muted-foreground hover:text-foreground text-xs cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* In-Stock Toggle */}
            <div className="flex items-center justify-between p-3 rounded-2xl bg-surface border border-border">
              <span className="text-xs font-bold text-foreground">
                {isEn ? 'In-Stock Only' : 'فقط کالاهای موجود'}
              </span>
              <input
                type="checkbox"
                checked={onlyInStock}
                onChange={(e) => setOnlyInStock(e.target.checked)}
                className="rounded text-primary focus:ring-primary w-5 h-5 cursor-pointer"
              />
            </div>

            {/* Discounted Toggle */}
            <div className="flex items-center justify-between p-3 rounded-2xl bg-surface border border-border">
              <span className="text-xs font-bold text-foreground">
                {isEn ? 'On Sale / Deals' : 'کالاهای تخفیف‌دار'}
              </span>
              <input
                type="checkbox"
                checked={onlyDiscounted}
                onChange={(e) => setOnlyDiscounted(e.target.checked)}
                className="rounded text-primary focus:ring-primary w-5 h-5 cursor-pointer"
              />
            </div>

            {/* Species */}
            <div className="space-y-2">
              <h4 className="text-xs font-bold text-foreground">
                {isEn ? 'Pet Species' : 'نوع حیوان'}
              </h4>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { id: 'all', labelFa: '✨ همه', labelEn: 'All' },
                  { id: 'cat', labelFa: '🐱 گربه‌ها', labelEn: 'Cats' },
                  { id: 'dog', labelFa: '🐶 سگ‌ها', labelEn: 'Dogs' },
                  { id: 'health', labelFa: '🩺 سلامت', labelEn: 'Health' },
                ].map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => handleSpeciesChange(s.id as SpeciesFilter)}
                    className={`py-2 px-2.5 rounded-xl text-xs font-bold text-center cursor-pointer ${
                      speciesFilter === s.id
                        ? 'bg-primary text-charcoal-950 font-bold'
                        : 'bg-surface border border-border text-foreground'
                    }`}
                  >
                    {isEn ? s.labelEn : s.labelFa}
                  </button>
                ))}
              </div>
            </div>

            {/* Category Filter for Mobile */}
            <div className="space-y-2 pt-2 border-t border-border">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-foreground">
                  {isEn ? 'Categories' : 'دسته‌بندی کالا'}
                </h4>
                {selectedCategory !== 'all' && (
                  <button
                    type="button"
                    onClick={() => setSelectedCategory('all')}
                    className="text-[10px] text-primary hover:underline cursor-pointer"
                  >
                    {isEn ? 'Reset' : 'همه'}
                  </button>
                )}
              </div>
              <div className="max-h-44 overflow-y-auto space-y-1 pe-1 scrollbar-thin">
                <button
                  type="button"
                  onClick={() => setSelectedCategory('all')}
                  className={`w-full text-start px-2.5 py-1.5 rounded-xl text-xs font-medium flex items-center justify-between transition-colors cursor-pointer ${
                    selectedCategory === 'all'
                      ? 'bg-primary/20 text-primary font-bold'
                      : 'text-muted-foreground hover:bg-surface hover:text-foreground'
                  }`}
                >
                  <span>{isEn ? 'All Categories' : 'همه دسته‌ها'}</span>
                  <span className="text-[10px] font-mono">{totalSpeciesProductsCount}</span>
                </button>
                {visibleCategories.map((cat) => {
                  const isSelected = selectedCategory === cat.id
                  const count = categoryCounts.get(cat.id) ?? cat._count?.products ?? 0
                  return (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => setSelectedCategory(cat.id)}
                      className={`w-full text-start px-2.5 py-1.5 rounded-xl text-xs font-medium flex items-center justify-between transition-colors cursor-pointer ${
                        isSelected
                          ? 'bg-primary/20 text-primary font-bold'
                          : 'text-muted-foreground hover:bg-surface hover:text-foreground'
                      }`}
                    >
                      <span className="truncate">
                        {isEn ? cat.nameEn || cat.nameFa : cat.nameFa}
                      </span>
                      <span className="text-[10px] font-mono shrink-0">{count}</span>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Apply & Reset Buttons */}
            <div className="pt-4 border-t border-border flex items-center gap-3">
              <button
                type="button"
                onClick={handleResetAllFilters}
                className="w-1/3 py-2.5 rounded-xl bg-surface border border-border text-xs font-bold text-muted-foreground hover:text-foreground cursor-pointer"
              >
                {isEn ? 'Reset' : 'حذف همه'}
              </button>
              <button
                type="button"
                onClick={() => setIsMobileFiltersOpen(false)}
                className="w-2/3 py-2.5 rounded-xl bg-gradient-gold text-charcoal-950 text-xs font-bold shadow-gold cursor-pointer"
              >
                {isEn
                  ? `Show Results (${filteredProducts.length})`
                  : `مشاهده نتایج (${toPersianDigits(filteredProducts.length)})`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═════════════════════════════════════════════════════════════ */}
      {/* 7. MODAL: PRODUCT DETAILS + AI THEMATIC RELATED PRODUCTS */}
      {/* ═════════════════════════════════════════════════════════════ */}
      {activeModalProduct && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-charcoal-950/85 backdrop-blur-md animate-fade-in"
          onClick={() => setActiveModalProduct(null)}
        >
          <div
            className="card-luxury rounded-3xl max-w-2xl w-full overflow-hidden border border-border-gold shadow-gold-lg max-h-[90vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between p-5 border-b border-border bg-surface-elevated">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-primary/10 text-primary border border-primary/30">
                  {isEn
                    ? activeModalProduct.category.nameEn || activeModalProduct.category.nameFa
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

            {/* Modal Scrollable Body */}
            <div className="p-6 overflow-y-auto space-y-6">
              {/* Product Image */}
              <div className="relative aspect-[16/10] w-full rounded-2xl overflow-hidden bg-charcoal-900 border border-border flex items-center justify-center">
                {(() => {
                  const modalImg =
                    activeModalProduct.images?.[0]?.imageId ||
                    activeModalProduct.category.imageId ||
                    '/images/categories/other.jpg'
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

              {/* Title & Brand */}
              <div>
                <h2 className="text-xl sm:text-2xl font-black text-foreground mb-1 leading-snug">
                  {isEn
                    ? activeModalProduct.nameEn || activeModalProduct.nameFa
                    : activeModalProduct.nameFa}
                </h2>
                {isEn && activeModalProduct.nameFa && (
                  <p className="text-xs text-muted-foreground font-mono">
                    {activeModalProduct.nameFa}
                  </p>
                )}
              </div>

              {/* Price & SKU */}
              <div className="p-4 rounded-2xl bg-surface-elevated border border-border-gold/30 flex items-center justify-between">
                <div>
                  <span className="text-xs font-semibold text-muted-foreground block mb-0.5">
                    {isEn ? 'Price:' : 'قیمت:'}
                  </span>
                  <div className="flex items-center gap-2">
                    {activeModalProduct.comparePrice &&
                      activeModalProduct.comparePrice > activeModalProduct.price && (
                        <span className="text-xs text-muted-foreground line-through">
                          {formatPrice(activeModalProduct.comparePrice, isEn ? 'en' : 'fa')}
                        </span>
                      )}
                    <span className="text-xl font-extrabold text-gradient-gold">
                      {formatPrice(activeModalProduct.price, isEn ? 'en' : 'fa')}
                    </span>
                  </div>
                </div>

                {activeModalProduct.sku && (
                  <div className="text-end">
                    <span className="text-[10px] text-muted-foreground block mb-0.5">
                      {isEn ? 'Barcode SKU' : 'کد کالا'}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleCopySku(activeModalProduct.sku!)}
                      className="text-xs font-mono font-bold text-foreground hover:text-primary transition-colors cursor-pointer"
                    >
                      {copiedSku === activeModalProduct.sku ? '✓ کپی شد' : activeModalProduct.sku}
                    </button>
                  </div>
                )}
              </div>

              {/* Description */}
              <div className="space-y-1.5">
                <h4 className="text-xs font-bold text-foreground uppercase tracking-wider">
                  {isEn ? 'Product Description & Guidance' : 'توضیحات و راهنمای مصرف'}
                </h4>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {activeModalProduct.shortDescFa ||
                    'این محصول با ضمانت تاریخ انقضای معتبر و نگهداری در شرایط دمایی استاندارد کلینیک پت باس عرضه می‌شود.'}
                </p>
              </div>

              {/* ═════════════════════════════════════════════════════════ */}
              {/* THEMATIC RELATED PRODUCTS (AI RECOMMENDED BUNDLE) */}
              {/* ═════════════════════════════════════════════════════════ */}
              {modalRecommendations && modalRecommendations.products.length > 0 && (
                <div className="pt-4 border-t border-border space-y-3">
                  <div className="flex items-center gap-2">
                    <span className="text-base">✨</span>
                    <h4 className="text-xs sm:text-sm font-extrabold text-foreground">
                      {isEn ? modalRecommendations.themeTitleEn : modalRecommendations.themeTitleFa}
                    </h4>
                  </div>
                  <p className="text-[11px] text-muted-foreground leading-relaxed bg-surface-elevated p-2.5 rounded-xl border border-border/80">
                    💡 {isEn ? modalRecommendations.reasonEn : modalRecommendations.reasonFa}
                  </p>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-1">
                    {modalRecommendations.products.map((rel) => {
                      const relImg =
                        rel.images?.[0]?.imageId ||
                        rel.category.imageId ||
                        '/images/categories/other.jpg'
                      const isBase64 = relImg.startsWith('data:')
                      return (
                        <div
                          key={rel.id}
                          onClick={() => setActiveModalProduct(rel)}
                          className="group p-2 rounded-xl bg-surface border border-border hover:border-primary/80 transition-all cursor-pointer flex flex-col justify-between hover:shadow-xs"
                        >
                          <div className="relative aspect-square w-full rounded-lg overflow-hidden bg-charcoal-900 mb-1.5">
                            <Image
                              src={relImg}
                              alt={rel.nameFa}
                              fill
                              unoptimized={isBase64}
                              className="object-cover group-hover:scale-105 transition-transform"
                            />
                          </div>
                          <div>
                            <span className="text-[9px] text-primary block truncate mb-0.5">
                              {rel.category.nameFa}
                            </span>
                            <h5 className="text-[11px] font-bold text-foreground line-clamp-1 group-hover:text-primary transition-colors">
                              {isEn ? rel.nameEn || rel.nameFa : rel.nameFa}
                            </h5>
                            <span className="text-[10px] font-extrabold text-gradient-gold mt-1 block">
                              {formatPrice(rel.price, isEn ? 'en' : 'fa')}
                            </span>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Veterinary Guarantee */}
              <div className="p-3.5 rounded-xl bg-primary/5 border border-primary/20 text-[11px] text-muted-foreground leading-relaxed flex items-start gap-2.5">
                <span className="text-primary text-base">🩺</span>
                <span>
                  {isEn
                    ? 'Authenticity & storage condition strictly certified by Pet Boss veterinary surgeons. For prescription diets, please consult our on-duty doctors.'
                    : 'اصالت فیزیکی، شرایط حمل و انقضای این کالا توسط دامپزشکان کلینیک پت باس تضمین شده است. جهت هماهنگی ارسال فوری پیک در تهران یا دریافت مشاوره تغذیه، با کلینیک تماس حاصل فرمایید.'}
                </span>
              </div>
            </div>

            {/* Actions */}
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
                    `سلام وقت بخیر، درخواست استعلام موجودی و خرید محصول "${activeModalProduct.nameFa}" ${
                      activeModalProduct.sku ? `با کد ${activeModalProduct.sku}` : ''
                    } را دارم.`
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
