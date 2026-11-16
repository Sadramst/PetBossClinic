import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { setRequestLocale } from 'next-intl/server';
import { LoginForm } from '@/components/account/login-form';
import { getCustomer, safeNext } from '@/lib/customer/session';

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
  return <LoginForm next={next} initialStep={customer ? 'profile' : 'phone'} />;
}
