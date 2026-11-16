import { AccountNav } from '@/components/account/account-nav';

export function AccountShell({
  customer,
  title,
  children,
}: {
  customer: { firstName: string | null; lastName: string | null; phone: string };
  title: string;
  children: React.ReactNode;
}) {
  const name = [customer.firstName, customer.lastName].filter(Boolean).join(' ') || 'مشتری پت‌باس';
  return (
    <div className="grid gap-6 lg:grid-cols-[240px_1fr]">
      <AccountNav name={name} phone={customer.phone} />
      <section className="space-y-5 min-w-0">
        <h1 className="text-2xl font-black">{title}</h1>
        {children}
      </section>
    </div>
  );
}
