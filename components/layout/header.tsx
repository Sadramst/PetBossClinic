'use client';

import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { Button } from '@/components/ui/button';

export function Header() {
  const t = useTranslations('Navigation');
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Determine current locale from pathname
  const isEnglish = pathname.startsWith('/en');
  const langSwitchHref = isEnglish ? pathname.replace(/^\/en/, '') || '/' : `/en${pathname}`;

  const navLinks = [
    { href: '/', label: t('home') },
    { href: '/services', label: t('services') },
    { href: '/about', label: t('about') },
    { href: '/blog', label: 'مقالات' },
    { href: '/shop', label: t('shop') },
    { href: '/faq', label: t('faq') },
    { href: '/contact', label: t('contact') },
  ];

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/80">
      <div className="container-site flex h-16 items-center justify-between">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2.5 group">
          <div className="bg-gradient-gold text-white p-2 rounded-lg shadow-gold transition-transform group-hover:scale-105">
            <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
            </svg>
          </div>
          <div className="flex flex-col">
            <span className="text-lg font-bold tracking-tight text-charcoal-800">پت‌باس</span>
            <span className="text-[10px] text-muted-foreground -mt-1">PET BOSS CLINIC</span>
          </div>
        </Link>

        {/* Desktop Navigation */}
        <nav className="hidden lg:flex items-center gap-1">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="px-3 py-2 text-sm font-medium rounded-md text-charcoal-600 hover:text-gold-600 hover:bg-gold-50 transition-colors"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        {/* Right side: Language + CTA */}
        <div className="flex items-center gap-3">
          {/* Language Switcher */}
          <Link
            href={langSwitchHref}
            className="text-xs font-medium px-2.5 py-1.5 rounded-md border border-border hover:bg-muted transition-colors"
          >
            {t('languageSwitcher')}
          </Link>

          {/* CTA - Call/Book */}
          <Button
            asChild
            className="hidden sm:inline-flex bg-gradient-gold hover:opacity-90 text-white rounded-full px-5 shadow-gold"
          >
            <a href="tel:+982122000000">
              {t('callNow')}
            </a>
          </Button>

          {/* Mobile menu button */}
          <button
            className="lg:hidden p-2 rounded-md hover:bg-muted"
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
        <nav className="lg:hidden border-t bg-white px-4 py-4 space-y-1">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="block px-3 py-2.5 text-sm font-medium rounded-md text-charcoal-700 hover:bg-gold-50 hover:text-gold-600 transition-colors"
              onClick={() => setMobileMenuOpen(false)}
            >
              {link.label}
            </Link>
          ))}
          <div className="pt-3 border-t mt-3">
            <Button asChild className="w-full bg-gradient-gold text-white rounded-full shadow-gold">
              <a href="tel:+982122000000">{t('callNow')}</a>
            </Button>
          </div>
        </nav>
      )}
    </header>
  );
}
