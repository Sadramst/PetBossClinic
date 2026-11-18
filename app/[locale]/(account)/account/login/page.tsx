import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { setRequestLocale } from 'next-intl/server';
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
  searchParams: Promise<{ next?: string; mode?: string }>;
}) {
  setRequestLocale((await params).locale);
  const sp = await searchParams;
  const next = safeNext(sp.next);
  const customer = await getCustomer();
  // Signed in with a complete profile: nothing to do here.
  if (customer?.firstName) redirect(next);

  const nap = await getClinicNAP();
  return (
    <LoginForm
      next={next}
      // Signed in but new (no name yet): continue with the profile step.
      initialMode={customer ? 'profile' : sp.mode === 'register' ? 'register' : 'password'}
      smsEnabled={customerLoginEnabled()}
      supportPhone={nap.telLink}
    />
  );
}
