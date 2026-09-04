import { useTranslations } from 'next-intl';
import Link from 'next/link';

export function Footer() {
  const t = useTranslations('Footer');
  const nav = useTranslations('Navigation');

  return (
    <footer className="bg-charcoal-800 text-charcoal-200">
      {/* Main Footer */}
      <div className="container-site py-16">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-10">
          {/* Brand Column */}
          <div className="lg:col-span-1">
            <div className="flex items-center gap-2.5 mb-4">
              <div className="bg-gradient-gold text-white p-2 rounded-lg">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                </svg>
              </div>
              <div>
                <div className="text-white font-bold text-lg">پت‌باس</div>
                <div className="text-[10px] text-charcoal-400 -mt-0.5">PET BOSS CLINIC</div>
              </div>
            </div>
            <p className="text-sm text-charcoal-300 leading-relaxed max-w-xs">
              {t('description')}
            </p>
          </div>

          {/* Quick Links */}
          <div>
            <h4 className="text-gold-400 font-semibold mb-4 text-sm uppercase tracking-wider">{t('quickLinks')}</h4>
            <ul className="space-y-2.5 text-sm text-charcoal-300">
              <li><Link href="/" className="hover:text-gold-400 transition-colors">{nav('home')}</Link></li>
              <li><Link href="/services" className="hover:text-gold-400 transition-colors">{nav('services')}</Link></li>
              <li><Link href="/about" className="hover:text-gold-400 transition-colors">{nav('about')}</Link></li>
              <li><Link href="/blog" className="hover:text-gold-400 transition-colors">مقالات</Link></li>
              <li><Link href="/shop" className="hover:text-gold-400 transition-colors">{nav('shop')}</Link></li>
              <li><Link href="/faq" className="hover:text-gold-400 transition-colors">{nav('faq')}</Link></li>
              <li><Link href="/contact" className="hover:text-gold-400 transition-colors">{nav('contact')}</Link></li>
            </ul>
          </div>

          {/* Contact Info */}
          <div>
            <h4 className="text-gold-400 font-semibold mb-4 text-sm uppercase tracking-wider">{t('contactInfo')}</h4>
            <ul className="space-y-3 text-sm text-charcoal-300">
              <li className="flex items-start gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mt-0.5 shrink-0 text-gold-500"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>
                <span>{t('address')}</span>
              </li>
              <li className="flex items-center gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-gold-500"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
                <a href="tel:+982122000000" className="hover:text-gold-400 transition-colors">۰۲۱-۲۲XXXXXX</a>
              </li>
              <li className="flex items-center gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-gold-500"><rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>
                <a href="mailto:info@petbossclinic.com" className="hover:text-gold-400 transition-colors">info@petbossclinic.com</a>
              </li>
            </ul>
          </div>

          {/* Working Hours */}
          <div>
            <h4 className="text-gold-400 font-semibold mb-4 text-sm uppercase tracking-wider">{t('workingHours')}</h4>
            <ul className="space-y-2.5 text-sm text-charcoal-300">
              <li className="flex justify-between">
                <span>{t('satToThu')}</span>
                <span className="text-charcoal-100">۹ - ۲۱</span>
              </li>
              <li className="flex justify-between">
                <span>{t('friday')}</span>
                <span className="text-charcoal-100">۱۰ - ۱۴</span>
              </li>
            </ul>
          </div>
        </div>
      </div>

      {/* Bottom Bar */}
      <div className="border-t border-charcoal-700">
        <div className="container-site py-5 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="text-xs text-charcoal-400">
            &copy; {new Date().getFullYear()} Pet Boss Clinic — {t('rights')}
          </p>
          <p className="text-xs text-charcoal-400">
            {t('designedBy')}{' '}
            <a
              href="https://www.appilico.com.au/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-gold-400 hover:text-gold-300 transition-colors font-medium"
            >
              Appilico
            </a>
          </p>
        </div>
      </div>
    </footer>
  );
}
