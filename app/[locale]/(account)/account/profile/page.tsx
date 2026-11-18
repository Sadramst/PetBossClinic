import type { Metadata } from 'next';
import { setRequestLocale } from 'next-intl/server';
import { AccountShell } from '@/components/account/account-shell';
import { PasswordForm } from '@/components/account/password-form';
import { PhoneConfirm } from '@/components/account/phone-confirm';
import { ProfileForm } from '@/components/account/profile-form';
import { requireCustomer } from '@/lib/customer/session';
import { customerLoginEnabled } from '@/lib/sms';
import { formatJalaliDate } from '@/lib/shop/expiry';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'اطلاعات حساب' };

export default async function ProfilePage({ params }: { params: Promise<{ locale: string }> }) {
  setRequestLocale((await params).locale);
  const customer = await requireCustomer('/account/profile');
  const hasPassword = !!customer.passwordHash;
  return (
    <AccountShell customer={customer} title="اطلاعات حساب">
      <div className="rounded-2xl border border-border bg-surface-card p-5 space-y-4">
        <dl className="grid gap-2 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-muted-foreground">شماره موبایل</dt>
            <dd className="mt-1 flex flex-wrap items-center gap-2">
              <span dir="ltr" className="text-foreground">{customer.phone}</span>
              {customer.phoneVerifiedAt ? (
                <span data-testid="phone-verified" className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs font-bold text-emerald-300">تأیید شده</span>
              ) : (
                <span data-testid="phone-unverified" className="rounded-full bg-amber-500/15 px-2 py-0.5 text-xs font-bold text-amber-200">تأیید نشده</span>
              )}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">عضویت از</dt>
            <dd className="mt-1">{formatJalaliDate(customer.createdAt)}</dd>
          </div>
        </dl>
        {!customer.phoneVerifiedAt &&
          (customerLoginEnabled() ? (
            <PhoneConfirm phone={customer.phone} />
          ) : (
            <p className="text-xs leading-6 text-muted-foreground">تأیید شماره با پیامک به‌زودی فعال می‌شود. تا آن زمان می‌توانید بدون تأیید خرید کنید.</p>
          ))}
        <ProfileForm firstName={customer.firstName ?? ''} lastName={customer.lastName ?? ''} email={customer.email ?? ''} />
      </div>

      <section aria-labelledby="password-heading" className="rounded-2xl border border-border bg-surface-card p-5 space-y-4">
        <div>
          <h2 id="password-heading" className="font-bold">
            {hasPassword ? 'تغییر رمز عبور' : 'تعیین رمز عبور'}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {hasPassword
              ? 'برای امنیت بیشتر، رمز عبور خود را هر چند وقت یک‌بار تغییر دهید.'
              : 'با تعیین رمز عبور، دفعات بعد بدون کد پیامکی و فقط با شماره موبایل و رمز وارد می‌شوید.'}
          </p>
        </div>
        <PasswordForm hasPassword={hasPassword} />
      </section>
    </AccountShell>
  );
}
