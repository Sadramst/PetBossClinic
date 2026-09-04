import { useTranslations, useLocale } from 'next-intl';
import { Link } from '@/i18n/routing';
import { PetBossLogo } from '@/components/shared/pet-boss-logo';

export function Footer() {
  const t = useTranslations('Footer');
  const nav = useTranslations('Navigation');
  const locale = useLocale();
  const isEnglish = locale === 'en';

  return (
    <footer className="bg-surface border-t border-border text-muted-foreground transition-colors duration-200">
      {/* Main Footer */}
      <div className="container-site py-16">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-10">
          {/* Brand Column */}
          <div className="lg:col-span-1">
            <Link href="/" className="inline-block mb-5">
              <PetBossLogo size="md" variant="gold" />
            </Link>
            <p className="text-sm leading-relaxed max-w-xs text-foreground/80">
              {t('description')}
            </p>
            <div className="flex items-center gap-3 mt-6">
              {/* Instagram */}
              <a
                href="https://instagram.com/petbossclinic"
                target="_blank"
                rel="noopener noreferrer"
                className="w-9 h-9 rounded-full bg-surface-card border border-border flex items-center justify-center text-foreground hover:text-primary hover:border-primary transition-colors"
                aria-label="Instagram"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="20" height="20" x="2" y="2" rx="5" ry="5"/><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/><line x1="17.5" x2="17.51" y1="6.5" y2="6.5"/></svg>
              </a>
              {/* WhatsApp */}
              <a
                href="https://wa.me/989120000000"
                target="_blank"
                rel="noopener noreferrer"
                className="w-9 h-9 rounded-full bg-surface-card border border-border flex items-center justify-center text-foreground hover:text-primary hover:border-primary transition-colors"
                aria-label="WhatsApp"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
              </a>
              {/* Telegram */}
              <a
                href="https://t.me/petbossclinic"
                target="_blank"
                rel="noopener noreferrer"
                className="w-9 h-9 rounded-full bg-surface-card border border-border flex items-center justify-center text-foreground hover:text-primary hover:border-primary transition-colors"
                aria-label="Telegram"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/></svg>
              </a>
            </div>
          </div>

          {/* Quick Links */}
          <div>
            <h4 className="text-primary font-bold mb-4 text-sm uppercase tracking-wider">{t('quickLinks')}</h4>
            <ul className="space-y-2.5 text-sm text-foreground/80">
              <li><Link href="/" className="hover:text-primary transition-colors">{nav('home')}</Link></li>
              <li><Link href="/services" className="hover:text-primary transition-colors">{nav('services')}</Link></li>
              <li><Link href="/about" className="hover:text-primary transition-colors">{nav('about')}</Link></li>
              <li><Link href="/faq" className="hover:text-primary transition-colors">{nav('faq')}</Link></li>
              <li><Link href="/contact" className="hover:text-primary transition-colors">{nav('contact')}</Link></li>
              <li><Link href="/admin" className="hover:text-primary transition-colors text-xs opacity-75">{nav('admin')}</Link></li>
            </ul>
          </div>

          {/* Contact Info */}
          <div>
            <h4 className="text-primary font-bold mb-4 text-sm uppercase tracking-wider">{t('contactInfo')}</h4>
            <ul className="space-y-3 text-sm text-foreground/80">
              <li className="flex items-start gap-2.5">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mt-0.5 shrink-0 text-primary"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>
                <span>{t('address')}</span>
              </li>
              <li className="flex items-center gap-2.5">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-primary"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
                <a href="tel:+982122000000" className="hover:text-primary transition-colors dir-ltr">
                  {isEnglish ? '+98 21 2200 0000' : '۰۲۱-۲۲۰۰۰۰۰۰'}
                </a>
              </li>
              <li className="flex items-center gap-2.5">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-primary"><rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>
                <a href="mailto:info@petbossclinic.com" className="hover:text-primary transition-colors">info@petbossclinic.com</a>
              </li>
            </ul>
          </div>

          {/* Working Hours */}
          <div>
            <h4 className="text-primary font-bold mb-4 text-sm uppercase tracking-wider">{t('workingHours')}</h4>
            <div className="p-4 rounded-xl bg-surface-card border border-border text-sm space-y-2.5">
              <div className="flex justify-between items-center text-foreground">
                <span className="font-medium">{t('everyday')}</span>
                <span className="text-primary font-bold">{t('hoursValue')}</span>
              </div>
              <p className="text-xs text-muted-foreground pt-2 border-t border-border/50">
                {t('emergencyNote')}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Bar */}
      <div className="border-t border-border/60 bg-surface/50">
        <div className="container-site py-5 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="text-xs text-muted-foreground">
            &copy; {new Date().getFullYear()} Pet Boss Clinic — {t('rights')}
          </p>
          <p className="text-xs text-muted-foreground">
            {t('designedBy')}{' '}
            <a
              href="https://www.appilico.com.au/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:text-primary-hover transition-colors font-semibold"
            >
              Appilico
            </a>
          </p>
        </div>
      </div>
    </footer>
  );
}
