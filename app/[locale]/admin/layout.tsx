'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { PetBossLogo } from '@/components/shared/pet-boss-logo';

const sidebarSections = [
  {
    items: [
      { key: 'dashboard', href: '/admin', icon: '📊' },
      { key: 'theme', href: '/admin/theme', icon: '🎨' },
    ],
  },
  {
    label: 'مدیریت محتوا و خدمات',
    items: [
      { key: 'divisions', href: '/admin/divisions', icon: '🏥' },
      { key: 'services', href: '/admin/services', icon: '💊' },
      { key: 'staff', href: '/admin/staff', icon: '👨‍⚕️' },
      { key: 'faqs', href: '/admin/faqs', icon: '❓' },
    ],
  },
  {
    label: 'پت‌شاپ و کاتالوگ',
    items: [
      { key: 'products', href: '/admin/products', icon: '📦' },
    ],
  },
  {
    label: 'مشتریان و بازاریابی',
    items: [
      { key: 'leads', href: '/admin/leads', icon: '📋' },
      { key: 'contactMessages', href: '/admin/messages', icon: '✉️' },
    ],
  },
  {
    label: 'پیکربندی سیستم',
    items: [
      { key: 'siteSettings', href: '/admin/settings', icon: '⚙️' },
    ],
  },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const t = useTranslations('Admin');

  return (
    <div className="flex min-h-screen bg-background text-foreground">
      {/* Sidebar */}
      <aside className="hidden lg:flex flex-col w-64 bg-surface border-e border-border shrink-0">
        {/* Admin Logo */}
        <div className="p-5 border-b border-border">
          <Link href="/admin" className="flex items-center gap-2">
            <PetBossLogo size="sm" variant="gold" />
          </Link>
          <div className="mt-2 text-[10px] text-muted-foreground">
            سامانه مدیریت یکپارچه کلینیک
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-6">
          {sidebarSections.map((section, idx) => (
            <div key={idx}>
              {section.label && (
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold px-3 mb-2">
                  {section.label}
                </p>
              )}
              <ul className="space-y-1">
                {section.items.map((item) => {
                  const isActive =
                    pathname.endsWith(item.href) ||
                    (item.href !== '/admin' && pathname.includes(item.href));
                  return (
                    <li key={item.key}>
                      <Link
                        href={item.href}
                        className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                          isActive
                            ? 'bg-primary text-charcoal-950 font-bold shadow-gold'
                            : 'text-foreground/80 hover:bg-surface-elevated hover:text-primary'
                        }`}
                      >
                        <span className="text-base">{item.icon}</span>
                        <span>{t(item.key)}</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>

        {/* Back to Site */}
        <div className="p-4 border-t border-border">
          <Link
            href="/"
            className="flex items-center gap-2 text-xs text-muted-foreground hover:text-primary transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="rtl:rotate-180"><path d="m12 19-7-7 7-7"/><path d="M19 12H5"/></svg>
            مشاهده سایت اصلی
          </Link>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-h-screen">
        {/* Top Bar */}
        <header className="sticky top-0 z-30 bg-surface/90 backdrop-blur border-b border-border h-16 flex items-center justify-between px-6">
          <div className="flex items-center gap-3">
            <h1 className="text-sm font-bold text-foreground">{t('title')}</h1>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20 font-mono">
              v1.0.0
            </span>
          </div>
          <div className="flex items-center gap-4">
            <Link
              href="/admin/theme"
              className="text-xs px-3 py-1.5 rounded-full border border-border-gold text-foreground hover:bg-surface-elevated transition-colors flex items-center gap-1.5"
            >
              <span>🎨</span>
              <span>تغییر قالب</span>
            </Link>
            <Link
              href="/"
              className="text-xs text-primary hover:underline font-semibold"
            >
              مشاهده سایت ←
            </Link>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 p-6 md:p-8 bg-background">
          {children}
        </main>
      </div>
    </div>
  );
}
