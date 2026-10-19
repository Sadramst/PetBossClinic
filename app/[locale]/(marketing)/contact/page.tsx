import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from "next-intl/server";
import { LuxuryPillBadge } from "@/components/ui/luxury-pill-badge";
import { LeadForm } from "@/components/forms/lead-form";
import { getClinicNAP } from "@/lib/clinic/nap";
import { BreadcrumbJsonLd, VeterinaryCareJsonLd } from "@/lib/seo/json-ld";

export const revalidate = 60;

export function generateStaticParams() {
  return [{ locale: 'fa' }, { locale: 'en' }];
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  setRequestLocale(locale);
  const isEn = locale === 'en';
  const nap = await getClinicNAP();

  const title = isEn
    ? 'Contact Pet Boss Clinic | Address & Phone Gheitariyeh Tehran'
    : 'تماس با کلینیک دامپزشکی پت باس | آدرس و شماره تلفن قیطریه تهران';

  const description = isEn
    ? `Contact Pet Boss Veterinary Clinic in ${nap.addressEn}. Call ${nap.phoneDisplayEn} or book online. Open daily ${nap.workingHoursSummaryEn}.`
    : `تماس با کلینیک دامپزشکی پت باس در ${nap.addressFa}. شماره تلفن ${nap.phoneDisplayFa}. رزرو آنلاین نوبت، مشاوره و آدرس روی نقشه. ${nap.workingHoursSummaryFa}.`;

  return {
    title,
    description,
    keywords: isEn
      ? ['contact Pet Boss Clinic', 'veterinary phone Tehran', 'vet clinic address Gheitariyeh', 'Pet Boss appointment']
      : ['تماس با دامپزشکی پت باس', 'شماره تلفن دامپزشکی قیطریه', 'آدرس کلینیک پت باس شریعتی', 'رزرو نوبت دامپزشکی تهران'],
    alternates: {
      canonical: isEn ? 'https://www.petbossclinic.com/en/contact' : 'https://www.petbossclinic.com/contact',
      languages: {
        'fa-IR': 'https://www.petbossclinic.com/contact',
        en: 'https://www.petbossclinic.com/en/contact',
      },
    },
    openGraph: {
      title,
      description,
      url: isEn ? 'https://www.petbossclinic.com/en/contact' : 'https://www.petbossclinic.com/contact',
      images: [{ url: '/images/petboss-sign.jpg', width: 1200, height: 630 }],
    },
  };
}

export default async function ContactPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const isEn = locale === 'en';
  const [t, nap] = await Promise.all([
    getTranslations('Contact'),
    getClinicNAP(),
  ]);

  return (
    <>
      <VeterinaryCareJsonLd nap={nap} locale={locale} />
      <BreadcrumbJsonLd
        items={[
          { name: isEn ? 'Home' : 'خانه', href: '/' },
          { name: isEn ? 'Contact' : 'تماس با ما', href: '/contact' },
        ]}
        locale={locale}
      />
      <div className="bg-background">
      {/* Dynamic Theme Top Page Header */}
      <section className="relative bg-gradient-hero text-foreground overflow-hidden border-b border-border/60 py-16 md:py-20 mb-12">
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div className="absolute top-1/2 start-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-[radial-gradient(circle_at_center,rgba(197,160,89,0.12)_0%,transparent_70%)] rounded-full pointer-events-none" />
        </div>
        <div className="container-site relative z-10 text-center">
          <LuxuryPillBadge variant="outline" className="mb-3">
            {t('badge')}
          </LuxuryPillBadge>
          <h1 className="text-4xl md:text-5xl font-extrabold text-foreground mb-4">{t('title')}</h1>
          <p className="text-muted-foreground max-w-2xl mx-auto text-lg leading-relaxed">{t('subtitle')}</p>
        </div>
      </section>

      <div className="container-site pb-20">

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
          {/* Real Zod-validated Lead Capture Form */}
          <div>
            <LeadForm variant="inline" title={t('formTitle')} />
          </div>

          {/* Contact Info + Map */}
          <div className="space-y-6">
            {/* Info Cards */}
            <div className="card-luxury p-8 space-y-6">
              <div>
                <h3 className="text-xs font-bold text-primary uppercase tracking-wider mb-1.5">{t('addressTitle')}</h3>
                <p className="text-sm text-foreground/90 leading-relaxed">{isEn ? nap.addressEn : nap.addressFa}</p>
              </div>
              <div>
                <h3 className="text-xs font-bold text-primary uppercase tracking-wider mb-1.5">{t('phoneTitle')}</h3>
                <a href={nap.telLink} className="text-base font-bold text-primary hover:underline dir-ltr inline-block">
                  {isEn ? nap.phoneDisplayEn : nap.phoneDisplayFa}
                </a>
              </div>
              <div>
                <h3 className="text-xs font-bold text-primary uppercase tracking-wider mb-1.5">{t('emailTitle')}</h3>
                <a href={`mailto:${nap.email}`} className="text-sm text-foreground/90 hover:text-primary transition-colors">
                  {nap.email}
                </a>
              </div>
              {nap.whatsappLink && (
                <div>
                  <h3 className="text-xs font-bold text-emerald-400 uppercase tracking-wider mb-1.5">
                    {isEn ? 'WhatsApp Support & Orders' : 'واتساپ پشتیبانی و سفارشات'}
                  </h3>
                  <a
                    href={nap.whatsappLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-base font-bold text-emerald-400 hover:underline dir-ltr inline-flex items-center gap-2"
                  >
                    <span>+98 991 533 4091</span>
                    <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 font-medium">
                      {isEn ? 'Chat on WhatsApp' : 'ارتباط در واتساپ'}
                    </span>
                  </a>
                </div>
              )}
              <div>
                <h3 className="text-xs font-bold text-primary uppercase tracking-wider mb-1.5">{t('hoursTitle')}</h3>
                <p className="text-sm text-foreground/90 font-medium">{isEn ? nap.workingHoursSummaryEn : nap.workingHoursSummaryFa}</p>
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
                loading="lazy"
                src={`https://maps.google.com/maps?q=${nap.geo.lat},${nap.geo.lng}&hl=${isEn ? 'en' : 'fa'}&z=16&output=embed`}
                className="w-full h-full grayscale contrast-125 opacity-90 hover:grayscale-0 transition-all duration-300"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
    </>
  );
}
