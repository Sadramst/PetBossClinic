import type { Metadata } from 'next';
import { setRequestLocale } from 'next-intl/server';
import { db } from '@/lib/db';
import { AccountShell } from '@/components/account/account-shell';
import { AddressBook } from '@/components/account/address-book';
import { requireCustomer } from '@/lib/customer/session';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'نشانی‌های من' };

export default async function AddressesPage({ params }: { params: Promise<{ locale: string }> }) {
  setRequestLocale((await params).locale);
  const customer = await requireCustomer('/account/addresses');
  const addresses = await db.address.findMany({
    where: { customerId: customer.id, deletedAt: null },
    orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
  });

  return (
    <AccountShell customer={customer} title="نشانی‌های من">
      <AddressBook
        addresses={addresses}
        recipient={{ name: [customer.firstName, customer.lastName].filter(Boolean).join(' '), phone: customer.phone }}
      />
    </AccountShell>
  );
}
