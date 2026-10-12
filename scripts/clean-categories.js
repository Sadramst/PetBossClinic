const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function cleanCategories() {
  // 1. Move products from legacy categories
  const maltCat = await prisma.productCategory.findFirst({ where: { nameFa: { contains: 'خمیر مالت' } } });
  const catTreatsCat = await prisma.productCategory.findFirst({ where: { slugFa: 'cat-treats' } });
  if (maltCat && catTreatsCat) {
    const moved = await prisma.product.updateMany({
      where: { categoryId: maltCat.id },
      data: { categoryId: catTreatsCat.id }
    });
    console.log(`Moved ${moved.count} malt products to Cat Treats`);
  }

  // 2. Deactivate any category with 0 products
  const allCats = await prisma.productCategory.findMany({
    include: { _count: { select: { products: true } } }
  });

  for (const c of allCats) {
    if (c._count.products === 0) {
      await prisma.productCategory.update({
        where: { id: c.id },
        data: { isActive: false }
      });
      console.log('Deactivated empty category:', c.nameFa);
    }
  }

  // 3. Re-index active categories
  const activeCats = await prisma.productCategory.findMany({
    where: { isActive: true },
    include: { _count: { select: { products: true } } },
    orderBy: { sortOrder: 'asc' }
  });

  console.log(`\n✅ ACTIVE LUXURY CATEGORIES (${activeCats.length}):`);
  for (let i = 0; i < activeCats.length; i++) {
    const c = activeCats[i];
    await prisma.productCategory.update({
      where: { id: c.id },
      data: { sortOrder: i + 1 }
    });
    console.log(` ${i + 1}. ${c.nameFa} (${c._count.products} products) - ${c.imageId}`);
  }
}

cleanCategories()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
