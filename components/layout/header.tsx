'use client';

import { useEffect, useState } from 'react';
import { Link, usePathname } from '@/i18n/routing';
import { PetBossLogo } from '@/components/shared/pet-boss-logo';
import type { NavItem } from '@/lib/navigation/menu';
import { categoryPath } from '@/lib/shop/urls';

export interface HeaderCategory {
  id: string;
  slugFa: string;
  nameFa: string;
}

const DEFAULT_LINKS = [
  { href: '/services', label: 'خدمات کلینیک' },
  { href: '/about', label: 'درباره ما' },
  { href: '/faq', label: 'سوالات متداول' },
  { href: '/contact', label: 'تماس با ما' },
];

const PHONE_PATH =
  'M22 16.92v3a2 2 0 0 1-2.18 2 19.8 19.8 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.18 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.72c.12.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.1 9.9a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.9.34 1.85.58 2.81.7A2 2 0 0 1 22 16.92z';

/** Product search box. A plain GET form to /shop, so it works before hydration too. */
export function SiteSearch({ id, className = '' }: { id: string; className?: string }) {
  return (
    <form action="/shop" method="get" role="search" className={`relative ${className}`}>
      <label htmlFor={id} className="sr-only">
        جستجوی محصولات
      </label>
      <input
        id={id}
        type="search"
        name="q"
        placeholder="جستجو در غذا، تشویقی و لوازم سگ و گربه…"
        className="w-full h-11 rounded-2xl border border-border bg-input ps-11 pe-4 text-sm placeholder:text-muted-foreground focus:border-primary focus:outline-none"
      />
      <button
        type="submit"
        aria-label="جستجو"
        className="absolute inset-y-0 start-0 w-11 flex items-center justify-center text-muted-foreground hover:text-primary"
      >
        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-3.5-3.5" />
        </svg>
      </button>
    </form>
  );
}

export function Header({
  logoUrl,
  navItems,
  phone = '',
  categories = [],
}: {
  logoUrl?: string;
  navItems?: NavItem[];
  phone?: string;
  categories?: HeaderCategory[];
}) {
  const pathname = usePathname();
  const [drawerOpen, setDrawerOpen] = useState(false);

  useEffect(() => setDrawerOpen(false), [pathname]);

  if (pathname.startsWith('/admin')) return null;

  // Admin-managed menu; home and shop have dedicated slots in this layout.
  const links =
    navItems && navItems.length > 0
      ? navItems.filter((i) => i.url !== '/' && i.url !== '/shop').map((i) => ({ href: i.url, label: i.labelFa }))
      : DEFAULT_LINKS;
  const telLink = phone ? `tel:${phone.replace(/\s+/g, '')}` : '/contact';
  const isActive = (href: string) => (href === '/' ? pathname === '/' : pathname.startsWith(href));

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/60 bg-surface/95 backdrop-blur supports-[backdrop-filter]:bg-surface/85">
      {/* Trust strip */}
      <div className="hidden md:block border-b border-border/50 bg-background/60 text-[12px] text-muted-foreground">
        <div className="container mx-auto max-w-7xl px-4 h-8 flex items-center justify-between">
          <p className="flex gap-5">
            <span>✓ ضمانت اصالت کالا</span>
            <span>✓ تاریخ انقضای معتبر</span>
            <span>✓ مشاوره رایگان دامپزشک</span>
            <span>✓ ارسال سریع در تهران</span>
          </p>
          {phone && (
            <a href={telLink} className="hover:text-primary" dir="ltr">
              {phone}
            </a>
          )}
        </div>
      </div>

      {/* Main row */}
      <div className="container mx-auto max-w-7xl px-4 h-16 lg:h-20 flex items-center gap-3 lg:gap-6">
        <button
          type="button"
          onClick={() => setDrawerOpen(true)}
          className="lg:hidden p-2 -ms-2 rounded-lg hover:bg-surface-hover"
          aria-label="باز کردن منو"
          aria-expanded={drawerOpen}
        >
          <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
            <path d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>

        <Link href="/" className="shrink-0" aria-label="پت‌باس - صفحه اصلی">
          <PetBossLogo size="md" variant="gold" logoUrl={logoUrl} />
        </Link>

        <SiteSearch id="site-search" className="hidden md:block flex-1 max-w-2xl" />

        <div className="ms-auto flex items-center gap-2">
          <a
            href={telLink}
            className="hidden sm:inline-flex items-center gap-2 h-11 px-5 rounded-2xl bg-gradient-gold text-charcoal-950 font-bold text-sm shadow-gold hover:opacity-90"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden>
              <path d={PHONE_PATH} />
            </svg>
            تماس و مشاوره
          </a>
          <a href={telLink} className="sm:hidden p-2.5 rounded-xl border border-primary/50 text-primary" aria-label="تماس با کلینیک">
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
              <path d={PHONE_PATH} />
            </svg>
          </a>
        </div>
      </div>

      {/* Mobile search */}
      <div className="md:hidden px-4 pb-3">
        <SiteSearch id="site-search-mobile" />
      </div>

      {/* Desktop nav */}
      <nav aria-label="منوی اصلی" className="hidden lg:block border-t border-border/50">
        <div className="container mx-auto max-w-7xl px-4 h-12 flex items-center gap-1 text-sm">
          <div className="relative group">
            <Link
              href="/shop"
              className={`h-12 inline-flex items-center gap-2 px-4 font-bold ${isActive('/shop') ? 'text-primary' : 'hover:text-primary'}`}
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
                <path d="M4 6h16M4 12h16M4 18h10" />
              </svg>
              دسته‌بندی محصولات
            </Link>
            {categories.length > 0 && (
              <div className="invisible opacity-0 group-hover:visible group-hover:opacity-100 group-focus-within:visible group-focus-within:opacity-100 transition-opacity absolute top-full start-0 w-[560px] rounded-2xl border border-border bg-surface-card shadow-gold-lg p-5 grid grid-cols-2 gap-x-6 gap-y-1">
                {categories.map((c) => (
                  <Link key={c.id} href={categoryPath(c.slugFa)} className="rounded-lg px-3 py-2 hover:bg-surface-hover hover:text-primary">
                    {c.nameFa}
                  </Link>
                ))}
                <Link
                  href="/shop"
                  className="col-span-2 mt-2 text-center rounded-lg px-3 py-2 border border-primary/40 text-primary font-bold hover:bg-primary/10"
                >
                  مشاهده همه محصولات
                </Link>
              </div>
            )}
          </div>
          <Link href="/shop?pet=cat" className="px-3 h-12 inline-flex items-center hover:text-primary">
            محصولات گربه
          </Link>
          <Link href="/shop?pet=dog" className="px-3 h-12 inline-flex items-center hover:text-primary">
            محصولات سگ
          </Link>
          <span className="mx-2 h-5 w-px bg-border" aria-hidden />
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className={`px-3 h-12 inline-flex items-center ${isActive(l.href) ? 'text-primary font-bold' : 'text-foreground/85 hover:text-primary'}`}
            >
              {l.label}
            </Link>
          ))}
        </div>
      </nav>

      {/* Mobile drawer */}
      {drawerOpen && (
        <div className="lg:hidden fixed inset-0 z-[60]" role="dialog" aria-modal="true" aria-label="منو">
          <button className="absolute inset-0 bg-black/60" aria-label="بستن منو" onClick={() => setDrawerOpen(false)} />
          <div className="absolute inset-y-0 start-0 w-[85%] max-w-sm bg-surface border-e border-border overflow-y-auto p-5 space-y-6">
            <div className="flex items-center justify-between">
              <PetBossLogo size="sm" variant="gold" logoUrl={logoUrl} />
              <button onClick={() => setDrawerOpen(false)} className="p-2 rounded-lg hover:bg-surface-hover" aria-label="بستن منو">
                ✕
              </button>
            </div>
            <div>
              <p className="text-xs font-bold text-primary mb-2">پت‌شاپ</p>
              <ul className="space-y-1 text-sm">
                <li>
                  <Link href="/shop" className="block rounded-lg px-3 py-2 hover:bg-surface-hover font-bold">
                    همه محصولات
                  </Link>
                </li>
                {categories.map((c) => (
                  <li key={c.id}>
                    <Link href={categoryPath(c.slugFa)} className="block rounded-lg px-3 py-2 hover:bg-surface-hover">
                      {c.nameFa}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <p className="text-xs font-bold text-primary mb-2">کلینیک</p>
              <ul className="space-y-1 text-sm">
                {links.map((l) => (
                  <li key={l.href}>
                    <Link href={l.href} className="block rounded-lg px-3 py-2 hover:bg-surface-hover">
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
