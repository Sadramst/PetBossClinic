import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from '@/i18n/routing';
import { LeadForm } from "@/components/forms/lead-form";
import { PageHero } from '@/components/content/page-hero';
import { ChatIcon, ClockIcon, MailIcon, PhoneIcon, PinIcon } from '@/components/content/icons';
import { getClinicNAP } from "@/lib/clinic/nap";
import { JsonLdScript, VeterinaryCareJsonLd } from "@/lib/seo/json-ld";
import { pageMetadata } from "@/lib/seo/metadata";
import { absoluteUrl } from "@/lib/seo/site";
import { formatPhoneDisplay } from '@/lib/utils/phone';

export const revalidate = 60;

export function generateStaticParams() {
  return [{ locale: 'fa' }];
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  setRequestLocale(locale);
  const nap = await getClinicNAP();

  return pageMetadata({
    title: 'تماس با کلینیک پت‌باس | آدرس و تلفن قیطریه تهران',
    description: `تماس با کلینیک دامپزشکی پت‌باس؛ ${nap.addressFa}؛ تلفن ${nap.phoneDisplayFa}؛ ${nap.workingHoursSummaryFa}. رزرو نوبت، مشاوره و مسیریابی روی نقشه.`,
    path: '/contact',
    image: '/images/petboss-sign.jpg',
    keywords: ['تماس با دامپزشکی پت‌باس', 'شماره تلفن دامپزشکی قیطریه', 'آدرس کلینیک پت باس شریعتی', 'رزرو نوبت دامپزشکی تهران'],
  });
}

function InfoRow({ icon, label, children }: { icon: ReactNode; label: string; children: ReactNode }) {
  return (
    <div className="flex items-start gap-3">
      <span
        aria-hidden
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-primary/20 bg-primary/10 text-primary"
      >
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <h3 className="text-xs font-bold text-primary">{label}</h3>
        <div className="mt-0.5 text-sm leading-7 text-foreground/90">{children}</div>
      </div>
    </div>
  );
}

export default async function ContactPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const [t, nap] = await Promise.all([
    getTranslations('Contact'),
    getClinicNAP(),
  ]);

  const whatsappDisplay = nap.whatsappNumber ? formatPhoneDisplay(nap.whatsappNumber, 'fa') : null;
  const coords = `${nap.geo.lat},${nap.geo.lng}`;
  const routes = [
    { label: 'گوگل‌مپ', href: `https://maps.google.com/?q=${coords}` },
    { label: 'نشان', href: `https://neshan.org/maps/@${coords},16z` },
    { label: 'ویز', href: `https://waze.com/ul?ll=${coords}&navigate=yes` },
  ];

  return (
    <>
      <VeterinaryCareJsonLd nap={nap} locale={locale} />
      <JsonLdScript
        data={{
          '@context': 'https://schema.org',
          '@type': 'ContactPage',
          name: 'تماس با کلینیک دامپزشکی پت‌باس',
          url: absoluteUrl('/contact'),
          inLanguage: 'fa-IR',
          isPartOf: { '@id': absoluteUrl('/#website') },
          mainEntity: { '@id': absoluteUrl('/#veterinary') },
        }}
      />
      <div className="bg-background">
        <PageHero
          crumbs={[
            { name: 'خانه', href: '/' },
            { name: 'تماس با ما', href: '/contact' },
          ]}
          badge={t('badge')}
          title={t('title')}
          subtitle={t('subtitle')}
        >
          <a href={nap.telLink} className="btn btn-gold">
            <PhoneIcon className="h-4 w-4" />
            تماس با کلینیک
          </a>
          {nap.whatsappLink && (
            <a href={nap.whatsappLink} target="_blank" rel="noopener noreferrer" className="btn btn-outline">
              <ChatIcon className="h-4 w-4" />
              واتس‌اپ
            </a>
          )}
        </PageHero>

        <div className="container-site section">
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 lg:gap-10">
            {/* Contact details + map come first on phones: most visitors want the number or the route. */}
            <div className="space-y-5">
              <section className="card-luxury p-4 sm:p-6" aria-labelledby="contact-info-title">
                <h2 id="contact-info-title" className="mb-4 text-lg font-black text-foreground sm:text-xl">
                  اطلاعات تماس کلینیک
                </h2>
                <div className="space-y-4">
                  <InfoRow icon={<PinIcon className="h-5 w-5" />} label={t('addressTitle')}>
                    <address className="not-italic">{nap.addressFa}</address>
                  </InfoRow>
                  <InfoRow icon={<PhoneIcon className="h-5 w-5" />} label={t('phoneTitle')}>
                    <a href={nap.telLink} dir="ltr" className="inline-block text-base font-bold text-foreground hover:text-primary">
                      {nap.phoneDisplayFa}
                    </a>
                  </InfoRow>
                  {nap.whatsappLink && whatsappDisplay && (
                    <InfoRow icon={<ChatIcon className="h-5 w-5" />} label="واتس‌اپ پشتیبانی و سفارش">
                      <a
                        href={nap.whatsappLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        dir="ltr"
                        className="inline-block text-base font-bold text-foreground hover:text-primary"
                      >
                        {whatsappDisplay}
                      </a>
                    </InfoRow>
                  )}
                  <InfoRow icon={<ClockIcon className="h-5 w-5" />} label={t('hoursTitle')}>
                    {nap.workingHoursSummaryFa}
                  </InfoRow>
                  <InfoRow icon={<MailIcon className="h-5 w-5" />} label={t('emailTitle')}>
                    <a href={`mailto:${nap.email}`} dir="ltr" className="inline-block break-all hover:text-primary">
                      {nap.email}
                    </a>
                  </InfoRow>
                </div>

                <div className="mt-5 grid grid-cols-2 gap-2.5 border-t border-border/60 pt-5">
                  <a href={nap.telLink} className={`btn btn-gold ${nap.whatsappLink ? '' : 'col-span-2'}`}>
                    <PhoneIcon className="h-4 w-4" />
                    تماس
                  </a>
                  {nap.whatsappLink && (
                    <a href={nap.whatsappLink} target="_blank" rel="noopener noreferrer" className="btn btn-outline">
                      <ChatIcon className="h-4 w-4" />
                      واتس‌اپ
                    </a>
                  )}
                </div>
              </section>

              <section className="overflow-hidden rounded-2xl border border-border-gold/60 bg-surface-card" aria-labelledby="contact-map-title">
                <div className="p-4 sm:p-5">
                  <h2 id="contact-map-title" className="text-base font-bold text-foreground">
                    مسیریابی تا کلینیک
                  </h2>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {routes.map((r) => (
                      <a key={r.label} href={r.href} target="_blank" rel="noopener noreferrer" className="btn btn-secondary btn-sm min-h-11">
                        {r.label}
                      </a>
                    ))}
                  </div>
                </div>
                <iframe
                  title="موقعیت کلینیک پت‌باس روی نقشه"
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                  src={`https://maps.google.com/maps?q=${coords}&hl=fa&z=16&output=embed`}
                  className="block h-72 w-full border-0 sm:h-80"
                />
              </section>
            </div>

            <div className="space-y-5">
              <LeadForm
                variant="inline"
                title={t('formTitle')}
                subtitle="شماره خود را بگذارید تا همکاران پذیرش برای هماهنگی نوبت یا پاسخ به پرسش شما تماس بگیرند."
                phone={nap.phoneDisplayFa}
                telLink={nap.telLink}
              />
              <div className="surface-card p-4 text-sm leading-8 text-muted-foreground sm:p-5">
                پرسش شما درباره سفارش پت‌شاپ است؟{' '}
                <Link href="/shipping" className="font-bold text-primary hover:underline">راهنمای خرید و ارسال</Link>
                {' '}و{' '}
                <Link href="/returns" className="font-bold text-primary hover:underline">رویه بازگرداندن کالا</Link>
                {' '}را ببینید یا پاسخ پرسش‌های رایج را در{' '}
                <Link href="/faq" className="font-bold text-primary hover:underline">سوالات متداول</Link>
                {' '}بخوانید.
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
