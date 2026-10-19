'use client'

import { useLocale } from 'next-intl'
import { usePathname } from '@/i18n/routing'
import { SocialIcon } from '@/components/shared/social-icon'

export function FloatingWhatsAppButton({
  whatsappNumber = '+989915334091',
}: {
  whatsappNumber?: string | null
}) {
  const pathname = usePathname()
  const locale = useLocale()
  const isEn = locale === 'en'

  // Do not show floating button inside admin panel
  if (pathname.startsWith('/admin')) {
    return null
  }

  const cleanNumber = (whatsappNumber || '+989915334091').replace(/\D/g, '')
  const message = isEn
    ? 'Hello Pet Boss Clinic, I would like to inquire about your services and pet shop products.'
    : 'سلام و احترام، جهت دریافت مشاوره و اطلاعات خدمات و محصولات پت‌باس پیام می‌دهم.'
  const whatsappUrl = `https://wa.me/${cleanNumber}?text=${encodeURIComponent(message)}`

  return (
    <aside aria-label={isEn ? 'WhatsApp Contact' : 'ارتباط واتساپ'} className="fixed bottom-20 sm:bottom-6 end-4 sm:end-6 z-40 animate-fade-in group">
      <a
        href={whatsappUrl}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={isEn ? 'Chat with Pet Boss on WhatsApp' : 'گفتگو و مشاوره در واتساپ پت‌باس'}
        className="relative flex items-center gap-2.5 px-3.5 py-2.5 sm:px-4 sm:py-3 rounded-full bg-surface-card/95 backdrop-blur-md border border-emerald-500/40 text-foreground shadow-lg hover:border-emerald-400 hover:scale-105 active:scale-95 transition-all duration-300"
      >
        {/* Glowing Emerald Aura */}
        <span className="absolute -inset-0.5 rounded-full bg-gradient-to-r from-emerald-500/30 to-teal-500/30 blur-sm group-hover:opacity-100 opacity-60 transition-opacity" />

        <div className="relative flex items-center gap-2">
          {/* WhatsApp Icon with Emerald Circle */}
          <span className="w-8 h-8 rounded-full bg-[#25D366] text-white flex items-center justify-center text-sm shadow-md shrink-0">
            <SocialIcon platform="WHATSAPP" size={18} />
          </span>

          <div className="flex flex-col text-start leading-none pe-1">
            <span className="text-[10px] text-emerald-400 font-bold uppercase tracking-wider mb-0.5">
              {isEn ? 'Online Support' : 'مشاوره آنلاین'}
            </span>
            <span className="text-xs font-black text-foreground group-hover:text-emerald-400 transition-colors">
              {isEn ? 'WhatsApp Chat' : 'واتساپ پت‌باس'}
            </span>
          </div>

          <span className="w-2 h-2 rounded-full bg-[#25D366] animate-ping" />
        </div>
      </a>
    </aside>
  )
}
