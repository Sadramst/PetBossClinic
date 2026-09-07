import { db } from "@/lib/db";
import { ProductsManager } from "@/components/admin/products-manager";

export const dynamic = 'force-dynamic';

export default async function AdminProductsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const isEn = locale === 'en';

  const [products, categories] = await Promise.all([
    db.product.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        category: {
          select: { id: true, nameFa: true, nameEn: true, slugFa: true },
        },
      },
      take: 500,
    }),
    db.productCategory.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' },
      select: {
        id: true,
        nameFa: true,
        nameEn: true,
        slugFa: true,
        slugEn: true,
        descriptionFa: true,
        descriptionEn: true,
        sortOrder: true,
        _count: {
          select: { products: true },
        },
      },
    }),
  ]);

  return (
    <ProductsManager
      products={products}
      categories={categories}
      isEn={isEn}
    />
  );
}
