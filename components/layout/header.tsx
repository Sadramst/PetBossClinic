'use client';

import { useTranslations, useLocale } from 'next-intl';
import { Link, usePathname } from '@/i18n/routing';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { PetBossLogo } from '@/components/shared/pet-boss-logo';

export function Header() {
  const t = useTranslations('Navigation');
  const locale = useLocale();
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const isEnglish = locale === 'en';

  const navLinks = [
    { href: '/', label: t('home') },
    { href: '/services', label: t('services') },
    { href: '/about', label: t('about') },
    { href: '/faq', label: t('faq') },
    { href: '/contact', label: t('contact') },
    { href: '/admin', label: t('admin') },
  ];

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/60 bg-surface/95 backdrop-blur supports-[backdrop-filter]:bg-surface/80 transition-colors duration-200">
      <div className="container-site flex h-20 items-center justify-between">
        {/* Crowned Lion Brand Logo */}
        <Link href="/" className="flex items-center gap-2 group">
          <PetBossLogo size="md" variant="gold" />
        </Link>

        {/* Desktop Navigation */}
        <nav className="hidden lg:flex items-center gap-1">
          {navLinks.map((link) => {
            const isActive =
              link.href === '/'
                ? pathname === '/'
                : pathname.startsWith(link.href);

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
            <a href="tel:+982122000000" className="flex items-center gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
              <span>{t('callNow')}</span>
            </a>
          </Button>

          {/* Mobile menu button */}
          <button
            className="lg:hidden p-2 rounded-lg text-foreground hover:bg-surface-hover transition-colors"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label="Toggle menu"
          >
            {mobileMenuOpen ? (
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="18" x2="21" y2="18" /></svg>
            )}
          </button>
        </div>
      </div>

      {/* Mobile Navigation Dropdown */}
      {mobileMenuOpen && (
        <nav className="lg:hidden border-t border-border bg-surface px-4 py-4 space-y-1.5 shadow-xl">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="block px-3.5 py-2.5 text-sm font-medium rounded-lg text-foreground hover:bg-surface-hover hover:text-primary transition-colors"
              onClick={() => setMobileMenuOpen(false)}
            >
              {link.label}
            </Link>
          ))}
          <div className="pt-3 border-t border-border mt-3 flex flex-col gap-2">
            <Button asChild className="w-full bg-gradient-gold text-charcoal-950 font-bold rounded-full shadow-gold">
              <a href="tel:+982122000000">{t('callNow')}</a>
            </Button>
          </div>
        </nav>
      )}
    </header>
  );
}
