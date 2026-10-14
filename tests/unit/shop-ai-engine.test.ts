import { describe, it, expect } from 'vitest'
import {
  normalizeSearchText,
  parseAIQueryIntent,
  scoreProductAIRelevance,
  getRelatedThematicProducts,
  getProductSpecies,
} from '@/lib/shop/ai-engine'
import { ShopProduct } from '@/components/shop/shop-catalog-client'

const mockProducts: ShopProduct[] = [
  {
    id: 'prod-1',
    categoryId: 'cat-dry',
    sku: 'PB-CAT-001',
    nameFa: 'غذای خشک گربه عقیم شده رویال کنین استریالایزد',
    nameEn: 'Royal Canin Sterilised Dry Cat Food',
    shortDescFa: 'فرمولاسیون اختصاصی تنظیم وزن و مجاری ادرار گربه عقیم شده',
    shortDescEn: 'Weight control and urinary care for neutered cats',
    price: 1850000,
    stockStatus: 'IN_STOCK',
    isActive: true,
    createdAt: new Date().toISOString(),
    category: {
      id: 'cat-dry',
      nameFa: 'غذای خشک گربه',
      nameEn: 'Dry Cat Food',
      slugFa: 'cat-dry-food',
    },
  },
  {
    id: 'prod-2',
    categoryId: 'cat-wet',
    sku: 'PB-CAT-002',
    nameFa: 'پوچ گربه عقیم شده رویال کنین ژله‌ای',
    nameEn: 'Royal Canin Sterilised Gravy Cat Pouch',
    shortDescFa: 'غذای تر آبرسان ویژه گربه‌های عقیم شده',
    shortDescEn: 'Hydrating wet food pouch for sterilized cats',
    price: 195000,
    stockStatus: 'IN_STOCK',
    isActive: true,
    createdAt: new Date().toISOString(),
    category: {
      id: 'cat-wet',
      nameFa: 'غذای تر و پوچ گربه',
      nameEn: 'Wet Cat Food',
      slugFa: 'cat-wet-food',
    },
  },
  {
    id: 'prod-3',
    categoryId: 'cat-treat',
    sku: 'PB-CAT-003',
    nameFa: 'خمیر مالت آنتی هربال جیم کت مخصوص گربه',
    nameEn: 'GimCat Anti-Hairball Malt Soft Paste for Cats',
    shortDescFa: 'دفع آسان گلوله مو از دستگاه گوارش گربه',
    shortDescEn: 'Gentle hairball excretion malt paste',
    price: 420000,
    stockStatus: 'IN_STOCK',
    isActive: true,
    createdAt: new Date().toISOString(),
    category: {
      id: 'cat-treat',
      nameFa: 'تشویقی و اسنک گربه',
      nameEn: 'Cat Treats',
      slugFa: 'cat-treats',
    },
  },
  {
    id: 'prod-4',
    categoryId: 'dog-dry',
    sku: 'PB-DOG-001',
    nameFa: 'غذای خشک توله سگ رویال کنین مینی پاپی',
    nameEn: 'Royal Canin Mini Puppy Dry Dog Food',
    shortDescFa: 'رشد بهینه، کلسیم استخوان‌ساز و تقویت ایمنی توله سگ',
    shortDescEn: 'Immune support and bone development for puppies',
    price: 1650000,
    stockStatus: 'IN_STOCK',
    isActive: true,
    createdAt: new Date().toISOString(),
    category: {
      id: 'dog-dry',
      nameFa: 'غذای خشک سگ',
      nameEn: 'Dry Dog Food',
      slugFa: 'dog-dry-food',
    },
  },
  {
    id: 'prod-5',
    categoryId: 'dog-treat',
    sku: 'PB-DOG-002',
    nameFa: 'تشویقی استخوان دندانی سگ تریکسی دنتال',
    nameEn: 'Trixie Denta Fun Dental Chew Bone for Dogs',
    shortDescFa: 'تمیزکننده پلاک دندان و جلوگیری از جرم دندانی سگ',
    shortDescEn: 'Plaque cleaning dental bone for canine oral health',
    price: 280000,
    stockStatus: 'IN_STOCK',
    isActive: true,
    createdAt: new Date().toISOString(),
    category: {
      id: 'dog-treat',
      nameFa: 'تشویقی و استخوان سگ',
      nameEn: 'Dog Treats',
      slugFa: 'dog-treats',
    },
  },
]

describe('Shop AI Search & Recommendation Engine', () => {
  it('normalizes Persian & English search strings and unifies characters', () => {
    const raw = '  غذاي گربهٔ عقيم‌شده ۱۲۳   '
    const normalized = normalizeSearchText(raw)
    expect(normalized).toBe('غذای گربه عقیم شده 123')
  })

  it('correctly detects intent for neutered/sterilised cats', () => {
    const intent = parseAIQueryIntent('گربه من تازه عقیم شده چی براش خوبه؟')
    expect(intent.detectedSpecies).toBe('cat')
    expect(intent.detectedNeeds).toContain('sterilised')
    expect(intent.adviceFa).toContain('عقیم‌سازی')
    expect(intent.adviceEn).toBeDefined()
  })

  it('correctly detects intent for puppies and junior dogs', () => {
    const intent = parseAIQueryIntent('غذای مناسب توله سگ ژرمن')
    expect(intent.detectedSpecies).toBe('dog')
    expect(intent.detectedLifeStage).toBe('junior')
    expect(intent.adviceFa).toContain('توله')
  })

  it('correctly detects hairball/malt intent', () => {
    const intent = parseAIQueryIntent('خمیر مالت برای دفع گلوله مو گربه')
    expect(intent.detectedSpecies).toBe('cat')
    expect(intent.detectedNeeds).toContain('hairball')
    expect(intent.adviceFa).toContain('مالت')
  })

  it('scores sterilised cat products higher than dog products for a sterilised cat query', () => {
    const query = 'غذای گربه عقیم شده'
    const intent = parseAIQueryIntent(query)

    const catScore = scoreProductAIRelevance(mockProducts[0], query, intent)
    const dogScore = scoreProductAIRelevance(mockProducts[3], query, intent)

    expect(catScore).toBeGreaterThan(dogScore)
    expect(catScore).toBeGreaterThan(50)
  })

  it('determines product species correctly', () => {
    expect(getProductSpecies(mockProducts[0])).toBe('cat')
    expect(getProductSpecies(mockProducts[3])).toBe('dog')
  })

  it('generates complementary thematic recommendations when a product is picked', () => {
    // Picked cat dry food
    const recommendations = getRelatedThematicProducts(mockProducts[0], mockProducts)

    expect(recommendations.products.length).toBeGreaterThan(0)
    // The complementary products should not include the picked product itself
    expect(recommendations.products.some((p) => p.id === mockProducts[0].id)).toBe(false)
    // The recommendations should be cat products (e.g. wet pouch or malt)
    expect(recommendations.products[0].category.slugFa).toContain('cat-wet-food')
    expect(recommendations.themeTitleFa).toContain('گربه')
    expect(recommendations.reasonFa).toBeDefined()
  })
})
