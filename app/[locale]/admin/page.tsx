import type { OrderStatus } from '@prisma/client';
import { db } from '@/lib/db';
import { Link } from '@/i18n/routing';
import { requireAdmin } from '@/lib/auth/guard';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { EXPIRY_CRITICAL_DAYS, formatJalaliDate } from '@/lib/shop/expiry';
import { ORDER_STATUS_LABEL, ORDER_STATUS_TONE } from '@/components/admin/order-status';
import { LEAD_STATUS_FA, faNum, relativeAgeFa, tehranDayStart, toman } from '@/components/admin/format';

export const dynamic = 'force-dynamic';

const PAID_STATES: OrderStatus[] = ['CONFIRMED', 'PROCESSING', 'SHIPPED', 'DELIVERED'];
const DAY = 24 * 60 * 60 * 1000;

const ICONS = {
  orders: 'M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2M9 5a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2M9 5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2m-6 7h6m-6 4h4',
  clock: 'M12 7v5l3 2m6-2a9 9 0 1 1-18 0 9 9 0 0 1 18 0z',
  alert: 'M12 8v5m0 3.5v.5M10.3 3.9 2.4 17.5A2 2 0 0 0 4.1 20.5h15.8a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z',
  box: 'm21 8-9-5-9 5m18 0-9 5m9-5v8l-9 5m0-8L3 8m9 5v8M3 8v8l9 5',
  mail: 'M4 5h16a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1zm-1 2 9 6 9-6',
  users: 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2m20 0v-2a4 4 0 0 0-3-3.87M15 3.13a4 4 0 0 1 0 7.75M13 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0z',
  coin: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zm0 4v10m3-7.5c0-1.1-1.3-2-3-2s-3 .9-3 2 1.3 2 3 2 3 .9 3 2-1.3 2-3 2-3-.9-3-2',
} as const;

function Icon({ d }: { d: string }) {
  return (
    <svg className="h-5 w-5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d={d} />
    </svg>
  );
}

/** Action tile: gold border when there is something to do. */
function Tile({ href, icon, label, value, hint, urgent }: { href: string; icon: string; label: string; value: string; hint?: string; urgent?: boolean }) {
  return (
    <Link
      href={href}
      className={`flex items-start gap-3 rounded-2xl border bg-surface-card p-4 transition-colors hover:border-primary ${
        urgent ? 'border-primary shadow-gold' : 'border-border'
      }`}
    >
      <span
        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border ${
          urgent ? 'border-border-gold bg-primary/15 text-primary' : 'border-border bg-surface text-primary'
        }`}
      >
        <Icon d={icon} />
      </span>
      <span className="min-w-0">
        <span className="block break-words text-lg font-black leading-8 sm:text-xl">{value}</span>
        <span className="block text-xs font-bold text-foreground/90">{label}</span>
        {hint && <span className="mt-0.5 block text-[11px] leading-5 text-muted-foreground">{hint}</span>}
      </span>
    </Link>
  );
}

function Panel({ title, href, children }: { title: string; href: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-border bg-surface-card">
      <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
        <h2 className="text-sm font-extrabold">{title}</h2>
        <Link href={href} className="text-xs font-bold text-primary hover:underline">
          مشاهده همه
        </Link>
      </div>
      {children}
    </section>
  );
}

export default async function AdminDashboard({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ denied?: string }>;
}) {
  const { locale } = await params;
  const session = await requireAdmin('VIEWER', locale);
  const denied = (await searchParams).denied === '1';

  const now = new Date();
  const today = tehranDayStart(now);
  const weekAgo = new Date(today.getTime() - 6 * DAY);
  const criticalLimit = new Date(now.getTime() + EXPIRY_CRITICAL_DAYS * DAY);
  const paid = { status: { in: PAID_STATES } };

  const [
    ordersToday,
    revenueToday,
    revenueWeek,
    openOrders,
    oldestOpen,
    pendingPayment,
    flaggedOrders,
    lowStock,
    outOfStock,
    expiringBatches,
    expiredBatches,
    undatedPerishables,
    newCustomers,
    unreadMessages,
    newLeads,
    recentOrders,
    recentLeads,
    recentMessages,
  ] = await Promise.all([
    db.order.count({ where: { createdAt: { gte: today }, status: { notIn: ['CANCELLED', 'PAYMENT_FAILED'] } } }),
    db.order.aggregate({ where: { ...paid, createdAt: { gte: today } }, _sum: { total: true } }),
    db.order.aggregate({ where: { ...paid, createdAt: { gte: weekAgo } }, _sum: { total: true }, _count: true }),
    db.order.count({ where: { status: { in: ['CONFIRMED', 'PROCESSING'] } } }),
    db.order.findFirst({ where: { status: { in: ['CONFIRMED', 'PROCESSING'] } }, orderBy: { createdAt: 'asc' }, select: { createdAt: true } }),
    db.order.count({ where: { status: 'PENDING_PAYMENT' } }),
    // Notes written by the payment/stock code when a human has to step in.
    db.order.count({
      where: {
        status: { notIn: ['DELIVERED', 'CANCELLED'] },
        OR: [{ adminNote: { contains: '⚠' } }, { adminNote: { contains: 'کسری' } }, { adminNote: { contains: 'بازگشت وجه' } }],
      },
    }),
    db.product.count({ where: { deletedAt: null, isActive: true, stockStatus: 'LOW_STOCK' } }),
    db.product.count({ where: { deletedAt: null, isActive: true, stockStatus: 'OUT_OF_STOCK' } }),
    db.inventory.count({ where: { quantity: { gt: 0 }, expiryDate: { gte: now, lte: criticalLimit }, product: { deletedAt: null } } }),
    db.inventory.count({ where: { quantity: { gt: 0 }, expiryDate: { lt: now }, product: { deletedAt: null } } }),
    db.product.count({
      where: {
        deletedAt: null,
        isActive: true,
        tracksExpiry: true,
        stockStatus: { in: ['IN_STOCK', 'LOW_STOCK'] },
        inventory: { none: { quantity: { gt: 0 }, expiryDate: { gt: now } } },
      },
    }),
    db.customer.count({ where: { createdAt: { gte: weekAgo } } }),
    db.contactMessage.count({ where: { isRead: false } }),
    db.lead.count({ where: { status: 'NEW' } }),
    db.order.findMany({
      orderBy: { createdAt: 'desc' },
      take: 6,
      select: { id: true, number: true, status: true, total: true, shipName: true, createdAt: true },
    }),
    db.lead.findMany({ orderBy: { createdAt: 'desc' }, take: 5, select: { id: true, name: true, phone: true, status: true } }),
    db.contactMessage.findMany({ orderBy: { createdAt: 'desc' }, take: 5, select: { id: true, name: true, message: true, isRead: true } }),
  ]);

  const oldestOpenLate = oldestOpen ? now.getTime() - oldestOpen.createdAt.getTime() > DAY : false;

  const quickLinks = [
    { href: '/admin/orders?status=all', label: 'همه سفارش‌ها' },
    { href: '/admin/inventory', label: 'ثبت محموله جدید' },
    { href: '/admin/products', label: 'محصولات' },
    { href: '/admin/customers', label: 'مشتریان' },
    { href: '/admin/posts', label: 'مقالات' },
    { href: '/admin/leads', label: 'درخواست‌ها' },
  ];

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      {denied && (
        <Alert tone="warning" title="دسترسی ندارید">
          نقش کاربری شما اجازه باز کردن آن بخش را ندارد. در صورت نیاز از مدیر سیستم بخواهید دسترسی شما را تغییر دهد.
        </Alert>
      )}

      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-extrabold sm:text-2xl">داشبورد</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {session.name ? `${session.name}، خوش آمدید. ` : ''}
            امروز {formatJalaliDate(now)}
          </p>
        </div>
        <Link href="/admin/orders?status=open" className="btn btn-gold btn-sm">
          سفارش‌های نیازمند اقدام
        </Link>
      </div>

      {/* What needs doing right now */}
      <section aria-label="کارهای امروز" className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Tile
          href="/admin/orders?status=open"
          icon={ICONS.orders}
          value={faNum(openOrders)}
          label="سفارش نیازمند اقدام"
          hint={
            oldestOpen
              ? `قدیمی‌ترین: ${relativeAgeFa(oldestOpen.createdAt, now)}${oldestOpenLate ? ' (دیر شده)' : ''}`
              : 'سفارشی در صف آماده‌سازی نیست'
          }
          urgent={openOrders > 0}
        />
        <Tile
          href="/admin/orders?status=PENDING_PAYMENT"
          icon={ICONS.clock}
          value={faNum(pendingPayment)}
          label="در انتظار پرداخت"
          hint="پرداخت آنلاین هنوز کامل نشده است"
        />
        <Tile
          href="/admin/inventory"
          icon={ICONS.alert}
          value={faNum(expiringBatches + expiredBatches)}
          label="بچ رو به انقضا"
          hint={`${faNum(expiredBatches)} منقضی با موجودی · ${faNum(expiringBatches)} تا ${faNum(EXPIRY_CRITICAL_DAYS)} روز آینده`}
          urgent={expiringBatches + expiredBatches > 0}
        />
        <Tile
          href="/admin/messages"
          icon={ICONS.mail}
          value={faNum(unreadMessages)}
          label="پیام خوانده‌نشده"
          hint={`${faNum(newLeads)} درخواست مشاوره جدید`}
          urgent={unreadMessages > 0}
        />
      </section>

      {flaggedOrders > 0 && (
        <Alert
          tone="warning"
          title={`${faNum(flaggedOrders)} سفارش یادداشت هشدار دارد`}
          action={
            <Link href="/admin/orders?status=flagged" className="btn btn-outline btn-sm">
              بررسی سفارش‌ها
            </Link>
          }
        >
          در یادداشت این سفارش‌ها «کسری موجودی» یا «نیاز به بازگشت وجه» ثبت شده است.
        </Alert>
      )}

      {/* Sales and stock */}
      <section aria-label="فروش و موجودی" className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-2 xl:grid-cols-4">
        <Tile
          href="/admin/orders?status=all"
          icon={ICONS.orders}
          value={faNum(ordersToday)}
          label="سفارش امروز"
          hint={`فروش امروز: ${toman(revenueToday._sum.total ?? 0)}`}
        />
        <Tile
          href="/admin/orders?status=all"
          icon={ICONS.coin}
          value={toman(revenueWeek._sum.total ?? 0)}
          label="فروش ۷ روز اخیر"
          hint={`${faNum(revenueWeek._count)} سفارش تأییدشده`}
        />
        <Tile
          href="/admin/products"
          icon={ICONS.box}
          value={faNum(outOfStock)}
          label="محصول ناموجود"
          hint={`${faNum(lowStock)} محصول با موجودی محدود${undatedPerishables ? ` · ${faNum(undatedPerishables)} فاسدشدنی بدون تاریخ` : ''}`}
        />
        <Tile href="/admin/customers" icon={ICONS.users} value={faNum(newCustomers)} label="مشتری جدید" hint="در ۷ روز اخیر" />
      </section>

      <nav aria-label="دسترسی سریع" className="flex flex-wrap gap-2">
        {quickLinks.map((l) => (
          <Link key={l.href} href={l.href} className="chip">
            {l.label}
          </Link>
        ))}
      </nav>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <Panel title="آخرین سفارش‌ها" href="/admin/orders?status=all">
            {recentOrders.length === 0 ? (
              <p className="p-6 text-center text-sm text-muted-foreground">هنوز سفارشی ثبت نشده است.</p>
            ) : (
              <ul className="divide-y divide-border">
                {recentOrders.map((o) => (
                  <li key={o.id}>
                    <Link
                      href={`/admin/orders?status=all&q=${encodeURIComponent(o.number)}`}
                      className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3 text-sm hover:bg-surface-hover"
                    >
                      <span className="ltr-nums font-bold" dir="ltr">
                        {o.number}
                      </span>
                      <span className="min-w-0 flex-1 truncate text-foreground/85">{o.shipName}</span>
                      <Badge tone={ORDER_STATUS_TONE[o.status]}>{ORDER_STATUS_LABEL[o.status]}</Badge>
                      <span className="w-full text-xs text-muted-foreground sm:w-auto">
                        {toman(o.total)} · {relativeAgeFa(o.createdAt, now)}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>

        <div className="space-y-5">
          <Panel title="درخواست‌های مشاوره" href="/admin/leads">
            {recentLeads.length === 0 ? (
              <p className="p-6 text-center text-sm text-muted-foreground">هنوز درخواستی ثبت نشده است.</p>
            ) : (
              <ul className="divide-y divide-border">
                {recentLeads.map((lead) => (
                  <li key={lead.id} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm">
                    <span className="min-w-0">
                      <span className="block truncate font-bold">{lead.name || 'بدون نام'}</span>
                      <a href={`tel:${lead.phone}`} dir="ltr" className="ltr-nums text-xs text-muted-foreground hover:text-primary">
                        {lead.phone}
                      </a>
                    </span>
                    <Badge tone={lead.status === 'NEW' ? 'gold' : 'neutral'}>{LEAD_STATUS_FA[lead.status] ?? lead.status}</Badge>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <Panel title="پیام‌های تماس" href="/admin/messages">
            {recentMessages.length === 0 ? (
              <p className="p-6 text-center text-sm text-muted-foreground">هنوز پیامی دریافت نشده است.</p>
            ) : (
              <ul className="divide-y divide-border">
                {recentMessages.map((msg) => (
                  <li key={msg.id} className="px-4 py-2.5 text-sm">
                    <span className="flex items-center justify-between gap-2">
                      <span className="truncate font-bold">{msg.name}</span>
                      {!msg.isRead && <Badge tone="gold">جدید</Badge>}
                    </span>
                    <span className="clamp-1 block text-xs text-muted-foreground">{msg.message}</span>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>
      </div>
    </div>
  );
}
