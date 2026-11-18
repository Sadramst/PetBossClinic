import type { Metadata } from 'next';
import { setRequestLocale } from 'next-intl/server';
import { Link } from '@/i18n/routing';
import { db } from '@/lib/db';
import { AccountShell } from '@/components/account/account-shell';
import { ProfileForm } from '@/components/account/profile-form';
import { requireCustomer } from '@/lib/customer/session';
import { formatPrice } from '@/lib/format/price';
import { formatJalaliDate } from '@/lib/shop/expiry';
import { ORDER_STATUS_FA } from '@/lib/shop/orders';
import { getUnusedWelcomeCode } from '@/lib/marketing/my-coupons';
import { CopyButton } from '@/components/marketing/copy-button';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'سفارش‌های من' };

export default async function AccountPage({ params }: { params: Promise<{ locale: string }> }) {
  setRequestLocale((await params).locale);
  const customer = await requireCustomer('/account');

  const welcomeCode = await getUnusedWelcomeCode(customer).catch(() => null);
  const orders = await db.order.findMany({
    where: { customerId: customer.id },
    orderBy: { createdAt: 'desc' },
    take: 50,
    select: { id: true, number: true, status: true, total: true, createdAt: true, _count: { select: { items: true } } },
  });

  return (
    <AccountShell customer={customer} title="سفارش‌های من">
      {!customer.firstName && (
        <div className="rounded-2xl border border-primary/40 bg-primary/5 p-5 space-y-3">
          <p className="font-bold text-sm">برای ارسال سفارش، نام خود را تکمیل کنید.</p>
          <ProfileForm firstName="" lastName="" email="" />
        </div>
      )}

      {welcomeCode && (
        <div data-testid="welcome-banner" className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-primary/40 bg-primary/5 p-4">
          <div className="min-w-0 space-y-1">
            <p className="text-sm font-bold">کد تخفیف خوش‌آمدگویی شما هنوز استفاده نشده است.</p>
            <p dir="ltr" className="text-start font-black tracking-widest text-primary [overflow-wrap:anywhere]">{welcomeCode}</p>
          </div>
          <div className="flex gap-2">
            <CopyButton text={welcomeCode} />
            <Link href="/account/coupons" className="btn btn-gold btn-sm">کدهای من</Link>
          </div>
        </div>
      )}

      {orders.length === 0 ? (
        <div className="rounded-2xl border border-border bg-surface-card p-10 text-center space-y-3">
          <p className="font-bold">هنوز سفارشی ثبت نکرده‌اید.</p>
          <Link href="/shop" className="inline-block h-11 px-6 leading-[2.75rem] rounded-xl bg-gradient-gold text-charcoal-950 font-bold text-sm">
            رفتن به پت‌شاپ
          </Link>
        </div>
      ) : (
        <ul className="space-y-3">
          {orders.map((o) => (
            <li key={o.id}>
              <Link
                href={`/account/orders/${o.number}`}
                className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-surface-card p-4 hover:border-primary"
              >
                <div>
                  <p className="font-bold" dir="ltr">{o.number}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {formatJalaliDate(o.createdAt)} · {o._count.items.toLocaleString('fa-IR')} قلم
                  </p>
                </div>
                <span className="text-xs rounded-full border border-border px-3 py-1">{ORDER_STATUS_FA[o.status]}</span>
                <span className="font-bold text-gradient-gold">{formatPrice(o.total, 'fa')}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </AccountShell>
  );
}
