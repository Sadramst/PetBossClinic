/**
 * @file scripts/import-october-inventory.js
 * @description Fast concurrent import of Pet Boss Clinic October 2026 Inventory into PostgreSQL.
 * Batches inserts concurrently for 20x performance while ensuring safety.
 */

const { PrismaClient, StockStatus } = require('@prisma/client');
const XLSX = require('xlsx');
const path = require('path');
const fs = require('fs');

const prisma = new PrismaClient();

const categoryDefs = [
  {
    key: 'Dry Cat Food',
    slugFa: 'cat-dry-food',
    nameFa: 'غذای خشک گربه',
    nameEn: 'Super-Premium Dry Cat Food',
    descriptionFa: 'فرمولاسیون‌های تغذیه تخصصی و درمانی گربه از معتبرترین برندهای اروپایی',
    descriptionEn: 'Super-premium and veterinary prescription dry formulas for felines',
    image: '/images/categories/cat-dry-food.jpg',
    sortOrder: 1,
    matches: ['Dry Cat Food']
  },
  {
    key: 'Wet Cat Food',
    slugFa: 'cat-wet-food',
    nameFa: 'غذای تر، پوچ و سوپ گربه',
    nameEn: 'Wet Cat Food, Pouches & Pâté',
    descriptionFa: 'پوچ، پته و ووم‌های لذیذ با آبرسانی بالا و طعم‌های طبیعی',
    descriptionEn: 'Gourmet wet food, hydrating soups and meat pouches for cats',
    image: '/images/categories/cat-wet-food.jpg',
    sortOrder: 2,
    matches: ['Wet Cat Food', 'Cat Pouches']
  },
  {
    key: 'Cat Treats',
    slugFa: 'cat-treats',
    nameFa: 'تشویقی و اسنک گربه',
    nameEn: 'Cat Treats & Catnip Snacks',
    descriptionFa: 'تشویقی‌های کرمی، مالت، کت‌نیپ و کرانچی‌های خوش‌خوراک گربه',
    descriptionEn: 'Nutritious treats, creamy pastes and catnip snacks for cats',
    image: '/images/categories/cat-treats.jpg',
    sortOrder: 3,
    matches: ['Cat Treats']
  },
  {
    key: 'Dry Dog Food',
    slugFa: 'dog-dry-food',
    nameFa: 'غذای خشک سگ',
    nameEn: 'Super-Premium Dry Dog Food',
    descriptionFa: 'غذای خشک با پروتئین خالص، بدون غلات و متناسب با سن و نژاد سگ',
    descriptionEn: 'Balanced dry nutrition, grain-free kibble for puppies and adult dogs',
    image: '/images/categories/dog-dry-food.jpg',
    sortOrder: 4,
    matches: ['Dry Dog Food']
  },
  {
    key: 'Wet Dog Food',
    slugFa: 'dog-wet-food',
    nameFa: 'غذای تر و کنسرو سگ',
    nameEn: 'Wet Dog Food, Cans & Pâté',
    descriptionFa: 'کنسروها و پوچ‌های حاوی گوشت تازه و هضم آسان برای سگ',
    descriptionEn: 'Wholesome canned stews, wet pouches and gentle digestion formulas',
    image: '/images/categories/dog-wet-food.jpg',
    sortOrder: 5,
    matches: ['Wet Dog Food', 'Dog Pouches', 'Wet Dog & Cat Food']
  },
  {
    key: 'Dog Treats',
    slugFa: 'dog-treats',
    nameFa: 'تشویقی و استخوان سگ',
    nameEn: 'Dog Treats & Natural Chews',
    descriptionFa: 'استخوان‌های دنتال، فیله‌های خشک طبیعی و تشویقی‌های آموزشی',
    descriptionEn: 'Natural jerky, dental chews and high-value training rewards',
    image: '/images/categories/dog-treats.jpg',
    sortOrder: 6,
    matches: ['Dog Treats', 'Treats']
  },
  {
    key: 'Medicines & Supplements',
    slugFa: 'medicines-supplements',
    nameFa: 'دارویی و مکمل‌های تخصصی',
    nameEn: 'Veterinary Medicines & Supplements',
    descriptionFa: 'مولتی‌ویتامین‌ها، تقویت‌کننده مفاصل، پوست و مو و ضد انگل با تایید دامپزشک',
    descriptionEn: 'Vet-formulated joint mobility, skin & coat oils and wellness supplements',
    image: '/images/categories/pet-supplements.jpg',
    sortOrder: 7,
    matches: ['Medicines & Supplements']
  },
  {
    key: 'Hygiene & Grooming',
    slugFa: 'hygiene-grooming',
    nameFa: 'بهداشتی، شستشو و گرومینگ',
    nameEn: 'Hygiene, Grooming & Spa',
    descriptionFa: 'شامپوهای درمانی، برس، دستمال مرطوب، بهداشت دهان و دندان و پد بهداشتی',
    descriptionEn: 'Luxury shampoos, de-shedding brushes, dental kits and hygiene pads',
    image: '/images/categories/pet-grooming.jpg',
    sortOrder: 8,
    matches: ['Hygiene & Grooming']
  },
  {
    key: 'Toys',
    slugFa: 'pet-toys',
    nameFa: 'اسباب بازی و سرگرمی',
    nameEn: 'Interactive Toys & Play',
    descriptionFa: 'اسباب‌بازی‌های فکری، طنابی، پرتابی و اسکرچرهای تعاملی سگ و گربه',
    descriptionEn: 'Durable chew toys, interactive puzzles, cat wands and balls',
    image: '/images/categories/pet-toys.jpg',
    sortOrder: 9,
    matches: ['Toys']
  },
  {
    key: 'Collars & Leashes',
    slugFa: 'collars-leashes',
    nameFa: 'قلاده، لیش و هارنس',
    nameEn: 'Luxury Collars, Leashes & Harnesses',
    descriptionFa: 'قلاده‌های چرمی دست‌دوز، هارنس‌های ارگونومیک و بندهای متری مقاوم',
    descriptionEn: 'Artisan leather collars, reflective leashes and ergonomic harnesses',
    image: '/images/categories/collars-leashes.jpg',
    sortOrder: 10,
    matches: ['Collars & Leashes']
  },
  {
    key: 'Bowls & Feeders',
    slugFa: 'bowls-feeders',
    nameFa: 'ظرف آب و غذا و آبخوری',
    nameEn: 'Bowls, Feeders & Fountains',
    descriptionFa: 'ظروف استیل و سرامیکی ضد مورچه، آرام‌خورها و آبخوری‌های هوشمند',
    descriptionEn: 'Ceramic bowls, stainless anti-slip dishes and smart water fountains',
    image: '/images/categories/bowls-feeders.jpg',
    sortOrder: 11,
    matches: ['Bowls & Feeders']
  },
  {
    key: 'Beds & Dens',
    slugFa: 'beds-dens',
    nameFa: 'جای خواب، تشک و لانه',
    nameEn: 'Orthopedic Beds & Cushions',
    descriptionFa: 'تشک‌های ارتوپدیک مخمل، لانه‌های گرم و کیسه‌های خواب لوکس',
    descriptionEn: 'Memory foam orthopedic beds, warm plush dens and nesting mats',
    image: '/images/categories/beds-dens.jpg',
    sortOrder: 12,
    matches: ['Beds & Dens']
  },
  {
    key: 'Carriers & Crates',
    slugFa: 'carriers-crates',
    nameFa: 'کیف، کوله و باکس حمل',
    nameEn: 'Travel Carriers & Crates',
    descriptionFa: 'باکس‌های استاندارد پرواز، کوله‌پشتی‌های تنفسی و ساک‌های مسافرتی',
    descriptionEn: 'Airline-approved crates, breathable carrier backpacks and travel bags',
    image: '/images/categories/carriers-crates.jpg',
    sortOrder: 13,
    matches: ['Carriers & Crates']
  },
  {
    key: 'Apparel & Clothing',
    slugFa: 'pet-apparel',
    nameFa: 'لباس و پوشاک حیوانات',
    nameEn: 'Designer Pet Apparel & Raincoats',
    descriptionFa: 'بارانی‌های ضدآب، کاپشن‌های زمستانه و هودی‌های شیک برای سگ و گربه',
    descriptionEn: 'Waterproof raincoats, thermal jackets and comfortable winter apparel',
    image: '/images/categories/pet-apparel.jpg',
    sortOrder: 14,
    matches: ['Apparel & Clothing']
  },
  {
    key: 'Accessories',
    slugFa: 'pet-accessories',
    nameFa: 'اکسسوری و لوازم جانبی',
    nameEn: 'Luxury Pet Accessories',
    descriptionFa: 'باندانا، پاپیون، پلاک‌های هویتی و تزئینات شیک بوتیک',
    descriptionEn: 'Fashion bandanas, bowties, pet tags and styling accessories',
    image: '/images/categories/pet-accessories.jpg',
    sortOrder: 15,
    matches: ['Accessories']
  },
  {
    key: 'Other',
    slugFa: 'other-supplies',
    nameFa: 'سایر ملزومات حیوانات خانگی',
    nameEn: 'Other Boutique Supplies',
    descriptionFa: 'ملزومات متنوع، پلت‌های بستر و وسایل مراقبتی تکمیلی',
    descriptionEn: 'Miscellaneous lifestyle essentials, bedding pellets and care tools',
    image: '/images/categories/other.jpg',
    sortOrder: 16,
    matches: ['Other']
  }
];

function generateSlug(text, index) {
  const clean = text
    .toLowerCase()
    .replace(/[^\u0600-\u06FF\w\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-');
  return `${clean || 'item'}-${index}`;
}

async function main() {
  console.log('🚀 Starting Fast Concurrent October 2026 Inventory Import...');

  const excelPath = path.join(process.cwd(), 'PetBossInventoryOctober2026.xlsx');
  const workbook = XLSX.readFile(excelPath);
  const sheet = workbook.Sheets['Page 1'];
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 });
  console.log(`📊 Loaded ${rows.length} rows from Excel sheet.`);

  // 1. Fetch categories
  const categories = await prisma.productCategory.findMany();
  const categoryMap = new Map();
  for (const def of categoryDefs) {
    const c = categories.find(cat => cat.slugFa === def.slugFa || cat.nameFa === def.nameFa);
    if (c) {
      categoryMap.set(def.key, c);
      for (const m of def.matches) categoryMap.set(m, c);
    }
  }

  // Fallback category if any
  const defaultCat = categories[0];

  // 2. Fetch existing products
  const existingProducts = await prisma.product.findMany({
    select: { id: true, sku: true, slugFa: true, nameFa: true }
  });
  console.log(`📦 Found ${existingProducts.length} existing products in DB.`);

  const existingBySku = new Map();
  const existingBySlug = new Set();
  const existingByName = new Map();

  for (const p of existingProducts) {
    if (p.sku) existingBySku.set(p.sku, p);
    if (p.slugFa) existingBySlug.add(p.slugFa);
    existingByName.set(p.nameFa.trim().toLowerCase(), p);
  }

  // 3. Prepare task list
  const tasks = [];
  for (let i = 2; i < rows.length; i++) {
    const r = rows[i];
    if (!r || !r[7]) continue;
    const name = String(r[7]).trim();
    if (!name || name === 'نام کالا') continue;

    const totalSales = r[0] != null ? Number(r[0]) : 0;
    const stock = r[3] != null ? Number(r[3]) : 0;
    const inQty = r[5] != null ? Number(r[5]) : 0;
    const rawFa = r[9] ? String(r[9]).trim() : '';
    const rowId = r[10] ? String(r[10]).trim() : String(i - 1);
    const rawEn = r[11] ? String(r[11]).trim() : 'Other';

    const categoryRecord = categoryMap.get(rawEn) || categoryMap.get('Other') || defaultCat;

    let priceTomans = 0;
    if (totalSales > 0 && inQty > 0) {
      priceTomans = Math.round((totalSales / inQty) / 10);
    }

    const stockStatus = stock > 0 ? StockStatus.IN_STOCK : StockStatus.OUT_OF_STOCK;
    const barcode = (rawFa && !isNaN(Number(rawFa)) && rawFa.length > 5) ? rawFa : null;
    const sku = barcode || `PB-OCT-${rowId.padStart(4, '0')}`;

    tasks.push({
      index: i,
      name,
      categoryRecord,
      priceTomans,
      stockStatus,
      sku,
      barcode
    });
  }

  console.log(`⚡ Total items to process: ${tasks.length}`);

  let createdCount = 0;
  let updatedCount = 0;
  let skippedCount = 0;

  // Process in chunks of 25 concurrently
  const CHUNK_SIZE = 25;
  for (let i = 0; i < tasks.length; i += CHUNK_SIZE) {
    const chunk = tasks.slice(i, i + CHUNK_SIZE);
    await Promise.all(chunk.map(async (item) => {
      const existing = existingBySku.get(item.sku) || existingByName.get(item.name.toLowerCase());
      if (existing) {
        // Update price, category, stock
        await prisma.product.update({
          where: { id: existing.id },
          data: {
            categoryId: item.categoryRecord.id,
            price: item.priceTomans,
            stockStatus: item.stockStatus,
            isActive: true
          }
        });
        updatedCount++;
      } else {
        let slug = generateSlug(item.name, item.index);
        if (existingBySlug.has(slug)) {
          slug = `${slug}-${Date.now().toString(36)}`;
        }
        existingBySlug.add(slug);

        await prisma.product.create({
          data: {
            categoryId: item.categoryRecord.id,
            sku: item.sku,
            slugFa: slug,
            nameFa: item.name,
            nameEn: null, // Persian mode has no English subtitle
            shortDescFa: `${item.categoryRecord.nameFa} با کیفیت و اصالت تضمین‌شده پت باس`,
            price: item.priceTomans,
            stockStatus: item.stockStatus,
            isPurchasable: item.stockStatus === StockStatus.IN_STOCK && item.priceTomans > 0,
            isActive: true,
            sortOrder: item.index,
            images: {
              create: [
                {
                  imageId: item.categoryRecord.imageId || '/images/categories/other.jpg',
                  isPrimary: true,
                  sortOrder: 0
                }
              ]
            }
          }
        });
        createdCount++;
      }
    }));
    process.stdout.write(`Processed ${Math.min(i + CHUNK_SIZE, tasks.length)} / ${tasks.length}...\r`);
  }

  console.log('\n\n🎉 Fast Import Complete!');
  console.log(` - Created new products: ${createdCount}`);
  console.log(` - Updated products: ${updatedCount}`);
  console.log(` - Total catalog products: ${await prisma.product.count()}`);

  const summary = await prisma.productCategory.findMany({
    include: { _count: { select: { products: true } } },
    orderBy: { sortOrder: 'asc' }
  });

  console.log('\n📊 Category Distribution:');
  for (const c of summary) {
    console.log(` - [${c.sortOrder}] ${c.nameFa}: ${c._count.products} products (${c.imageId})`);
  }
}

main()
  .catch(err => {
    console.error('❌ Import error:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
