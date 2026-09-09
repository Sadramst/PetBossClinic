import { Metadata } from 'next';
import { db } from "@/lib/db";
import Image from "next/image";
import { getTranslations } from "next-intl/server";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { LuxuryPillBadge } from "@/components/ui/luxury-pill-badge";
import { getSitePictures } from "@/lib/media";
import { BreadcrumbJsonLd, ServiceJsonLd } from '@/lib/seo/json-ld';

export const revalidate = 60;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const isEn = locale === 'en';

  const title = isEn
    ? 'Veterinary Services & Pricing'
    : 'خدمات و تعرفه‌های دامپزشکی | واکسیناسیون، جراحی، گرومینگ قیطریه تهران';

  const description = isEn
    ? 'Complete veterinary services: vaccination, surgery, orthopedics, dental care, grooming & parasite therapy at Pet Boss Clinic, Gheitariyeh Tehran.'
    : 'خدمات جامع دامپزشکی پت باس: واکسیناسیون سگ و گربه، جراحی بافت نرم، ارتوپدی، دندانپزشکی، گرومینگ حرفه‌ای و انگل‌درمانی در قیطریه تهران.';

  return {
    title,
    description,
    alternates: {
      canonical: isEn ? '/en/services' : '/services',
      languages: {
        'fa-IR': '/services',
        en: '/en/services',
      },
    },
    openGraph: {
      title,
      description,
      url: isEn ? '/en/services' : '/services',
      images: [{ url: '/images/veterinarian.jpg', width: 1200, height: 630 }],
    },
  };
}

export default async function ServicesPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const isEn = locale === 'en';
  const t = await getTranslations('Services');

  const [divisions, sitePictures] = await Promise.all([
    db.division.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' },
      include: {
        services: {
          where: { isActive: true },
          orderBy: { sortOrder: 'asc' },
        },
      },
    }),
    getSitePictures(),
  ]);
  // Build service items for JSON-LD
  const allServices = divisions.flatMap((div) =>
    div.services.map((svc) => ({
      name: isEn ? (svc.nameEn || svc.nameFa) : svc.nameFa,
      description: isEn ? (svc.descriptionEn || svc.descriptionFa || '') : (svc.descriptionFa || ''),
      priceFrom: svc.priceFrom,
      priceTo: svc.priceTo,
    }))
  );

  return (
    <>
      <BreadcrumbJsonLd
        items={[
          { name: isEn ? 'Home' : 'خانه', href: '/' },
          { name: isEn ? 'Services' : 'خدمات', href: '/services' },
        ]}
        locale={locale}
      />
      <ServiceJsonLd
        services={allServices}
        providerName={isEn ? 'Pet Boss Clinic' : 'کلینیک دامپزشکی پت باس'}
        locale={locale}
      />
    <div className="bg-background">
      {/* Dynamic Theme Top Page Header */}
      <section className="relative bg-gradient-hero text-foreground overflow-hidden border-b border-border/60 py-16 md:py-20 mb-12">
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div className="absolute top-1/2 start-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-primary/10 rounded-full blur-[120px]" />
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
        {/* Services by Division */}
        <div className="space-y-16">
          {divisions.map((division) => {
            const divName = isEn ? (division.nameEn || division.nameFa) : division.nameFa;
            const divDesc = isEn ? (division.descriptionEn || division.descriptionFa) : division.descriptionFa;

            const divImage = division.slugEn === 'clinical'
              ? sitePictures.division_veterinary
              : division.slugEn === 'grooming'
              ? sitePictures.division_grooming
              : sitePictures.division_petshop;

            return (
              <div key={division.id} className="p-8 rounded-2xl bg-surface border border-border/60 overflow-hidden">
                <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 mb-8 pb-6 border-b border-border/60">
                  <div className="max-w-2xl">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-2 h-8 bg-gradient-gold rounded-full" />
                      <h2 className="text-2xl font-bold text-foreground">{divName}</h2>
                    </div>
                    {divDesc && (
                      <p className="text-muted-foreground text-sm leading-relaxed">{divDesc}</p>
                    )}
                  </div>
                  <div className="w-full md:w-56 h-32 rounded-xl overflow-hidden border border-border-gold/40 shadow-gold shrink-0 relative">
                    <Image
                      src={divImage}
                      alt={divName}
                      fill
                      sizes="(max-width: 768px) 100vw, 224px"
                      className="object-cover"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {division.services.map((service) => {
                    const sName = isEn ? (service.nameEn || service.nameFa) : service.nameFa;
                    const sDesc = isEn ? (service.descriptionEn || service.descriptionFa) : service.descriptionFa;
                    const sDuration = isEn ? (service.durationEn || service.durationFa) : service.durationFa;
                    const sPriceNote = isEn ? (service.priceNoteEn || service.priceNoteFa) : service.priceNoteFa;

                    return (
                      <Card key={service.id} className="card-luxury">
                        <CardHeader className="pb-3">
                          <div className="flex items-center justify-between mb-2">
                            {sDuration && (
                              <span className="text-xs text-primary bg-primary/10 px-2 py-0.5 rounded font-medium">
                                {sDuration}
                              </span>
                            )}
                          </div>
                          <CardTitle className="text-lg font-bold text-foreground group-hover:text-primary transition-colors">
                            {sName}
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <p className="text-sm text-muted-foreground line-clamp-3 mb-4 leading-relaxed">{sDesc}</p>
                          <div className="pt-3 border-t border-border flex items-center justify-between">
                            <div>
                              {service.priceFrom ? (
                                <div className="flex items-baseline gap-1">
                                  <span className="text-sm font-bold text-primary">
                                    {isEn
                                      ? service.priceFrom.toLocaleString('en-US')
                                      : service.priceFrom.toLocaleString('fa-IR')}
                                  </span>
                                  {service.priceTo && (
                                    <span className="text-sm font-bold text-primary">
                                      — {isEn
                                        ? service.priceTo.toLocaleString('en-US')
                                        : service.priceTo.toLocaleString('fa-IR')}
                                    </span>
                                  )}
                                  <span className="text-xs text-muted-foreground">{t('toman')}</span>
                                </div>
                              ) : (
                                <span className="text-xs text-muted-foreground">{t('callForPrice')}</span>
                              )}
                              {sPriceNote && (
                                <p className="text-[11px] text-muted-foreground mt-0.5">{sPriceNote}</p>
                              )}
                            </div>
                            <Button asChild size="sm" className="bg-primary/15 text-primary hover:bg-primary hover:text-charcoal-950 font-semibold text-xs rounded-full px-3.5 py-1.5 transition-all shadow-sm">
                              <a href="tel:+982126429715" className="flex items-center gap-1.5">
                                <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
                                <span>{t('bookNow')}</span>
                              </a>
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
    </>
  );
}
