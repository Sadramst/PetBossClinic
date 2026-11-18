import { requireAdmin } from '@/lib/auth/guard';
import { listCarts, topCartedProducts } from '@/lib/club/cart';
import { ABANDONED_CART_HOURS } from '@/lib/club/segments';
import { relativeAgeFa } from '@/components/admin/format';
import { CartsManager } from '@/components/admin/club/carts-manager';

export const dynamic = 'force-dynamic';

export default async function AdminCartsPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<{ view?: string }> }) {
  const { locale } = await params;
  await requireAdmin('EDITOR', locale);
  const abandoned = (await searchParams).view !== 'all';
  const now = new Date();
  const [list, top] = await Promise.all([listCarts({ idleHours: abandoned ? ABANDONED_CART_HOURS : undefined, take: 50 }), topCartedProducts(10)]);
  return (
    <CartsManager
      abandoned={abandoned}
      idleHours={ABANDONED_CART_HOURS}
      total={list.total}
      top={top}
      carts={list.rows.map((c) => ({
        customerId: c.customerId,
        name: [c.customer.firstName, c.customer.lastName].filter(Boolean).join(' ') || 'بدون نام',
        phone: c.customer.phone,
        consent: c.customer.marketingSmsConsent,
        items: c.items.map((i) => ({ name: i.name, quantity: i.quantity })),
        itemCount: c.itemCount,
        subtotal: c.subtotal,
        idle: relativeAgeFa(c.updatedAt, now),
        reminded: c.lastReminderAt ? relativeAgeFa(c.lastReminderAt, now) : null,
      }))}
    />
  );
}
