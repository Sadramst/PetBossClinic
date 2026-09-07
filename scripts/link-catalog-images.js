const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

function resolveCategoryImage(cat) {
  const name = (cat.nameFa + ' ' + (cat.nameEn || '') + ' ' + (cat.slugEn || '') + ' ' + cat.slugFa).toLowerCase();

  if (name.includes('شامپو') || name.includes('برس') || name.includes('گرومینگ') || name.includes('grooming') || name.includes('shampoo')) {
    return '/images/categories/grooming-shampoos.jpg';
  }
  if (name.includes('خاک') || name.includes('توالت') || name.includes('litter')) {
    return '/images/categories/cat-litter-hygiene.jpg';
  }
  if (name.includes('قلاده') || name.includes('هارنس') || name.includes('بند') || name.includes('harness') || name.includes('collar')) {
    return '/images/categories/harnesses-leashes-collars.jpg';
  }
  if (name.includes('باکس') || name.includes('مسافرت') || name.includes('carrier') || name.includes('travel')) {
    return '/images/categories/travel-carriers-crates.jpg';
  }
  if (name.includes('خواب') || name.includes('تشک') || name.includes('کوسن') || name.includes('bed') || name.includes('cushion')) {
    return '/images/categories/orthopedic-beds-cushions.jpg';
  }
  if (name.includes('اسکرچر') || name.includes('scratcher') || name.includes('tree')) {
    return '/images/categories/cat-scratchers-trees.jpg';
  }
  if (name.includes('اسباب') || name.includes('جویدنی') || name.includes('تعاملی') || name.includes('toy')) {
    return '/images/categories/interactive-pet-toys.jpg';
  }
  if (name.includes('مالت') || name.includes('هربال') || name.includes('malt') || name.includes('hairball')) {
    return '/images/categories/cat-malt-supplements.jpg';
  }
  if (name.includes('مفاصل') || name.includes('استخوان') || name.includes('joint') || name.includes('mobility')) {
    return '/images/categories/dog-joint-supplements.jpg';
  }
  if (name.includes('مولتی') || name.includes('ویتامین') || name.includes('پوست') || name.includes('vitamin') || name.includes('coat')) {
    return '/images/categories/multivitamins-skin-coat.jpg';
  }
  if (name.includes('دندان') || name.includes('دهان') || name.includes('dental') || name.includes('oral')) {
    return '/images/categories/dental-oral-care.jpg';
  }
  if (name.includes('درمانی') || name.includes('رژیمی') || name.includes('prescription') || name.includes('renal') || name.includes('urinary')) {
    return '/images/categories/vet-prescription-diets.jpg';
  }
  if (name.includes('تشویقی') || name.includes('اسنک') || name.includes('treat')) {
    return name.includes('گربه') || name.includes('cat') ? '/images/categories/cat-malt-supplements.jpg' : '/images/categories/dog-joint-supplements.jpg';
  }
  if (name.includes('تر') || name.includes('کنسرو') || name.includes('پوچ') || name.includes('wet') || name.includes('pouch') || name.includes('pate')) {
    return name.includes('گربه') || name.includes('cat') ? '/images/categories/cat-wet-food.jpg' : '/images/categories/dog-canned-food.jpg';
  }
  if (name.includes('خشک') || name.includes('dry')) {
    return name.includes('گربه') || name.includes('cat') ? '/images/categories/cat-dry-food.jpg' : '/images/categories/dog-dry-food.jpg';
  }
  if (name.includes('پرنده') || name.includes('bird')) {
    return '/images/categories/birds-care-nutrition.jpg';
  }
  if (name.includes('جونده') || name.includes('خرگوش') || name.includes('rodent')) {
    return '/images/categories/rodents-small-pets.jpg';
  }
  if (name.includes('ظرف') || name.includes('bowl') || name.includes('feeder')) {
    return '/images/categories/luxury-bowls-feeders.jpg';
  }
  if (name.includes('پد') || name.includes('آموزش') || name.includes('pad')) {
    return '/images/categories/training-pads-diapers.jpg';
  }

  return '/images/categories/cat-dry-food.jpg';
}

function resolveProductImage(product, cat) {
  const pName = (product.nameFa + ' ' + (product.nameEn || '') + ' ' + (cat?.nameFa || '')).toLowerCase();

  if (pName.includes('شامپو') || pName.includes('لوسیون') || pName.includes('اسپری') || pName.includes('برس') || pName.includes('shampoo')) {
    return '/images/products/grooming-shampoos.jpg';
  }
  if (pName.includes('خاک') || pName.includes('توالت') || pName.includes('litter') || pName.includes('بیلچه')) {
    return '/images/products/cat-litter-hygiene.jpg';
  }
  if (pName.includes('قلاده') || pName.includes('هارنس') || pName.includes('بند') || pName.includes('لید') || pName.includes('collar') || pName.includes('harness')) {
    return '/images/products/harnesses-collars.jpg';
  }
  if (pName.includes('باکس') || pName.includes('کوله') || pName.includes('carrier') || pName.includes('crate')) {
    return '/images/products/harnesses-collars.jpg';
  }
  if (pName.includes('خواب') || pName.includes('تشک') || pName.includes('کوسن') || pName.includes('bed') || pName.includes('cushion')) {
    return '/images/products/orthopedic-pet-bed.jpg';
  }
  if (pName.includes('اسکرچر') || pName.includes('درخت') || pName.includes('ستون') || pName.includes('scratcher')) {
    return '/images/products/cat-scratching-tree.jpg';
  }
  if (pName.includes('اسباب') || pName.includes('توپ') || pName.includes('عروسک') || pName.includes('toy')) {
    return '/images/products/cat-scratching-tree.jpg';
  }
  if (pName.includes('مالت') || pName.includes('هربال') || pName.includes('خمیر') || pName.includes('malt') || pName.includes('hairball')) {
    return '/images/products/cat-malt-paste.jpg';
  }
  if (pName.includes('مفاصل') || pName.includes('استخوان') || pName.includes('گلوکزامین') || pName.includes('joint') || pName.includes('mobility')) {
    return '/images/products/dog-joint-supplements.jpg';
  }
  if (pName.includes('مولتی') || pName.includes('ویتامین') || pName.includes('امگا') || pName.includes('پوست') || pName.includes('vitamin')) {
    return '/images/products/dog-joint-supplements.jpg';
  }
  if (pName.includes('دندان') || pName.includes('دهان') || pName.includes('dental') || pName.includes('oral') || pName.includes('مسواک')) {
    return '/images/products/cat-malt-paste.jpg';
  }
  if (pName.includes('درمانی') || pName.includes('رژیمی') || pName.includes('renal') || pName.includes('urinary') || pName.includes('gastro') || pName.includes('recovery')) {
    return '/images/products/vet-prescription-diet.jpg';
  }
  if (pName.includes('پوچ') || pName.includes('کنسرو') || pName.includes('پته') || pName.includes('ژله') || pName.includes('سوپ') || pName.includes('wet') || pName.includes('pouch')) {
    return pName.includes('گربه') || pName.includes('cat') ? '/images/products/cat-wet-food.jpg' : '/images/products/dog-canned-food.jpg';
  }
  if (pName.includes('خشک') || pName.includes('dry')) {
    return pName.includes('گربه') || pName.includes('cat') || pName.includes('kitten') ? '/images/products/cat-dry-food.jpg' : '/images/products/dog-dry-food.jpg';
  }

  // Fallback to category image
  return resolveCategoryImage(cat).replace('/images/categories/', '/images/products/');
}

async function main() {
  console.log('=== High-Fidelity Catalog Images Linking ===');

  const categories = await prisma.productCategory.findMany();
  console.log(`Updating ${categories.length} categories...`);

  for (const cat of categories) {
    const img = resolveCategoryImage(cat);
    await prisma.productCategory.update({
      where: { id: cat.id },
      data: { imageId: img },
    });
    console.log(`[Category] ${cat.nameFa} -> ${img}`);
  }

  const products = await prisma.product.findMany({
    include: { category: true, images: true },
  });
  console.log(`Updating ${products.length} products...`);

  let count = 0;
  for (const p of products) {
    const img = resolveProductImage(p, p.category);

    await prisma.product.update({
      where: { id: p.id },
      data: { ogImageId: img },
    });

    await prisma.productImage.deleteMany({
      where: { productId: p.id },
    });

    await prisma.productImage.create({
      data: {
        productId: p.id,
        imageId: img,
        isPrimary: true,
        sortOrder: 0,
      },
    });

    count++;
  }

  console.log(`Successfully mapped and linked images for ${count} products!`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
