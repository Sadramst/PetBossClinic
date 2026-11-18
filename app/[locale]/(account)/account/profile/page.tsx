import type { Metadata } from 'next';
import { setRequestLocale } from 'next-intl/server';
import { AccountShell } from '@/components/account/account-shell';
import { PasswordForm } from '@/components/account/password-form';
import { ProfileForm } from '@/components/account/profile-form';
import { requireCustomer } from '@/lib/customer/session';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'اطلاعات حساب' };

export default async function ProfilePage({ params }: { params: Promise<{ locale: string }> }) {
  setRequestLocale((await params).locale);
  const customer = await requireCustomer('/account/profile');
  const hasPassword = !!customer.passwordHash;
  return (
    <AccountShell customer={customer} title="اطلاعات حساب">
      <div className="rounded-2xl border border-border bg-surface-card p-5 space-y-4">
        <p className="text-sm text-muted-foreground">
          شماره موبایل: <span dir="ltr" className="text-foreground">{customer.phone}</span>
        </p>
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
