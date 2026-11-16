import type { Metadata } from 'next';
import { setRequestLocale } from 'next-intl/server';
import { AccountShell } from '@/components/account/account-shell';
import { ProfileForm } from '@/components/account/profile-form';
import { requireCustomer } from '@/lib/customer/session';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'اطلاعات حساب' };

export default async function ProfilePage({ params }: { params: Promise<{ locale: string }> }) {
  setRequestLocale((await params).locale);
  const customer = await requireCustomer('/account/profile');
  return (
    <AccountShell customer={customer} title="اطلاعات حساب">
      <div className="rounded-2xl border border-border bg-surface-card p-5 space-y-4">
        <p className="text-sm text-muted-foreground">
          شماره موبایل: <span dir="ltr" className="text-foreground">{customer.phone}</span>
        </p>
        <ProfileForm firstName={customer.firstName ?? ''} lastName={customer.lastName ?? ''} email={customer.email ?? ''} />
      </div>
    </AccountShell>
  );
}
