import type { Metadata } from 'next';
import { setRequestLocale } from 'next-intl/server';
import { CartView } from '@/components/shop/cart-view';
import { getCustomer } from '@/lib/customer/session';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'سبد خرید' };

export default async function CartPage({ params }: { params: Promise<{ locale: string }> }) {
  setRequestLocale((await params).locale);
  const customer = await getCustomer();
  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-black">سبد خرید</h1>
      <CartView loggedIn={!!customer} />
    </div>
  );
}
