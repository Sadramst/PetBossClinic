'use client';

import { Link, usePathname } from '@/i18n/routing';
import { customerLogoutAction } from '@/app/actions/customer-auth';

const LINKS = [
  { href: '/account', label: 'سفارش‌های من' },
  { href: '/account/coupons', label: 'کدهای تخفیف من' },
  { href: '/account/addresses', label: 'نشانی‌ها' },
  { href: '/account/profile', label: 'اطلاعات حساب' },
];

export function AccountNav({ name, phone }: { name: string; phone: string }) {
  const pathname = usePathname();
  return (
    <aside className="rounded-2xl border border-border bg-surface-card p-4 space-y-4 h-fit">
      <div>
        <p className="font-bold">{name}</p>
        <p className="text-xs text-muted-foreground" dir="ltr">{phone}</p>
      </div>
      <nav aria-label="حساب کاربری" className="flex lg:flex-col gap-1 overflow-x-auto text-sm">
        {LINKS.map((l) => (
          <Link
            key={l.href}
            href={l.href}
            aria-current={pathname === l.href ? 'page' : undefined}
            className={`whitespace-nowrap rounded-lg px-3 py-2 ${pathname === l.href ? 'bg-primary/10 text-primary font-bold' : 'hover:bg-surface-hover'}`}
          >
            {l.label}
          </Link>
        ))}
        <button
          onClick={async () => {
            await customerLogoutAction();
            window.location.assign('/');
          }}
          className="whitespace-nowrap rounded-lg px-3 py-2 text-start text-red-400 hover:bg-surface-hover"
        >
          خروج
        </button>
      </nav>
    </aside>
  );
}
