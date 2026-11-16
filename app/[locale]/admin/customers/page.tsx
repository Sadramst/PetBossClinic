import { db } from '@/lib/db';
import { requireAdmin } from '@/lib/auth/guard';
import { CustomersManager } from '@/components/admin/customers-manager';
import { formatJalaliDate } from '@/lib/shop/expiry';
import { normalizeFa } from '@/lib/text/persian';
import { toLatinDigits } from '@/lib/date/jalali';

export const dynamic = 'force-dynamic';

export default async function AdminCustomersPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ q?: string }>;
}) {
  const { locale } = await params;
  await requireAdmin('VIEWER', locale);
  const q = normalizeFa((await searchParams).q ?? '').slice(0, 50);
  const digits = toLatinDigits(q).replace(/\D/g, '');

  const customers = await db.customer.findMany({
    where: q
      ? {
          OR: [
            { firstName: { contains: q, mode: 'insensitive' } },
            { lastName: { contains: q, mode: 'insensitive' } },
            ...(digits ? [{ phone: { contains: digits } }] : []),
          ],
        }
      : {},
    orderBy: { createdAt: 'desc' },
    take: 200,
    include: { orders: { where: { status: { in: ['CONFIRMED', 'PROCESSING', 'SHIPPED', 'DELIVERED'] } }, select: { total: true } } },
  });

  return (
    <CustomersManager
      query={q}
      customers={customers.map((c) => ({
        id: c.id,
        name: [c.firstName, c.lastName].filter(Boolean).join(' ') || '—',
        phone: c.phone,
        email: c.email,
        joined: formatJalaliDate(c.createdAt),
        lastLogin: c.lastLoginAt ? formatJalaliDate(c.lastLoginAt) : null,
        orders: c.orders.length,
        spent: c.orders.reduce((s, o) => s + o.total, 0),
        isBlocked: c.isBlocked,
      }))}
    />
  );
}
