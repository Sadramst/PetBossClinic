import { Suspense, type ReactNode } from 'react';
import { Link } from '@/i18n/routing';
import { requireAdmin } from '@/lib/auth/guard';
import { Alert } from '@/components/ui/alert';
import { formatJalaliDate } from '@/lib/shop/expiry';
import { faNum, roleAtLeast, toman } from '@/components/admin/format';
import { getLoyaltyConfig } from '@/lib/club/config';
import { getClubReport } from '@/lib/club/reports';
import { outboxCounts } from '@/lib/club/messaging/outbox';
import { StatCard } from '@/components/admin/kit/stat-card';
import { WIDGETS, canSeeWidget, type WidgetId } from '@/components/admin/dashboard/visibility';
import {
  CartsWidget,
  ChurnWidget,
  ExpiryWidget,
  ICONS,
  LeadsWidget,
  LowStockWidget,
  MessagesWidget,
  OrdersActionWidget,
  OutboxWidget,
  RecentOrdersWidget,
  SalesWidget,
  TasksWidget,
  WidgetSkeleton,
} from '@/components/admin/dashboard/widgets';

export const dynamic = 'force-dynamic';

function Icon({ d }: { d: string }) {
  return (
    <svg className="h-5 w-5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d={d} />
    </svg>
  );
}

/** Club numbers: customer data, so staff only. A failure never breaks the dashboard. */
async function ClubKpis() {
  const club = await Promise.all([getLoyaltyConfig().then((c) => getClubReport(c.pointValueToman)), outboxCounts()])
    .then(([report, counts]) => ({ report, queued: counts.QUEUED }))
    .catch(() => null);
  if (!club) return null;
  return (
    <section aria-label="باشگاه مشتریان" className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-2 xl:grid-cols-4" data-testid="club-kpis">
      <StatCard href="/admin/club" icon={<Icon d={ICONS.users} />} value={faNum(club.report.members)} label="عضو باشگاه مشتریان" hint="مشتریان ثبت‌نام‌شده" />
      <StatCard href="/admin/customers" icon={<Icon d={ICONS.users} />} value={faNum(club.report.activeThisMonth)} label="فعال در ۳۰ روز اخیر" hint="خرید یا خدمت کلینیک" />
      <StatCard href="/admin/club" icon={<Icon d={ICONS.coin} />} value={faNum(club.report.pointsOutstanding)} label="امتیاز در گردش" hint={`بدهی باشگاه: ${toman(club.report.liabilityToman)}`} />
      <StatCard href="/admin/outbox" icon={<Icon d={ICONS.send} />} value={faNum(club.queued)} label="پیامک در صف ارسال" hint="کمپین، یادآوری و پیام‌های دستی" tone={club.queued > 0 ? 'gold' : 'neutral'} />
    </section>
  );
}

function Slot({ children, tall }: { children: ReactNode; tall?: boolean }) {
  return <Suspense fallback={<WidgetSkeleton tall={tall} />}>{children}</Suspense>;
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
  const role = session.role;
  const can = (id: WidgetId) => canSeeWidget(role, id);
  const hasAnyWidget = (Object.keys(WIDGETS) as WidgetId[]).some(can);

  const quickLinks = [
    { href: '/admin/orders?status=all', label: 'همه سفارش‌ها', min: 'VIEWER' },
    { href: '/admin/inventory', label: 'ثبت محموله جدید', min: 'EDITOR' },
    { href: '/admin/products', label: 'محصولات', min: 'EDITOR' },
    { href: '/admin/customers', label: 'مشتریان', min: 'VIEWER' },
    { href: '/admin/leads', label: 'سرنخ‌ها', min: 'VIEWER' },
    { href: '/admin/posts', label: 'مقالات', min: 'AUTHOR' },
    { href: '/admin/media', label: 'رسانه', min: 'AUTHOR' },
  ].filter((l) => roleAtLeast(role, l.min));

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
            امروز {formatJalaliDate(new Date())}
          </p>
        </div>
        {can('ordersAction') && (
          <Link href="/admin/orders?status=open" className="btn btn-gold btn-sm">
            سفارش‌های نیازمند اقدام
          </Link>
        )}
      </div>

      {!hasAnyWidget && (
        <Alert tone="info" title="به پنل مدیریت خوش آمدید">
          از منوی کناری بخش مورد نظرتان را باز کنید.
        </Alert>
      )}

      {/* Numbers first: what to look at right now. */}
      {(can('sales') || can('lowStock') || can('outbox')) && (
        <section aria-label="خلاصه امروز" className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-2 xl:grid-cols-4" data-testid="dashboard-tiles">
          {can('sales') && (
            <Slot>
              <SalesWidget />
            </Slot>
          )}
          {can('lowStock') && (
            <Slot>
              <LowStockWidget />
            </Slot>
          )}
          {can('outbox') && (
            <Slot>
              <OutboxWidget />
            </Slot>
          )}
        </section>
      )}

      {/* Work lists: each one links to its pre-filtered page. */}
      <section aria-label="کارهای امروز" className="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-3" data-testid="dashboard-widgets">
        {can('tasks') && (
          <Slot tall>
            <TasksWidget userId={session.userId} />
          </Slot>
        )}
        {can('ordersAction') && (
          <Slot tall>
            <OrdersActionWidget />
          </Slot>
        )}
        {can('leads') && (
          <Slot tall>
            <LeadsWidget />
          </Slot>
        )}
        {can('messages') && (
          <Slot tall>
            <MessagesWidget />
          </Slot>
        )}
        {can('expiry') && (
          <Slot tall>
            <ExpiryWidget />
          </Slot>
        )}
        {can('carts') && (
          <Slot tall>
            <CartsWidget />
          </Slot>
        )}
        {can('churn') && (
          <Slot tall>
            <ChurnWidget />
          </Slot>
        )}
        {can('recentOrders') && (
          <div className="lg:col-span-2 xl:col-span-2">
            <Slot tall>
              <RecentOrdersWidget />
            </Slot>
          </div>
        )}
      </section>

      {roleAtLeast(role, 'EDITOR') && (
        <Slot>
          <ClubKpis />
        </Slot>
      )}

      <nav aria-label="دسترسی سریع" className="flex flex-wrap gap-2">
        {quickLinks.map((l) => (
          <Link key={l.href} href={l.href as never} className="chip">
            {l.label}
          </Link>
        ))}
      </nav>
    </div>
  );
}
