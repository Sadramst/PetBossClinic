import { db } from "@/lib/db";
import { ProductsManager } from "@/components/admin/products-manager";
import { requireAdmin } from "@/lib/auth/guard";

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

export default async function AdminProductsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  await requireAdmin('VIEWER', locale);
  const isEn = locale === 'en';

  const [products, categories] = await Promise.all([
    db.product.findMany({
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
      include: {
        category: {
          select: { id: true, nameFa: true, nameEn: true, slugFa: true, isActive: true },
        },
        images: {
          orderBy: { sortOrder: 'asc' },
        },
      },
    }),
    db.productCategory.findMany({
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
        imageId: true,
        isActive: true,
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
