'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';

const sidebarSections = [
  {
    items: [
      { key: 'dashboard', href: '/admin', icon: '📊' },
    ],
  },
  {
    label: 'content',
    items: [
      { key: 'divisions', href: '/admin/divisions', icon: '🏥' },
      { key: 'services', href: '/admin/services', icon: '💊' },
      { key: 'staff', href: '/admin/staff', icon: '👨‍⚕️' },
      { key: 'blogPosts', href: '/admin/posts', icon: '📝' },
      { key: 'faqs', href: '/admin/faqs', icon: '❓' },
      { key: 'testimonials', href: '/admin/testimonials', icon: '💬' },
      { key: 'gallery', href: '/admin/gallery', icon: '🖼️' },
      { key: 'banners', href: '/admin/banners', icon: '🎨' },
    ],
  },
  {
    label: 'shop',
    items: [
      { key: 'products', href: '/admin/products', icon: '📦' },
      { key: 'productCategories', href: '/admin/product-categories', icon: '📂' },
      { key: 'brands', href: '/admin/brands', icon: '🏷️' },
    ],
  },
  {
    label: 'marketing',
    items: [
      { key: 'leads', href: '/admin/leads', icon: '📋' },
      { key: 'contactMessages', href: '/admin/messages', icon: '✉️' },
      { key: 'newsletter', href: '/admin/newsletter', icon: '📬' },
      { key: 'landingPages', href: '/admin/landing-pages', icon: '🚀' },
    ],
  },
  {
    label: 'settings',
    items: [
      { key: 'siteSettings', href: '/admin/settings', icon: '⚙️' },
      { key: 'socialLinks', href: '/admin/social-links', icon: '🔗' },
      { key: 'menus', href: '/admin/menus', icon: '📋' },
      { key: 'seoManager', href: '/admin/seo', icon: '🔍' },
      { key: 'media', href: '/admin/media', icon: '📁' },
      { key: 'theme', href: '/admin/theme', icon: '🎨' },
      { key: 'users', href: '/admin/users', icon: '👥' },
      { key: 'auditLog', href: '/admin/audit-log', icon: '📜' },
    ],
  },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const t = useTranslations('Admin');

  return (
    <div className="flex min-h-screen bg-surface">
      {/* Sidebar */}
      <aside className="hidden lg:flex flex-col w-64 bg-charcoal-800 text-charcoal-200 border-e border-charcoal-700 shrink-0">
        {/* Admin Logo */}
        <div className="p-5 border-b border-charcoal-700">
          <Link href="/admin" className="flex items-center gap-2.5">
            <div className="bg-gradient-gold text-white p-1.5 rounded-lg">
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" /></svg>
            </div>
            <div>
              <span className="text-white font-bold text-sm">پنل مدیریت</span>
              <span className="block text-[10px] text-charcoal-400">Pet Boss Admin</span>
            </div>
          </Link>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-6">
          {sidebarSections.map((section, idx) => (
            <div key={idx}>
              {section.label && (
                <p className="text-[10px] uppercase tracking-wider text-charcoal-500 font-semibold px-3 mb-2">
                  {section.label}
                </p>
              )}
              <ul className="space-y-0.5">
                {section.items.map((item) => {
                  const isActive = pathname.endsWith(item.href) || (item.href !== '/admin' && pathname.includes(item.href));
                  return (
                    <li key={item.key}>
                      <Link
                        href={item.href}
                        className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                          isActive
                            ? 'bg-gold-500/20 text-gold-300 font-medium'
                            : 'text-charcoal-300 hover:bg-charcoal-700 hover:text-white'
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
        <div className="p-4 border-t border-charcoal-700">
          <Link href="/" className="flex items-center gap-2 text-sm text-charcoal-400 hover:text-gold-400 transition-colors">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m12 19-7-7 7-7"/><path d="M19 12H5"/></svg>
            بازگشت به سایت
          </Link>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-h-screen">
        {/* Top Bar */}
        <header className="sticky top-0 z-30 bg-white/95 backdrop-blur border-b border-border h-14 flex items-center px-6">
          <h1 className="text-sm font-semibold text-charcoal-800">{t('title')}</h1>
          <div className="ms-auto flex items-center gap-3">
            <Link href="/" className="text-xs text-muted-foreground hover:text-gold-600 transition-colors">
              مشاهده سایت ←
            </Link>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
