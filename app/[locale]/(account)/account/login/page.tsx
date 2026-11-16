import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { setRequestLocale } from 'next-intl/server';
import { Link } from '@/i18n/routing';
import { LoginForm } from '@/components/account/login-form';
import { getCustomer, safeNext } from '@/lib/customer/session';
import { getClinicNAP } from '@/lib/clinic/nap';
import { customerLoginEnabled } from '@/lib/sms';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'ورود یا ثبت‌نام' };

export default async function CustomerLoginPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ next?: string }>;
}) {
  setRequestLocale((await params).locale);
  const next = safeNext((await searchParams).next);
  const customer = await getCustomer();
  // Signed in with a complete profile: nothing to do here.
  if (customer?.firstName) redirect(next);
  // Signed in but new (no name yet): continue with the profile step.
  if (customer) return <LoginForm next={next} initialStep="profile" />;

  if (!customerLoginEnabled()) {
    const nap = await getClinicNAP();
    return (
      <div className="max-w-md mx-auto rounded-3xl border border-border bg-surface-card p-8 text-center space-y-4">
        <h1 className="text-2xl font-black">حساب کاربری به‌زودی</h1>
        <p className="text-sm text-muted-foreground leading-7">
          ثبت‌نام و پرداخت آنلاین به‌زودی فعال می‌شود. تا آن زمان سفارش خود را از سبد خرید در واتس‌اپ یا تلفنی ثبت کنید.
        </p>
        <div className="flex flex-col gap-2">
          <Link href="/cart" className="h-11 leading-[2.75rem] rounded-xl bg-gradient-gold text-charcoal-950 font-bold">
            رفتن به سبد خرید
          </Link>
          <a href={nap.telLink} className="h-11 leading-[2.75rem] rounded-xl border border-primary text-primary font-bold">
            تماس با کلینیک
          </a>
        </div>
      </div>
    );
  }
  return <LoginForm next={next} />;
}
