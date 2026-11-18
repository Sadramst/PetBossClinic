import { OrderStatus, Prisma } from '@prisma/client';
import { db } from '@/lib/db';
import { requireAdmin } from '@/lib/auth/guard';
import { OrdersManager } from '@/components/admin/orders-manager';
import { formatJalaliDate } from '@/lib/shop/expiry';

export const dynamic = 'force-dynamic';

const OPEN: OrderStatus[] = ['CONFIRMED', 'PROCESSING'];

export default async function AdminOrdersPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ status?: string }>;
}) {
  const { locale } = await params;
  // Orders hold addresses and phone numbers: staff who only view the dashboard must not read them.
  const session = await requireAdmin('EDITOR', locale);
  const active = (await searchParams).status ?? 'open';

  const where: Prisma.OrderWhereInput =
    active === 'all' ? {} : active === 'open' ? { status: { in: OPEN } } : (Object.values(OrderStatus) as string[]).includes(active) ? { status: active as OrderStatus } : {};

  const [orders, grouped] = await Promise.all([
    db.order.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 200,
      include: {
        items: { select: { id: true, nameFa: true, sku: true, quantity: true, unitPrice: true, lineTotal: true } },
        customer: { select: { firstName: true, lastName: true, phone: true } },
        payments: { where: { status: 'PAID' }, select: { refId: true }, take: 1 },
      },
    }),
    db.order.groupBy({ by: ['status'], _count: true }),
  ]);

  const counts: Record<string, number> = { all: 0, open: 0 };
  for (const g of grouped) {
    counts[g.status] = g._count;
    counts.all += g._count;
    if (OPEN.includes(g.status)) counts.open += g._count;
  }

  return (
    <OrdersManager
      active={active}
      role={session.role}
      counts={counts}
      orders={orders.map((o) => ({
        id: o.id,
        number: o.number,
        status: o.status,
        paymentMethod: o.paymentMethod,
        total: o.total,
        subtotal: o.subtotal,
        shippingFee: o.shippingFee,
        discount: o.discount,
        shippingDiscount: o.shippingDiscount,
        couponCode: o.couponCode,
        createdAt: formatJalaliDate(o.createdAt),
        paidAt: o.paidAt ? formatJalaliDate(o.paidAt) : null,
        customerName: [o.customer.firstName, o.customer.lastName].filter(Boolean).join(' ') || o.shipName,
        customerPhone: o.customer.phone,
        shipName: o.shipName,
        shipPhone: o.shipPhone,
        shipProvince: o.shipProvince,
        shipCity: o.shipCity,
        shipAddress: o.shipAddress,
        shipPostal: o.shipPostal,
        customerNote: o.customerNote,
        adminNote: o.adminNote,
        trackingCode: o.trackingCode,
        refId: o.payments[0]?.refId ?? null,
        items: o.items,
      }))}
    />
  );
}
