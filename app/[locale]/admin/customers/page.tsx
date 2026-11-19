import { requireAdmin } from '@/lib/auth/guard';
import { listCustomers, type CustomerSort } from '@/lib/club/customers-admin';
import { getLoyaltyConfig } from '@/lib/club/config';
import { CustomersManager } from '@/components/admin/customers-manager';
import { formatJalaliDate } from '@/lib/shop/expiry';
import { normalizeFa } from '@/lib/text/persian';

export const dynamic = 'force-dynamic';

type SP = { q?: string; tier?: string; species?: string; tag?: string; city?: string; orders?: string; consent?: string; sort?: string; dir?: string; page?: string };
const SORTS: CustomerSort[] = ['joined', 'points', 'spend', 'lastOrder', 'orders'];

export default async function AdminCustomersPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<SP> }) {
  const { locale } = await params;
  // Customer phone numbers, spend and login history: not for view-only staff.
  const session = await requireAdmin('EDITOR', locale);
  const sp = await searchParams;
  const filters = {
    q: normalizeFa(sp.q ?? '').slice(0, 60),
    tier: sp.tier || undefined,
    species: sp.species || undefined,
    tag: sp.tag?.slice(0, 30) || undefined,
    city: sp.city?.slice(0, 40) || undefined,
    hasOrders: sp.orders === 'yes' ? true : sp.orders === 'no' ? false : undefined,
    consent: sp.consent === 'yes' ? true : sp.consent === 'no' ? false : undefined,
    sort: (SORTS as string[]).includes(sp.sort ?? '') ? (sp.sort as CustomerSort) : ('joined' as CustomerSort),
    dir: sp.dir === 'asc' ? ('asc' as const) : ('desc' as const),
    page: Math.max(1, Number.parseInt(sp.page ?? '1', 10) || 1),
  };
  const [list, cfg] = await Promise.all([listCustomers(filters), getLoyaltyConfig()]);
  const isAdmin = session.role === 'ADMIN' || session.role === 'SUPER_ADMIN';

  return (
    <CustomersManager
      isAdmin={isAdmin}
      tiers={cfg.tiers.map((t) => ({ key: t.key, label: t.label, color: t.color }))}
      filters={{ q: filters.q, tier: filters.tier ?? '', species: filters.species ?? '', tag: filters.tag ?? '', city: filters.city ?? '', orders: sp.orders ?? '', consent: sp.consent ?? '', sort: filters.sort, dir: filters.dir }}
      total={list.total}
      page={list.page}
      pages={list.pages}
      customers={list.rows.map((c) => ({
        id: c.id,
        name: [c.firstName, c.lastName].filter(Boolean).join(' ') || '—',
        phone: c.phone,
        email: c.email,
        city: c.city,
        joined: formatJalaliDate(c.createdAt),
        lastOrder: c.lastOrderAt ? formatJalaliDate(c.lastOrderAt) : null,
        orders: c.ordersCount,
        spent: c.totalSpent,
        points: c.pointsBalance,
        tier: c.tier,
        consent: c.marketingSmsConsent,
        isBlocked: c.isBlocked,
        createdByAdmin: c.createdByAdmin,
        pets: c.pets.map((p) => p.name),
      }))}
    />
  );
}
