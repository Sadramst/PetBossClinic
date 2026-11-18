'use client';

import { Suspense, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Link, usePathname } from '@/i18n/routing';
import { PetBossLogo } from '@/components/shared/pet-boss-logo';
import type { NavItem } from '@/lib/navigation/menu';
import { brandPath, categoryPath } from '@/lib/shop/urls';
import { CartIconLink } from '@/components/shop/add-to-cart';
import { Sheet } from '@/components/ui/sheet';
import { SiteSearch } from './site-search';

export { SiteSearch };

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

const PET_LINKS = [
  { pet: 'cat', href: '/shop?pet=cat', label: 'محصولات گربه' },
  { pet: 'dog', href: '/shop?pet=dog', label: 'محصولات سگ' },
];

const PHONE_PATH =
  'M22 16.92v3a2 2 0 0 1-2.18 2 19.8 19.8 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.18 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.72c.12.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.1 9.9a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.9.34 1.85.58 2.81.7A2 2 0 0 1 22 16.92z';
const WHATSAPP_PATH =
  'M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z';
const CART_PATH = 'M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z M3 6h18 M16 10a4 4 0 0 1-8 0';
const USER_PATH = 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z M4 21a8 8 0 0 1 16 0';

const TRUST_ITEMS = [
  { label: 'ضمانت اصالت کالا', path: 'M12 3 5 6v5c0 4.5 3 8 7 9.5 4-1.5 7-5 7-9.5V6l-7-3Z M9 12l2 2 4-4' },
  { label: 'تاریخ انقضای معتبر', path: 'M4 7a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7Z M4 10h16 M8 3v4 M16 3v4 M9 15l2 2 4-4' },
  { label: 'مشاوره رایگان دامپزشک', path: 'M12 20s-7-4.5-7-10a4 4 0 0 1 7-2.5A4 4 0 0 1 19 10c0 5.5-7 10-7 10Z M12 10v4 M10 12h4' },
  { label: 'ارسال سریع در تهران', path: 'M2 6h11v10H2z M13 9h4l4 4v3h-8z M7 19a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z M17 19a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z' },
];

/** Shared look of the desktop nav links; the current one gets a gold underline. */
const NAV_LINK =
  'relative inline-flex h-10 items-center px-3 transition-colors after:absolute after:inset-x-3 after:bottom-0 after:h-0.5 after:rounded-full';
const navLink = (active: boolean, extra = '') =>
  `${NAV_LINK} ${active ? 'font-bold text-primary after:bg-primary' : 'text-foreground/85 hover:text-primary'} ${extra}`;

const DRAWER_LINK =
  'flex min-h-11 items-center gap-2 rounded-xl px-3 text-sm transition-colors hover:bg-surface-hover active:bg-surface-hover aria-[current=page]:bg-primary/10 aria-[current=page]:font-bold aria-[current=page]:text-primary';
const DRAWER_TILE =
  'flex min-h-12 items-center justify-center gap-2 rounded-xl border border-border bg-surface-card text-sm font-bold transition-colors hover:border-primary active:bg-surface-hover';

function StrokeIcon({ d, className = 'h-5 w-5', width = 2 }: { d: string; className?: string; width?: number }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={width} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d={d} />
    </svg>
  );
}

/** «محصولات گربه / سگ»: which one is current depends on ?pet=. */
function PetLinks({ activePet }: { activePet: string | null }) {
  return (
    <>
      {PET_LINKS.map((l) => (
        <Link key={l.pet} href={l.href} className={navLink(activePet === l.pet)} aria-current={activePet === l.pet ? 'page' : undefined}>
          {l.label}
        </Link>
      ))}
    </>
  );
}

function ActivePetLinks() {
  const pathname = usePathname();
  const params = useSearchParams();
  return <PetLinks activePet={pathname === '/shop' ? params.get('pet') : null} />;
}

export function Header({
  logoUrl,
  navItems,
  phone = '',
  whatsappLink = null,
  categories = [],
  brands = [],
}: {
  logoUrl?: string;
  navItems?: NavItem[];
  phone?: string;
  whatsappLink?: string | null;
  categories?: HeaderCategory[];
  brands?: HeaderCategory[];
}) {
  const pathname = usePathname();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const megaRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setDrawerOpen(false);
    // The mega menu stays open while something inside it has focus: release it after a navigation.
    const focused = document.activeElement;
    if (focused instanceof HTMLElement && megaRef.current?.contains(focused)) focused.blur();
  }, [pathname]);

  if (pathname.startsWith('/admin')) return null;

  // Admin-managed menu; home and shop have dedicated slots in this layout.
  const links =
    navItems && navItems.length > 0
      ? navItems.filter((i) => i.url !== '/' && i.url !== '/shop').map((i) => ({ href: i.url, label: i.labelFa }))
      : DEFAULT_LINKS;
  const telLink = phone ? `tel:${phone.replace(/\s+/g, '')}` : '/contact';
  const isActive = (href: string) => (href === '/' ? pathname === '/' : pathname === href || pathname.startsWith(`${href}/`));
  const current = (href: string) => (isActive(href) ? ('page' as const) : undefined);
  const inShop = isActive('/shop') || isActive('/product') || isActive('/brand');
  const closeDrawer = () => setDrawerOpen(false);

  return (
    <>
      {/*
        Sticky with a negative top: the first row (logo row on phones, trust strip
        from md up) scrolls away and only the compact part stays pinned.
      */}
      <header className="iran-header sticky -top-14 z-50 w-full border-b border-border/60 bg-surface/95 backdrop-blur supports-[backdrop-filter]:bg-surface/85 md:-top-8 print:static">
        {/* Trust strip */}
        <div className="hidden h-8 border-b border-border/50 bg-background/60 text-xs text-muted-foreground md:block">
          <div className="container mx-auto flex h-full max-w-7xl items-center justify-between gap-4 px-4">
            <ul className="flex min-w-0 items-center gap-6 overflow-hidden whitespace-nowrap">
              {TRUST_ITEMS.map((t) => (
                <li key={t.label} className="flex items-center gap-1.5">
                  <StrokeIcon d={t.path} className="h-3.5 w-3.5 shrink-0 text-primary" />
                  {t.label}
                </li>
              ))}
            </ul>
            {phone && (
              <a href={telLink} className="flex shrink-0 items-center gap-1.5 hover:text-primary">
                <StrokeIcon d={PHONE_PATH} className="h-3.5 w-3.5 text-primary" />
                <span dir="ltr">{phone}</span>
              </a>
            )}
          </div>
        </div>

        {/* Main row */}
        <div className="container mx-auto flex h-14 min-w-0 max-w-7xl items-center gap-2 px-4 md:h-16 md:gap-4 lg:h-[3.75rem] lg:gap-6">
          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            className="-ms-2 flex h-11 w-11 shrink-0 items-center justify-center rounded-xl hover:bg-surface-hover lg:hidden"
            aria-label="باز کردن منو"
            aria-haspopup="dialog"
            aria-expanded={drawerOpen}
          >
            <StrokeIcon d="M4 6h16M4 12h16M4 18h16" className="h-6 w-6" />
          </button>

          <Link href="/" className="shrink-0" aria-label="پت‌باس - صفحه اصلی">
            <span className="block sm:hidden">
              <PetBossLogo size="sm" variant="gold" logoUrl={logoUrl} />
            </span>
            <span className="hidden sm:block">
              <PetBossLogo size="md" variant="gold" logoUrl={logoUrl} />
            </span>
          </Link>

          <SiteSearch id="site-search" className="hidden max-w-2xl flex-1 md:block" />

          <div className="ms-auto flex shrink-0 items-center gap-2">
            <Link
              href="/account"
              className="hidden h-[42px] items-center gap-2 rounded-xl border border-border px-2.5 text-sm transition-colors hover:border-primary hover:text-primary sm:inline-flex xl:px-3.5"
              aria-label="حساب کاربری"
              aria-current={current('/account')}
            >
              <StrokeIcon d={USER_PATH} />
              <span className="hidden xl:inline">حساب من</span>
            </Link>
            <CartIconLink />
            <a
              href={telLink}
              className="hidden h-[42px] items-center gap-2 rounded-xl bg-gradient-gold px-4 text-sm font-bold text-charcoal-950 shadow-gold transition-opacity hover:opacity-90 sm:inline-flex"
            >
              <StrokeIcon d={PHONE_PATH} className="h-4 w-4" width={2.5} />
              تماس و مشاوره
            </a>
          </div>
        </div>

        {/* Mobile search: the part of the header that stays pinned on phones */}
        <div className="px-4 pb-2 pt-1.5 md:hidden">
          <SiteSearch id="site-search-mobile" />
        </div>

        {/* Desktop nav */}
        <nav aria-label="منوی اصلی" className="hidden border-t border-border/50 lg:block">
          <div className="container mx-auto flex h-10 max-w-7xl items-center gap-1 px-4 text-sm">
            <div ref={megaRef} className="group relative">
              <Link
                href="/shop"
                className={navLink(inShop, 'gap-2 font-bold')}
                aria-haspopup={categories.length > 0 ? 'true' : undefined}
                aria-current={current('/shop')}
              >
                <StrokeIcon d="M4 6h16M4 12h16M4 18h10" className="h-4 w-4" />
                دسته‌بندی محصولات
                {categories.length > 0 && (
                  <StrokeIcon
                    d="m6 9 6 6 6-6"
                    className="h-3.5 w-3.5 transition-transform group-focus-within:rotate-180 group-hover:rotate-180"
                  />
                )}
              </Link>
              {categories.length > 0 && (
                // pt-2 is the hover bridge between the link and the panel; the close delay forgives diagonal moves.
                <div className="invisible absolute start-0 top-full z-10 w-[min(46rem,calc(100vw-2rem))] pt-2 opacity-0 transition-[opacity,visibility] delay-150 duration-150 group-focus-within:visible group-focus-within:opacity-100 group-focus-within:delay-0 group-hover:visible group-hover:opacity-100 group-hover:delay-0">
                  <div className="grid grid-cols-[1fr_13rem] gap-6 rounded-2xl border border-border bg-surface-card p-5 shadow-2xl">
                    <div>
                      <p className="mb-2 px-3 text-xs font-bold text-primary">دسته‌بندی‌ها</p>
                      <ul className="grid grid-cols-2 gap-x-2">
                        {categories.map((c) => (
                          <li key={c.id}>
                            <Link
                              href={categoryPath(c.slugFa)}
                              className="flex min-h-10 items-center gap-2 rounded-lg px-3 hover:bg-surface-hover hover:text-primary"
                            >
                              <span aria-hidden className="h-1.5 w-1.5 shrink-0 rounded-full bg-primary/60" />
                              {c.nameFa}
                            </Link>
                          </li>
                        ))}
                      </ul>
                      <Link
                        href="/shop"
                        className="mt-3 flex min-h-10 items-center justify-center rounded-xl border border-primary/40 px-3 font-bold text-primary hover:bg-primary/10"
                      >
                        مشاهده همه محصولات
                      </Link>
                    </div>
                    <div className="space-y-4 border-s border-border ps-5">
                      <div>
                        <p className="mb-2 text-xs font-bold text-primary">بر اساس حیوان</p>
                        <div className="grid grid-cols-2 gap-2">
                          <Link href="/shop?pet=cat" className="flex min-h-10 items-center justify-center rounded-xl border border-border hover:border-primary hover:text-primary">
                            گربه
                          </Link>
                          <Link href="/shop?pet=dog" className="flex min-h-10 items-center justify-center rounded-xl border border-border hover:border-primary hover:text-primary">
                            سگ
                          </Link>
                        </div>
                      </div>
                      {brands.length > 0 && (
                        <div>
                          <p className="mb-1 text-xs font-bold text-primary">برندهای محبوب</p>
                          <ul>
                            {brands.slice(0, 7).map((b) => (
                              <li key={b.id}>
                                <Link href={brandPath(b.slugFa)} className="block py-1.5 text-foreground/85 hover:text-primary">
                                  {b.nameFa}
                                </Link>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
            {/* useSearchParams needs a Suspense boundary on statically rendered pages */}
            <Suspense fallback={<PetLinks activePet={null} />}>
              <ActivePetLinks />
            </Suspense>
            <Link href="/blog" className={navLink(isActive('/blog'))} aria-current={current('/blog')}>
              مجله پت‌باس
            </Link>
            <span className="mx-2 h-5 w-px bg-border" aria-hidden />
            {links.map((l) => (
              <Link key={l.href} href={l.href} className={navLink(isActive(l.href))} aria-current={current(l.href)}>
                {l.label}
              </Link>
            ))}
          </div>
        </nav>
      </header>

      {/* Mobile drawer: a native <dialog> in the top layer, so the blurred header cannot clip it */}
      <Sheet
        open={drawerOpen}
        onClose={closeDrawer}
        side="start"
        title="منوی پت‌باس"
        footer={
          <div className="grid grid-cols-2 gap-2">
            <a href={telLink} className="btn btn-gold">
              <StrokeIcon d={PHONE_PATH} className="h-4 w-4" width={2.5} />
              تماس
            </a>
            {whatsappLink ? (
              <a href={whatsappLink} target="_blank" rel="noopener noreferrer" className="btn btn-outline">
                <StrokeIcon d={WHATSAPP_PATH} className="h-4 w-4" />
                واتس‌اپ
              </a>
            ) : (
              <Link href="/contact" onClick={closeDrawer} className="btn btn-outline">
                تماس با ما
              </Link>
            )}
          </div>
        }
      >
        <nav aria-label="منوی موبایل" className="space-y-5">
          <div className="grid grid-cols-2 gap-2">
            <Link href="/cart" onClick={closeDrawer} className={DRAWER_TILE}>
              <StrokeIcon d={CART_PATH} className="h-5 w-5 text-primary" />
              سبد خرید
            </Link>
            <Link href="/account" onClick={closeDrawer} className={DRAWER_TILE}>
              <StrokeIcon d={USER_PATH} className="h-5 w-5 text-primary" />
              حساب من
            </Link>
          </div>

          <div>
            <p className="mb-1.5 px-3 text-xs font-bold text-primary">پت‌شاپ</p>
            <ul>
              <li>
                <Link href="/shop" onClick={closeDrawer} className={`${DRAWER_LINK} font-bold`}>
                  همه محصولات
                </Link>
              </li>
              {PET_LINKS.map((l) => (
                <li key={l.pet}>
                  <Link href={l.href} onClick={closeDrawer} className={DRAWER_LINK}>
                    {l.label}
                  </Link>
                </li>
              ))}
              {categories.map((c) => (
                <li key={c.id}>
                  <Link href={categoryPath(c.slugFa)} onClick={closeDrawer} className={DRAWER_LINK}>
                    {c.nameFa}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <p className="mb-1.5 px-3 text-xs font-bold text-primary">کلینیک</p>
            <ul>
              <li>
                <Link href="/blog" onClick={closeDrawer} className={DRAWER_LINK} aria-current={current('/blog')}>
                  مجله پت‌باس
                </Link>
              </li>
              {links.map((l) => (
                <li key={l.href}>
                  <Link href={l.href} onClick={closeDrawer} className={DRAWER_LINK} aria-current={current(l.href)}>
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </nav>
      </Sheet>
    </>
  );
}
