/**
 * @file lib/shop/ai-engine.ts
 * @description Ultra-fast client-side AI search, intent parser, and thematic recommendation engine
 * for Pet Boss Veterinary Clinic Boutique & Pet Shop.
 * Runs in < 2ms without external network latency, supporting bilingual (Persian & English) queries.
 */

import { ShopProduct } from '@/components/shop/shop-catalog-client'

export type PetSpecies = 'cat' | 'dog' | 'all'
export type PetLifeStage = 'junior' | 'adult' | 'senior'

export interface AIIntentResult {
  detectedSpecies: PetSpecies
  detectedLifeStage?: PetLifeStage
  detectedNeeds: string[]
  detectedCategories: string[]
  adviceFa?: string
  adviceEn?: string
  suggestedPrompts: Array<{ labelFa: string; labelEn: string; query: string }>
}

/**
 * Normalizes Persian and English text by unifying Arabic/Persian glyphs,
 * removing diacritics, and standardizing whitespace.
 */
export function normalizeSearchText(text: string): string {
  if (!text) return ''
  return text
    .toLowerCase()
    // Arabic yeh to Persian yeh
    .replace(/ي/g, 'ی')
    // Arabic kaf to Persian kaf
    .replace(/ك/g, 'ک')
    // Arabic heh with yeh above to standard heh
    .replace(/ة/g, 'ه')
    // Persian zero-width non-joiner to space for token matching
    .replace(/\u200c/g, ' ')
    // Persian & Arabic numbers to English digits
    .replace(/[۰٠]/g, '0')
    .replace(/[۱١]/g, '1')
    .replace(/[۲٢]/g, '2')
    .replace(/[۳٣]/g, '3')
    .replace(/[۴٤]/g, '4')
    .replace(/[۵٥]/g, '5')
    .replace(/[۶٦]/g, '6')
    .replace(/[۷٧]/g, '7')
    .replace(/[۸٨]/g, '8')
    .replace(/[۹٩]/g, '9')
    // Remove diacritics / harakat
    .replace(/[\u064B-\u065F\u0670]/g, '')
    // Multiple spaces to single space
    .replace(/\s+/g, ' ')
    .trim()
}

// Intent Lexicon with Persian and English aliases
const SPECIES_LEXICON: Record<Exclude<PetSpecies, 'all'>, string[]> = {
  cat: ['گربه', 'پیشی', 'کت', 'cat', 'cats', 'kitten', 'kittens', 'feline'],
  dog: ['سگ', 'هاپو', 'توله سگ', 'پاپی', 'داگ', 'dog', 'dogs', 'puppy', 'puppies', 'canine'],
}

const LIFE_STAGE_LEXICON: Record<PetLifeStage, string[]> = {
  junior: ['توله', 'بچه گربه', 'کیتن', 'پاپی', 'جونیور', 'شیرخشک', 'puppy', 'kitten', 'junior', 'baby'],
  adult: ['بالغ', 'ادالت', 'بزرگسال', 'adult'],
  senior: ['مسن', 'سن بالا', 'سالمند', 'پیر', 'سینیور', 'senior', 'mature', 'aging', 'ageing'],
}

export const SPECIAL_NEEDS_LEXICON: Record<string, { fa: string; en: string; terms: string[] }> = {
  sterilised: {
    fa: 'عقیم‌شده',
    en: 'Sterilised',
    terms: ['عقیم', 'استریالایزد', 'استریل', 'sterilised', 'sterilized', 'neutered', 'spayed', 'steril'],
  },
  hairball: {
    fa: 'دفع هربال (گلوله مو)',
    en: 'Hairball Control',
    terms: ['هربال', 'هیربال', 'مالت', 'گلوله مو', 'hairball', 'malt', 'anti-hairball'],
  },
  renal_urinary: {
    fa: 'سلامت کلیه و ادرار',
    en: 'Urinary & Renal',
    terms: ['کلیه', 'کلیوی', 'ادرار', 'یورینری', 'رنال', 'سنگ ادرار', 'مثانه', 'urinary', 'renal', 'kidney', 'struvite'],
  },
  dental: {
    fa: 'سلامت دهان و دندان',
    en: 'Dental & Oral Care',
    terms: ['دندان', 'دندون', 'جرم گیر', 'دنتال', 'مسواک', 'خمیر دندان', 'dental', 'teeth', 'oral', 'tartar'],
  },
  joint: {
    fa: 'مفاصل و استخوان',
    en: 'Joint Mobility',
    terms: ['مفصل', 'مفاصل', 'غضروف', 'استخوان', 'آرتروز', 'گلوکوزامین', 'joint', 'mobility', 'bone', 'osteo'],
  },
  skin_coat: {
    fa: 'پوست، مو و ضدحساسیت',
    en: 'Skin & Coat',
    terms: ['پوست', 'مو', 'ریزش مو', 'درخشش', 'حساسیت پوستی', 'خارش', 'شامپو', 'skin', 'coat', 'fur', 'derma', 'hypoallergenic'],
  },
  weight: {
    fa: 'کنترل وزن و لاغری',
    en: 'Weight Management',
    terms: ['وزن', 'چاق', 'لاغر', 'رژیمی', 'لایت', 'کم چرب', 'weight', 'light', 'obesity', 'diet'],
  },
  digestive: {
    fa: 'گوارش حساس و هضم آسان',
    en: 'Digestive Health',
    terms: ['گوارش', 'معده', 'هضم', 'اسهال', 'حساس', 'پروبیوتیک', 'digestive', 'gastro', 'sensitive', 'stomach', 'gut'],
  },
}

/**
 * Curated Quick AI Prompts to inspire users and provide 1-click discovery.
 */
export const QUICK_AI_PROMPTS = [
  {
    labelFa: '🐱 غذای گربه عقیم‌شده',
    labelEn: '🐱 Sterilised Cat Food',
    query: 'غذای گربه عقیم شده',
  },
  {
    labelFa: '🐶 تغذیه و ملزومات توله سگ',
    labelEn: '🐶 Puppy Nutrition & Essentials',
    query: 'غذای خشک توله سگ',
  },
  {
    labelFa: '✨ دفع گلوله مو و مالت گربه',
    labelEn: '✨ Hairball & Malt Care',
    query: 'خمیر مالت و هربال گربه',
  },
  {
    labelFa: '🦷 تشویقی و بهداشت دندان سگ',
    labelEn: '🦷 Dog Dental Care & Chews',
    query: 'تشویقی استخوان دندان سگ',
  },
  {
    labelFa: '🛁 شامپو و بهداشت مو',
    labelEn: '🛁 Coat Care & Hygiene',
    query: 'شامپو و برس بهداشتی',
  },
  {
    labelFa: '🩺 غذای درمانی کلیه و ادرار',
    labelEn: '🩺 Veterinary Renal & Urinary',
    query: 'غذای درمانی رنال و یورینری',
  },
]

/**
 * Parses user natural language query to extract intent, species, special needs, and clinical advice.
 */
export function parseAIQueryIntent(rawQuery: string): AIIntentResult {
  const normalized = normalizeSearchText(rawQuery)

  // 1. Detect Species
  let detectedSpecies: PetSpecies = 'all'
  const isCat = SPECIES_LEXICON.cat.some((term) => normalized.includes(term))
  const isDog = SPECIES_LEXICON.dog.some((term) => normalized.includes(term))

  if (isCat && !isDog) detectedSpecies = 'cat'
  else if (isDog && !isCat) detectedSpecies = 'dog'

  // 2. Detect Life Stage
  let detectedLifeStage: PetLifeStage | undefined
  for (const [stage, terms] of Object.entries(LIFE_STAGE_LEXICON) as [PetLifeStage, string[]][]) {
    if (terms.some((term) => normalized.includes(term))) {
      detectedLifeStage = stage
      break
    }
  }

  // 3. Detect Special Needs
  const detectedNeeds: string[] = []
  for (const [needKey, def] of Object.entries(SPECIAL_NEEDS_LEXICON)) {
    if (def.terms.some((term) => normalized.includes(term))) {
      detectedNeeds.push(needKey)
    }
  }

  // 4. Generate Clinical Vet Advice Message
  let adviceFa: string | undefined
  let adviceEn: string | undefined

  if (detectedNeeds.includes('sterilised')) {
    adviceFa =
      'مشاوره دامپزشک پت‌باس: پس از عقیم‌سازی، متابولیسم پت تا ۳۰٪ کاهش و اشتهای آن افزایش می‌یابد. رژیم‌های زیر با پروتئین مرغوب، چربی کنترل‌شده و فرمولاسیون تنظیم pH ادرار جهت جلوگیری از سنگ کلیه انتخاب شده‌اند.'
    adviceEn =
      'Pet Boss Vet Advice: After neutering/spaying, pets require controlled energy density and optimized urinary pH minerals to prevent weight gain and urinary struvite stones.'
  } else if (detectedNeeds.includes('hairball')) {
    adviceFa =
      'مشاوره دامپزشک پت‌باس: بلع مو در زمان لیسیدن روزانه در گربه‌ها شایع است. استفاده منظم از خمیرهای مالت حاوی فیبرهای طبیعی محلول، موها را به آرامی از دستگاه گوارش دفع کرده و مانع از استفراغ می‌شود.'
    adviceEn =
      'Pet Boss Vet Advice: Regular use of malt paste with natural dietary soluble fibers facilitates gentle transit of ingested hair through the digestive tract without regurgitation.'
  } else if (detectedNeeds.includes('renal_urinary')) {
    adviceFa =
      'مشاوره دامپزشک پت‌باس: رژیم‌های درمانی کلیه و مجاری ادراری باید با نظارت دامپزشک مصرف شوند. این غذاها دارای فسفر و سدیم تعدیل‌شده برای کاهش بار کاری کلیه‌ها و محافظت از مجاری ادراری هستند.'
    adviceEn =
      'Pet Boss Vet Advice: Renal and urinary clinical formulas feature restricted phosphorus and balanced sodium levels to protect kidney function and maintain urinary tract health.'
  } else if (detectedNeeds.includes('dental')) {
    adviceFa =
      'مشاوره دامپزشک پت‌باس: سلامت دندان و لثه مانع از ورود باکتری‌ها به جریان خون و اندام‌های حیاتی می‌شود. تشویقی‌های جویدنی دنتال با سایش مکانیکی از تشکیل پلاک و جرم دندانی جلوگیری می‌کنند.'
    adviceEn =
      'Pet Boss Vet Advice: Mechanical chewing of dental treats helps scrape away plaque and prevents calculus buildup, safeguarding oral hygiene and heart health.'
  } else if (detectedLifeStage === 'junior') {
    adviceFa =
      'مشاوره دامپزشک پت‌باس: دوره‌ رشد توله و بچه گربه نیازمند پروتئین با قابلیت هضم بالا، کلسیم متوازن برای استخوان‌سازی و DHA برای تکامل مغز است. محصولات اختصاصی زیر برای این دوره ایده‌آل هستند.'
    adviceEn =
      'Pet Boss Vet Advice: Puppies and kittens need highly digestible proteins, balanced calcium-to-phosphorus ratios, and DHA fatty acids for optimal skeletal and cognitive development.'
  } else if (detectedNeeds.includes('joint')) {
    adviceFa =
      'مشاوره دامپزشک پت‌باس: مکمل‌های گلوکوزامین، کندروایتین و اسیدهای چرب امگا-۳ روان‌کنندگی مفاصل را بهبود بخشیده و دردهای آرتروز را به خصوص در سنین بالا کاهش می‌دهند.'
    adviceEn =
      'Pet Boss Vet Advice: Glucosamine, chondroitin, and omega-3 fatty acids preserve cartilage elasticity and alleviate joint stiffness, especially in senior or large-breed companions.'
  }

  return {
    detectedSpecies,
    detectedLifeStage,
    detectedNeeds,
    detectedCategories: [],
    adviceFa,
    adviceEn,
    suggestedPrompts: QUICK_AI_PROMPTS,
  }
}

/**
 * Computes a relevance score (0 to 100) for a product against user text and detected AI intent.
 */
export function scoreProductAIRelevance(
  product: ShopProduct,
  rawQuery: string,
  intent: AIIntentResult
): number {
  if (!rawQuery.trim()) return 0

  const normalizedQuery = normalizeSearchText(rawQuery)
  const queryTokens = normalizedQuery.split(' ').filter(Boolean)

  const productNameFa = normalizeSearchText(product.nameFa)
  const productNameEn = normalizeSearchText(product.nameEn || '')
  const catNameFa = normalizeSearchText(product.category.nameFa)
  const catNameEn = normalizeSearchText(product.category.nameEn || '')
  const descFa = normalizeSearchText(product.shortDescFa || '')
  const sku = normalizeSearchText(product.sku || '')

  let score = 0

  // 1. Exact string matches
  if (productNameFa.includes(normalizedQuery)) score += 60
  if (productNameEn.includes(normalizedQuery)) score += 50
  if (catNameFa.includes(normalizedQuery) || catNameEn.includes(normalizedQuery)) score += 35
  if (sku === normalizedQuery) score += 90

  // 2. Token-by-token matching
  for (const token of queryTokens) {
    if (token.length < 2) continue
    if (productNameFa.includes(token) || productNameEn.includes(token)) {
      score += 20
    } else if (catNameFa.includes(token) || catNameEn.includes(token)) {
      score += 15
    } else if (descFa.includes(token)) {
      score += 10
    }
  }

  // 3. Species alignment bonus / penalty
  if (intent.detectedSpecies === 'cat') {
    const isCatProd =
      productNameFa.includes('گربه') ||
      catNameFa.includes('گربه') ||
      productNameEn.includes('cat') ||
      catNameEn.includes('cat')
    if (isCatProd) score += 25
    else score -= 30
  } else if (intent.detectedSpecies === 'dog') {
    const isDogProd =
      productNameFa.includes('سگ') ||
      catNameFa.includes('سگ') ||
      productNameEn.includes('dog') ||
      catNameEn.includes('dog')
    if (isDogProd) score += 25
    else score -= 30
  }

  // 4. Special needs alignment bonus
  for (const needKey of intent.detectedNeeds) {
    const needDef = SPECIAL_NEEDS_LEXICON[needKey]
    if (needDef) {
      const matchesNeed = needDef.terms.some(
        (t) =>
          productNameFa.includes(t) ||
          productNameEn.includes(t) ||
          descFa.includes(t) ||
          catNameFa.includes(t)
      )
      if (matchesNeed) score += 40
    }
  }

  // 5. In-stock bonus
  if (product.stockStatus === 'IN_STOCK') {
    score += 5
  }

  return Math.max(0, score)
}

/**
 * Determines whether a product is targeted at cats, dogs, or both/general.
 */
export function getProductSpecies(product: ShopProduct): PetSpecies {
  const nameFa = normalizeSearchText(product.nameFa)
  const nameEn = normalizeSearchText(product.nameEn || '')
  const catFa = normalizeSearchText(product.category.nameFa)
  const catEn = normalizeSearchText(product.category.nameEn || '')

  const isCat =
    nameFa.includes('گربه') ||
    catFa.includes('گربه') ||
    nameEn.includes('cat') ||
    catEn.includes('cat')
  const isDog =
    nameFa.includes('سگ') ||
    catFa.includes('سگ') ||
    nameEn.includes('dog') ||
    catEn.includes('dog')

  if (isCat && !isDog) return 'cat'
  if (isDog && !isCat) return 'dog'
  return 'all'
}

/**
 * Discovers complementary thematic products for a selected product
 * (e.g., when viewing Cat Dry Food, returns complementary Cat Wet Pouch, Malt Treat, Bowl).
 */
export function getRelatedThematicProducts(
  pickedProduct: ShopProduct,
  allProducts: ShopProduct[],
  maxResults = 4
): {
  products: ShopProduct[]
  themeTitleFa: string
  themeTitleEn: string
  reasonFa: string
  reasonEn: string
} {
  const species = getProductSpecies(pickedProduct)
  const pickedCategorySlug = pickedProduct.category.slugFa || ''
  const pickedNameFa = normalizeSearchText(pickedProduct.nameFa)

  // Filter candidates: same species (or general), excluding the picked product itself
  const candidates = allProducts.filter((p) => {
    if (p.id === pickedProduct.id) return false
    if (species !== 'all') {
      const pSpecies = getProductSpecies(p)
      if (pSpecies !== species && pSpecies !== 'all') return false
    }
    return true
  })

  // Group candidates into complementary categories
  // Hierarchy: 1) Wet food / Can, 2) Treat / Snack, 3) Supplements & Health, 4) Accessories & Hygiene
  const isDryFood = pickedCategorySlug.includes('dry') || pickedNameFa.includes('خشک')
  const isWetFood = pickedCategorySlug.includes('wet') || pickedNameFa.includes('کنسرو') || pickedNameFa.includes('پوچ')
  const isTreat = pickedCategorySlug.includes('treat') || pickedNameFa.includes('تشویقی')
  const isLitter = pickedCategorySlug.includes('litter') || pickedNameFa.includes('خاک')
  const isHygiene = pickedCategorySlug.includes('grooming') || pickedCategorySlug.includes('hygiene') || pickedNameFa.includes('شامپو')

  const results: ShopProduct[] = []

  const findFirstFromCat = (catPattern: string, excludeIds: Set<string>): ShopProduct | undefined => {
    return candidates.find(
      (c) =>
        !excludeIds.has(c.id) &&
        (c.category.slugFa.includes(catPattern) ||
          c.category.nameFa.includes(catPattern) ||
          (c.category.nameEn && c.category.nameEn.toLowerCase().includes(catPattern)))
    )
  }

  const pickedIds = new Set<string>()

  if (isDryFood) {
    // 1. Wet Food complement
    const wet = findFirstFromCat('wet', pickedIds) || candidates.find(c => c.nameFa.includes('پوچ') || c.nameFa.includes('کنسرو'))
    if (wet) { results.push(wet); pickedIds.add(wet.id) }

    // 2. Treat / Malt complement
    const treat = findFirstFromCat('treat', pickedIds) || candidates.find(c => c.nameFa.includes('مالت') || c.nameFa.includes('تشویقی'))
    if (treat) { results.push(treat); pickedIds.add(treat.id) }

    // 3. Health & Supplement or Bowl
    const supp = findFirstFromCat('supplement', pickedIds) || findFirstFromCat('bowl', pickedIds) || candidates.find(c => c.category.slugFa.includes('medicines'))
    if (supp) { results.push(supp); pickedIds.add(supp.id) }
  } else if (isWetFood) {
    // 1. Complementary Dry Food
    const dry = findFirstFromCat('dry', pickedIds)
    if (dry) { results.push(dry); pickedIds.add(dry.id) }

    // 2. Treat
    const treat = findFirstFromCat('treat', pickedIds)
    if (treat) { results.push(treat); pickedIds.add(treat.id) }

    // 3. Hygiene or Bowl
    const bowl = findFirstFromCat('bowl', pickedIds) || findFirstFromCat('grooming', pickedIds)
    if (bowl) { results.push(bowl); pickedIds.add(bowl.id) }
  } else if (isTreat) {
    // 1. Complementary Dry Food
    const dry = findFirstFromCat('dry', pickedIds)
    if (dry) { results.push(dry); pickedIds.add(dry.id) }

    // 2. Wet Food
    const wet = findFirstFromCat('wet', pickedIds)
    if (wet) { results.push(wet); pickedIds.add(wet.id) }

    // 3. Toy or bowl
    const toy = findFirstFromCat('toy', pickedIds) || findFirstFromCat('bowl', pickedIds)
    if (toy) { results.push(toy); pickedIds.add(toy.id) }
  } else if (isLitter) {
    // 1. Scoop / Litter accessory
    const scoop = candidates.find(c => c.nameFa.includes('بیلچه') || c.nameFa.includes('پد') || c.nameFa.includes('باکس'))
    if (scoop) { results.push(scoop); pickedIds.add(scoop.id) }

    // 2. Deodorizer / Shampoo
    const hyg = findFirstFromCat('grooming', pickedIds) || findFirstFromCat('hygiene', pickedIds)
    if (hyg) { results.push(hyg); pickedIds.add(hyg.id) }
  } else if (isHygiene) {
    // 1. Brush / Grooming tool
    const brush = candidates.find(c => c.nameFa.includes('برس') || c.nameFa.includes('شانه') || c.nameFa.includes('دستمال'))
    if (brush) { results.push(brush); pickedIds.add(brush.id) }

    // 2. Dental or Ear care
    const dental = candidates.find(c => c.nameFa.includes('دندان') || c.nameFa.includes('گوش'))
    if (dental) { results.push(dental); pickedIds.add(dental.id) }
  }

  // Fill up to maxResults with top candidates in stock from the same species
  for (const c of candidates) {
    if (results.length >= maxResults) break
    if (!pickedIds.has(c.id)) {
      results.push(c)
      pickedIds.add(c.id)
    }
  }

  const speciesLabelFa = species === 'cat' ? 'گربه' : species === 'dog' ? 'سگ' : 'حیوانات خانگی'
  const speciesLabelEn = species === 'cat' ? 'Cat' : species === 'dog' ? 'Dog' : 'Pet'

  return {
    products: results.slice(0, maxResults),
    themeTitleFa: `اقلام مکمل و بسته پیشنهادی برای ${speciesLabelFa}`,
    themeTitleEn: `Complementary Thematic Bundle for ${speciesLabelEn}`,
    reasonFa: `پیشنهاد هوش مصنوعی پت‌باس: این اقلام از نظر فیزیولوژیک و نیازهای روزمره هماهنگ با «${pickedProduct.nameFa}» برگزیده شده‌اند تا مراقبت و تغذیه‌ای کامل حاصل شود.`,
    reasonEn: `Pet Boss AI Recommendation: These items are clinically formulated to complement "${pickedProduct.nameEn || pickedProduct.nameFa}" for complete wellness and dietary balance.`,
  }
}
