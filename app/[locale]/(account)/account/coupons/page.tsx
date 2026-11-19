import type { Metadata } from 'next';
import { setRequestLocale } from 'next-intl/server';
import { Link } from '@/i18n/routing';
import { AccountShell } from '@/components/account/account-shell';
import { CopyButton } from '@/components/marketing/copy-button';
import { requireCustomer } from '@/lib/customer/session';
import { formatPrice } from '@/lib/format/price';
import { getMyCoupons, type MyCoupon, type MyCouponStatus } from '@/lib/marketing/my-coupons';
import { formatJalaliDate } from '@/lib/shop/expiry';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'کدهای تخفیف من' };

const STATUS: Record<MyCouponStatus, { label: string; cls: string }> = {
  available: { label: 'قابل استفاده', cls: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-400' },
  upcoming: { label: 'به‌زودی فعال می‌شود', cls: 'border-amber-500/40 bg-amber-500/10 text-amber-400' },
  used: { label: 'استفاده شده', cls: 'border-border text-muted-foreground' },
  expired: { label: 'منقضی شده', cls: 'border-border text-muted-foreground' },
  inactive: { label: 'غیرفعال', cls: 'border-border text-muted-foreground' },
};
const KIND: Record<MyCoupon['kind'], string> = { welcome: 'هدیه خوش‌آمد', personal: 'کد اختصاصی شما', group: 'ویژه مشتریان باشگاه' };

export default async function CouponsPage({ params }: { params: Promise<{ locale: string }> }) {
  setRequestLocale((await params).locale);
  const customer = await requireCustomer('/account/coupons');
  const coupons = await getMyCoupons(customer);

  return (
    <AccountShell customer={customer} title="کدهای تخفیف من">
      {coupons.length === 0 ? (
        <div className="space-y-3 rounded-2xl border border-border bg-surface-card p-10 text-center">
          <p className="font-bold">فعلاً کد تخفیفی برای حساب شما ثبت نشده است.</p>
          <p className="text-sm leading-7 text-muted-foreground">با ثبت شماره موبایل یا ایمیل در سایت، کد تخفیف اولین خریدتان ساخته می‌شود.</p>
          <Link href="/shop" className="btn btn-gold inline-flex">
            رفتن به پت‌شاپ
          </Link>
        </div>
      ) : (
        <ul data-testid="my-coupons-list" className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {coupons.map((c) => {
            const st = STATUS[c.status];
            const dim = c.status !== 'available';
            return (
              <li key={c.id} className={`min-w-0 space-y-3 rounded-2xl border border-border bg-surface-card p-4 ${dim ? 'opacity-70' : ''}`}>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-xs text-muted-foreground">{KIND[c.kind]}</p>
                    <p className="clamp-2 font-extrabold">{c.title}</p>
                  </div>
                  <span className={`shrink-0 rounded-full border px-2.5 py-0.5 text-[11px] font-bold ${st.cls}`}>{st.label}</span>
                </div>
                <p className="text-sm font-bold text-primary">{c.offer}</p>
                <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-dashed border-primary/50 bg-primary/5 px-3 py-2">
                  <span dir="ltr" className="font-black tracking-widest [overflow-wrap:anywhere]">
                    {c.code}
                  </span>
                  {c.status === 'available' && <CopyButton text={c.code} />}
                </div>
                <ul className="space-y-0.5 text-xs leading-6 text-muted-foreground">
                  {c.minSubtotal > 0 && <li>حداقل خرید: {formatPrice(c.minSubtotal, 'fa')}</li>}
                  {c.firstOrderOnly && <li>فقط برای اولین خرید</li>}
                  {c.startsAt && c.status === 'upcoming' && <li>شروع: {formatJalaliDate(new Date(c.startsAt))}</li>}
                  {c.endsAt && <li>اعتبار تا: {formatJalaliDate(new Date(c.endsAt))}</li>}
                  {c.description && <li>{c.description}</li>}
                </ul>
                {c.status === 'available' && (
                  <Link href="/cart" className="btn btn-outline btn-sm">
                    استفاده در سبد خرید
                  </Link>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </AccountShell>
  );
}
