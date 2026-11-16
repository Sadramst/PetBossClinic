'use client';

import { Link, usePathname } from '@/i18n/routing';
import { useCart } from '@/components/shop/cart-provider';

/** App-style bottom navigation on phones (how most Iranian shoppers browse). */
export function MobileBottomNav({ phone }: { phone?: string }) {
  const pathname = usePathname();
  const { count, ready } = useCart();
  if (pathname.startsWith('/admin')) return null;

  const telLink = phone ? `tel:${phone.replace(/\s+/g, '')}` : '/contact';
  const item = 'relative flex-1 flex flex-col items-center justify-center gap-0.5 text-[11px]';
  const tone = (p: string) =>
    (p === '/' ? pathname === '/' : pathname.startsWith(p)) ? 'text-primary font-bold' : 'text-muted-foreground';

  return (
    <nav
      aria-label="ناوبری پایین"
      className="lg:hidden fixed bottom-0 inset-x-0 z-50 h-16 border-t border-border bg-surface/95 backdrop-blur flex pb-[env(safe-area-inset-bottom)]"
    >
      <Link href="/" className={`${item} ${tone('/')}`}>
        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" aria-hidden>
          <path d="M3 10.5 12 3l9 7.5V21h-6v-6H9v6H3z" />
        </svg>
        خانه
      </Link>
      <Link href="/shop" className={`${item} ${tone('/shop')}`}>
        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
          <path d="M4 6h16M4 12h16M4 18h10" />
        </svg>
        دسته‌بندی‌ها
      </Link>
      <Link href="/cart" className={`${item} ${tone('/cart')}`}>
        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" aria-hidden>
          <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z M3 6h18 M16 10a4 4 0 0 1-8 0" />
        </svg>
        {ready && count > 0 && (
          <span className="absolute top-1.5 start-[calc(50%+4px)] min-w-4 h-4 px-1 rounded-full bg-primary text-charcoal-950 text-[10px] font-black flex items-center justify-center">
            {count.toLocaleString('fa-IR')}
          </span>
        )}
        سبد خرید
      </Link>
      <Link href="/account" className={`${item} ${tone('/account')}`}>
        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
          <circle cx="12" cy="8" r="4" />
          <path d="M4 21a8 8 0 0 1 16 0" />
        </svg>
        حساب من
      </Link>
      <a href={telLink} className={`${item} text-muted-foreground`}>
        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
          <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.8 19.8 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.18 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.72c.12.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.1 9.9a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.9.34 1.85.58 2.81.7A2 2 0 0 1 22 16.92z" />
        </svg>
        تماس
      </a>
    </nav>
  );
}
