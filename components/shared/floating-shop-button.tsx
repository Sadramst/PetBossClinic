'use client'

import { useLocale } from 'next-intl'
import { Link, usePathname } from '@/i18n/routing'

export function FloatingShopButton() {
  const pathname = usePathname()
  const locale = useLocale()
  const isEn = locale === 'en'

  // Do not show floating button if already on the shop page or inside admin panel
  if (pathname.startsWith('/shop') || pathname.startsWith('/admin')) {
    return null
  }

  return (
    <div className="fixed bottom-20 sm:bottom-6 start-4 sm:start-6 z-40 animate-fade-in">
      <Link
        href="/shop"
        className="group relative flex items-center gap-2.5 px-4 py-2.5 sm:px-5 sm:py-3 rounded-full bg-surface-card/95 backdrop-blur-md border border-primary/50 text-foreground shadow-gold-lg hover:border-primary hover:scale-105 active:scale-95 transition-all duration-300"
      >
        {/* Glowing aura */}
        <span className="absolute -inset-0.5 rounded-full bg-gradient-to-r from-primary/30 to-amber-500/30 blur-sm group-hover:opacity-100 opacity-60 transition-opacity" />

        <div className="relative flex items-center gap-2">
          <span className="w-8 h-8 rounded-full bg-gradient-gold text-charcoal-950 flex items-center justify-center text-sm shadow-gold shrink-0">
            🛍️
          </span>
          <div className="flex flex-col text-start leading-none">
            <span className="text-[10px] text-primary font-bold uppercase tracking-wider mb-0.5">
              {isEn ? 'Exclusive Boutique' : 'بوتیک و پت‌شاپ'}
            </span>
            <span className="text-xs font-black text-foreground group-hover:text-primary transition-colors">
              {isEn ? 'Pet Boss Shop' : 'ویترین محصولات پت باس'}
            </span>
          </div>
          <span className="ms-1 w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
        </div>
      </Link>
    </div>
  )
}
