'use client';

import { useTranslations, useLocale } from 'next-intl';
import { Link, usePathname } from '@/i18n/routing';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { PetBossLogo } from '@/components/shared/pet-boss-logo';
import type { NavItem } from '@/lib/navigation/menu';

export function Header({
  logoUrl,
  navItems,
  phone = '',
}: {
  logoUrl?: string;
  navItems?: NavItem[];
  phone?: string;
}) {
  const t = useTranslations('Navigation');
  const locale = useLocale();
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const isEnglish = locale === 'en';

  const navLinks = navItems && navItems.length > 0
    ? navItems.map((item) => ({
        href: item.url,
        label: isEnglish ? (item.labelEn || item.labelFa) : item.labelFa,
      }))
    : [
        { href: '/', label: t('home') },
        { href: '/services', label: t('services') },
        { href: '/shop', label: t('shop') },
        { href: '/about', label: t('about') },
        { href: '/faq', label: t('faq') },
        { href: '/contact', label: t('contact') },
      ];

  const telLink = phone ? `tel:${phone.replace(/\s+/g, '')}` : '#';

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/60 bg-surface/95 backdrop-blur supports-[backdrop-filter]:bg-surface/80 transition-colors duration-200">
      <div className="container-site flex h-20 items-center justify-between">
        {/* Crowned Lion Brand Logo */}
        <Link href="/" className="flex items-center gap-2 group">
          <PetBossLogo size="md" variant="gold" logoUrl={logoUrl} />
        </Link>

        {/* Desktop Navigation */}
        <nav className="hidden lg:flex items-center gap-1">
          {navLinks.map((link) => {
            const isActive =
              link.href === '/'
                ? pathname === '/'
                : pathname.startsWith(link.href);

            if (link.href === '/shop') {
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`mx-1.5 px-4 py-2 text-sm font-bold rounded-full transition-all flex items-center gap-2 border shadow-gold ${
                    isActive
                      ? 'bg-gradient-gold text-charcoal-950 border-gold-300'
                      : 'bg-primary/10 text-primary border-primary/40 hover:bg-gradient-gold hover:text-charcoal-950 hover:border-gold-300'
                  }`}
                >
                  <span className="text-base">🛍️</span>
                  <span>{link.label}</span>
                  <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full bg-primary/20 text-primary group-hover:bg-charcoal-950 group-hover:text-gold-300 font-extrabold">
                    {isEnglish ? 'Boutique' : 'ویژه'}
                  </span>
                </Link>
              );
            }

            return (
              <Link
                key={link.href}
                href={link.href}
                className={`px-3.5 py-2 text-sm font-medium rounded-lg transition-all ${
                  isActive
                    ? 'text-primary bg-primary/10 font-semibold'
                    : 'text-foreground/80 hover:text-primary hover:bg-surface-hover'
                }`}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>

        {/* Right side: Language + Emergency CTA */}
        <div className="flex items-center gap-3">
          {/* Language Switcher */}
          <Link
            href={pathname}
            locale={isEnglish ? 'fa' : 'en'}
            className="text-xs font-semibold px-3 py-1.5 rounded-full border border-border-gold bg-surface-card/60 text-foreground hover:border-primary hover:text-primary transition-all"
            title="Switch Language"
          >
            {isEnglish ? 'فارسی' : 'English'}
          </Link>

          {/* Luxury CTA Button */}
          <Button
            asChild
            className="hidden sm:inline-flex bg-gradient-gold hover:opacity-90 text-charcoal-950 font-bold rounded-full px-6 shadow-gold border border-gold-300/30 text-sm"
          >
            <a href={telLink} className="flex items-center gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
              <span>{t('callNow')}</span>
            </a>
          </Button>

          {/* Mobile Menu Button */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="lg:hidden p-2 rounded-lg text-foreground hover:text-primary hover:bg-surface-hover transition-colors"
            aria-label="Toggle Menu"
          >
            {mobileMenuOpen ? (
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="4" x2="20" y1="12" y2="12"/><line x1="4" x2="20" y1="6" y2="6"/><line x1="4" x2="20" y1="18" y2="18"/></svg>
            )}
          </button>
        </div>
      </div>

      {/* Mobile Navigation Dropdown */}
      {mobileMenuOpen && (
        <div className="lg:hidden border-t border-border bg-surface/98 backdrop-blur px-4 py-6 space-y-3 transition-colors duration-200">
          <nav className="flex flex-col space-y-1">
            {navLinks.map((link) => {
              const isActive =
                link.href === '/'
                  ? pathname === '/'
                  : pathname.startsWith(link.href);

              return (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`px-4 py-3 rounded-lg text-sm font-medium transition-colors ${
                    isActive
                      ? 'text-primary bg-primary/10 font-bold'
                      : 'text-foreground hover:text-primary hover:bg-surface-hover'
                  }`}
                >
                  {link.label}
                </Link>
              );
            })}
          </nav>

          <div className="pt-4 border-t border-border flex flex-col gap-3">
            <Button asChild className="w-full bg-gradient-gold text-charcoal-950 font-bold rounded-xl shadow-gold">
              <a href={telLink} className="flex items-center justify-center gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
                <span>{t('callNow')}</span>
              </a>
            </Button>
          </div>
        </div>
      )}
    </header>
  );
}
