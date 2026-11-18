'use client';

import { Link, usePathname } from '@/i18n/routing';
import { useCart } from '@/components/shop/cart-provider';

const ITEM =
  'relative flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5 text-xs transition-colors active:bg-surface-hover';
/** 2px gold bar on top of the current tab. */
const ACTIVE =
  'font-bold text-primary before:absolute before:top-0 before:h-0.5 before:w-8 before:rounded-full before:bg-primary';
const IDLE = 'text-muted-foreground';

function Icon({ active, children }: { active: boolean; children: React.ReactNode }) {
  return (
    <svg
      className="h-[22px] w-[22px]"
      viewBox="0 0 24 24"
      fill={active ? 'currentColor' : 'none'}
      fillOpacity={active ? 0.18 : undefined}
      stroke="currentColor"
      strokeWidth={active ? 2.2 : 1.9}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      {children}
    </svg>
  );
}

/** App-style bottom navigation on phones (how most Iranian shoppers browse). */
export function MobileBottomNav({ phone }: { phone?: string }) {
  const pathname = usePathname();
  const { count, ready } = useCart();
  if (pathname.startsWith('/admin')) return null;

  const telLink = phone ? `tel:${phone.replace(/\s+/g, '')}` : '/contact';
  const under = (...prefixes: string[]) => prefixes.some((p) => pathname === p || pathname.startsWith(`${p}/`));
  const tabs = {
    home: pathname === '/',
    // Product and brand pages belong to the shop.
    shop: under('/shop', '/product', '/brand'),
    cart: under('/cart', '/checkout'),
    account: under('/account'),
  };
  const cls = (active: boolean) => `${ITEM} ${active ? ACTIVE : IDLE}`;
  const current = (active: boolean) => (active ? ('page' as const) : undefined);
  const hasItems = ready && count > 0;

  return (
    <nav
      aria-label="ناوبری پایین"
      className="pb-safe fixed inset-x-0 bottom-0 z-50 flex h-[calc(var(--bottom-nav-h,4rem)+env(safe-area-inset-bottom,0px))] border-t border-border bg-surface/95 backdrop-blur lg:hidden print:hidden"
    >
      <Link href="/" className={cls(tabs.home)} aria-current={current(tabs.home)}>
        <Icon active={tabs.home}>
          <path d="M3 10.5 12 3l9 7.5V21h-6v-6H9v6H3z" />
        </Icon>
        خانه
      </Link>
      <Link href="/shop" className={cls(tabs.shop)} aria-current={current(tabs.shop)}>
        <Icon active={tabs.shop}>
          <rect x="3.5" y="3.5" width="7" height="7" rx="1.5" />
          <rect x="13.5" y="3.5" width="7" height="7" rx="1.5" />
          <rect x="3.5" y="13.5" width="7" height="7" rx="1.5" />
          <rect x="13.5" y="13.5" width="7" height="7" rx="1.5" />
        </Icon>
        دسته‌بندی‌ها
      </Link>
      <Link href="/cart" className={cls(tabs.cart)} aria-current={current(tabs.cart)}>
        <Icon active={tabs.cart}>
          <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z M3 6h18 M16 10a4 4 0 0 1-8 0" />
        </Icon>
        {hasItems && (
          <span
            aria-hidden
            className="absolute start-[calc(50%+4px)] top-1.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-primary px-1 text-[11px] font-black leading-none text-charcoal-950 ring-2 ring-surface"
          >
            {count > 99 ? '+۹۹' : count.toLocaleString('fa-IR')}
          </span>
        )}
        سبد خرید
        {hasItems && <span className="sr-only">، {count.toLocaleString('fa-IR')} کالا</span>}
      </Link>
      <Link href="/account" className={cls(tabs.account)} aria-current={current(tabs.account)}>
        <Icon active={tabs.account}>
          <circle cx="12" cy="8" r="4" />
          <path d="M4 21a8 8 0 0 1 16 0" />
        </Icon>
        حساب من
      </Link>
      <a href={telLink} className={`${ITEM} ${IDLE}`}>
        <Icon active={false}>
          <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.8 19.8 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.18 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.72c.12.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.1 9.9a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.9.34 1.85.58 2.81.7A2 2 0 0 1 22 16.92z" />
        </Icon>
        تماس
      </a>
    </nav>
  );
}
