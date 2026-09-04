import { getTranslations } from "next-intl/server";
import { Button } from "@/components/ui/button";
import { LuxuryPillBadge } from "@/components/ui/luxury-pill-badge";

export default async function ContactPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const isEn = locale === 'en';
  const t = await getTranslations('Contact');

  return (
    <div className="section-padding bg-background">
      <div className="container-site">
        {/* Page Header */}
        <div className="text-center mb-16">
          <LuxuryPillBadge variant="outline" className="mb-3">
            {t('badge')}
          </LuxuryPillBadge>
          <h1 className="text-4xl md:text-5xl font-extrabold text-foreground mb-4">{t('title')}</h1>
          <p className="text-muted-foreground max-w-2xl mx-auto text-lg leading-relaxed">{t('subtitle')}</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
          {/* Contact Form */}
          <div className="card-luxury p-8">
            <h2 className="text-xl font-bold text-foreground mb-6">{t('formTitle')}</h2>
            <form className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-foreground/90 mb-1.5">{t('name')}</label>
                <input
                  type="text"
                  placeholder={t('namePlaceholder')}
                  className="w-full px-4 py-3 rounded-xl border border-border bg-surface text-foreground text-sm focus:ring-2 focus:ring-primary focus:border-primary outline-none transition placeholder:text-muted-foreground"
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-foreground/90 mb-1.5">{t('phone')}</label>
                  <input
                    type="tel"
                    placeholder={t('phonePlaceholder')}
                    className="w-full px-4 py-3 rounded-xl border border-border bg-surface text-foreground text-sm focus:ring-2 focus:ring-primary focus:border-primary outline-none transition placeholder:text-muted-foreground"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground/90 mb-1.5">{t('email')}</label>
                  <input
                    type="email"
                    placeholder={t('emailPlaceholder')}
                    className="w-full px-4 py-3 rounded-xl border border-border bg-surface text-foreground text-sm focus:ring-2 focus:ring-primary focus:border-primary outline-none transition placeholder:text-muted-foreground"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground/90 mb-1.5">{t('subject')}</label>
                <input
                  type="text"
                  placeholder={t('subjectPlaceholder')}
                  className="w-full px-4 py-3 rounded-xl border border-border bg-surface text-foreground text-sm focus:ring-2 focus:ring-primary focus:border-primary outline-none transition placeholder:text-muted-foreground"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground/90 mb-1.5">{t('message')}</label>
                <textarea
                  rows={4}
                  placeholder={t('messagePlaceholder')}
                  className="w-full px-4 py-3 rounded-xl border border-border bg-surface text-foreground text-sm focus:ring-2 focus:ring-primary focus:border-primary outline-none transition resize-none placeholder:text-muted-foreground"
                />
              </div>
              <Button type="submit" className="w-full bg-gradient-gold hover:opacity-90 text-charcoal-950 font-bold rounded-full py-3.5 shadow-gold text-base">
                {t('send')}
              </Button>
            </form>
          </div>

          {/* Contact Info + Map */}
          <div className="space-y-6">
            {/* Info Cards */}
            <div className="card-luxury p-8 space-y-6">
              <div>
                <h3 className="text-xs font-bold text-primary uppercase tracking-wider mb-1.5">{t('addressTitle')}</h3>
                <p className="text-sm text-foreground/90 leading-relaxed">{t('addressText')}</p>
              </div>
              <div>
                <h3 className="text-xs font-bold text-primary uppercase tracking-wider mb-1.5">{t('phoneTitle')}</h3>
                <a href="tel:+982122000000" className="text-base font-bold text-primary hover:underline dir-ltr inline-block">
                  {isEn ? '+98 21 2200 0000' : '۰۲۱-۲۲۰۰۰۰۰۰'}
                </a>
              </div>
              <div>
                <h3 className="text-xs font-bold text-primary uppercase tracking-wider mb-1.5">{t('emailTitle')}</h3>
                <a href="mailto:info@petbossclinic.com" className="text-sm text-foreground/90 hover:text-primary transition-colors">
                  info@petbossclinic.com
                </a>
              </div>
              <div>
                <h3 className="text-xs font-bold text-primary uppercase tracking-wider mb-1.5">{t('hoursTitle')}</h3>
                <p className="text-sm text-foreground/90 font-medium">{t('hoursText')}</p>
              </div>
            </div>

            {/* Map */}
            <div className="rounded-2xl overflow-hidden shadow-gold border border-border-gold aspect-video bg-surface-card">
              <iframe
                title="Pet Boss Clinic Location"
                width="100%"
                height="100%"
                frameBorder="0"
                scrolling="no"
                marginHeight={0}
                marginWidth={0}
                src={`https://maps.google.com/maps?q=35.790937,51.4350853&hl=${isEn ? 'en' : 'fa'}&z=16&output=embed`}
                className="w-full h-full grayscale contrast-125 opacity-90 hover:grayscale-0 transition-all duration-300"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
