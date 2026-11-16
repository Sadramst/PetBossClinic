import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { setRequestLocale } from 'next-intl/server';
import { db } from '@/lib/db';
import { CheckoutForm } from '@/components/shop/checkout-form';
import { requireCustomer } from '@/lib/customer/session';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'تکمیل خرید' };

export default async function CheckoutPage({ params }: { params: Promise<{ locale: string }> }) {
  setRequestLocale((await params).locale);
  const customer = await requireCustomer('/checkout');
  // Orders need the buyer's name: finish the profile step first.
  if (!customer.firstName) redirect('/account/login?next=/checkout');
  const addresses = await db.address.findMany({
    where: { customerId: customer.id, deletedAt: null },
    orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
  });

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-black">تکمیل خرید</h1>
      <CheckoutForm
        addresses={addresses}
        recipient={{ name: [customer.firstName, customer.lastName].filter(Boolean).join(' '), phone: customer.phone }}
      />
    </div>
  );
}
