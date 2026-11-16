import { db } from '@/lib/db';
import { requireAdmin } from '@/lib/auth/guard';
import { InventoryManager, type BatchRow } from '@/components/admin/inventory-manager';
import { EXPIRY_SOON_DAYS, expiryState } from '@/lib/shop/expiry';
import { formatJalaliInput } from '@/lib/date/jalali';

export const dynamic = 'force-dynamic';

export default async function AdminInventoryPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  await requireAdmin('VIEWER', locale);

  const now = new Date();
  const soonLimit = new Date(now.getTime() + EXPIRY_SOON_DAYS * 86400000);
  const batchInclude = { product: { select: { id: true, nameFa: true, sku: true, slugFa: true } } } as const;

  const [expiring, recent, undated, products] = await Promise.all([
    db.inventory.findMany({
      where: { quantity: { gt: 0 }, expiryDate: { not: null, lte: soonLimit }, product: { deletedAt: null } },
      orderBy: { expiryDate: 'asc' },
      include: batchInclude,
      take: 300,
    }),
    db.inventory.findMany({ orderBy: { createdAt: 'desc' }, include: batchInclude, take: 50 }),
    // Perishables on sale with no dated stock: the shop cannot show customers an expiry date.
    db.product.findMany({
      where: {
        deletedAt: null,
        isActive: true,
        tracksExpiry: true,
        stockStatus: { in: ['IN_STOCK', 'LOW_STOCK'] },
        inventory: { none: { quantity: { gt: 0 }, expiryDate: { gt: now } } },
      },
      select: { id: true, nameFa: true, sku: true },
      orderBy: { sortOrder: 'asc' },
    }),
    db.product.findMany({
      where: { deletedAt: null },
      select: { id: true, nameFa: true, sku: true, tracksExpiry: true },
      orderBy: { nameFa: 'asc' },
    }),
  ]);

  const toRow = (b: (typeof expiring)[number]): BatchRow => ({
    id: b.id,
    productId: b.product.id,
    productName: b.product.nameFa,
    productSku: b.product.sku,
    productSlug: b.product.slugFa,
    quantity: b.quantity,
    batchNumber: b.batchNumber,
    location: b.location,
    expiry: b.expiryDate ? formatJalaliInput(b.expiryDate) : null,
    manufacture: b.manufactureDate ? formatJalaliInput(b.manufactureDate) : null,
    state: expiryState(b.expiryDate, now),
    receivedAt: formatJalaliInput(b.receivedAt),
  });

  return (
    <InventoryManager
      expiring={expiring.map(toRow)}
      recent={recent.map(toRow)}
      undated={undated}
      products={products}
      today={formatJalaliInput(now)}
    />
  );
}
