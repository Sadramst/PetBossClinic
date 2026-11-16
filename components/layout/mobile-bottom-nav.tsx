'use client';

import { Link, usePathname } from '@/i18n/routing';

/** App-style bottom navigation on phones (the main way Iranian shoppers browse). */
export function MobileBottomNav({ phone, whatsappNumber }: { phone?: string; whatsappNumber?: string | null }) {
  const pathname = usePathname();
  if (pathname.startsWith('/admin')) return null;

  const telLink = phone ? `tel:${phone.replace(/\s+/g, '')}` : '/contact';
  const wa = whatsappNumber ? `https://wa.me/${whatsappNumber.replace(/\D/g, '')}` : null;
  const item = 'flex-1 flex flex-col items-center justify-center gap-0.5 text-[11px]';
  const active = (p: string) => (p === '/' ? pathname === '/' : pathname.startsWith(p)) ? 'text-primary font-bold' : 'text-muted-foreground';

  const focusSearch = (e: React.MouseEvent) => {
    const input = document.getElementById('site-search-mobile') as HTMLInputElement | null;
    if (input) {
      e.preventDefault();
      window.scrollTo({ top: 0, behavior: 'smooth' });
      input.focus();
    }
  };

  return (
    <nav
      aria-label="ناوبری پایین"
      className="lg:hidden fixed bottom-0 inset-x-0 z-50 h-16 border-t border-border bg-surface/95 backdrop-blur flex pb-[env(safe-area-inset-bottom)]"
    >
      <Link href="/" className={`${item} ${active('/')}`}>
        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden><path d="M3 10.5 12 3l9 7.5V21h-6v-6H9v6H3z" strokeLinejoin="round" /></svg>
        خانه
      </Link>
      <Link href="/shop" className={`${item} ${active('/shop')}`}>
        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z M3 6h18 M16 10a4 4 0 0 1-8 0" strokeLinejoin="round" /></svg>
        پت‌شاپ
      </Link>
      <Link href="/shop" onClick={focusSearch} className={`${item} text-muted-foreground`}>
        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" strokeLinecap="round" /></svg>
        جستجو
      </Link>
      {wa && (
        <a href={wa} target="_blank" rel="noopener" className={`${item} text-muted-foreground`}>
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor" aria-hidden><path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2Zm5.3 14.1c-.2.6-1.3 1.2-1.8 1.3-.5 0-1 .2-3.3-.7a11.6 11.6 0 0 1-4.6-4.1c-.5-.7-1-1.8-1-2.9 0-1.1.6-1.6.8-1.9.2-.2.5-.3.7-.3h.5c.2 0 .4 0 .6.5l.8 2c.1.2.1.4 0 .5l-.4.6-.4.4c-.1.2-.3.3-.1.6.2.3.8 1.3 1.7 2.1 1.2 1 2.1 1.3 2.4 1.5.3.1.5.1.6-.1l.9-1c.2-.3.4-.2.6-.1l2 .9c.3.1.5.2.5.4.1.1.1.7-.1 1.3Z" /></svg>
          واتس‌اپ
        </a>
      )}
      <a href={telLink} className={`${item} text-muted-foreground`}>
        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.8 19.8 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.18 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.72c.12.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.1 9.9a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.9.34 1.85.58 2.81.7A2 2 0 0 1 22 16.92z" /></svg>
        تماس
      </a>
    </nav>
  );
}
