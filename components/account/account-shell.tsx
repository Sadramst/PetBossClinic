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
    // grid-cols-1 (= minmax(0, 1fr)) lets the column shrink to the screen; with the default
    // auto track the non-wrapping account menu stretched the whole page past a phone's width.
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[240px_minmax(0,1fr)]">
      <AccountNav name={name} phone={customer.phone} />
      <section className="space-y-5 min-w-0">
        <h1 className="text-2xl font-black">{title}</h1>
        {children}
      </section>
    </div>
  );
}
