import { db } from "@/lib/db";
import { getTranslations } from "next-intl/server";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { LuxuryPillBadge } from "@/components/ui/luxury-pill-badge";

export default async function ServicesPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const isEn = locale === 'en';
  const t = await getTranslations('Services');

  const divisions = await db.division.findMany({
    where: { isActive: true },
    orderBy: { sortOrder: 'asc' },
    include: {
      services: {
        where: { isActive: true },
        orderBy: { sortOrder: 'asc' },
      },
    },
  });

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

        {/* Services by Division */}
        <div className="space-y-16">
          {divisions.map((division) => {
            const divName = isEn ? (division.nameEn || division.nameFa) : division.nameFa;
            const divDesc = isEn ? (division.descriptionEn || division.descriptionFa) : division.descriptionFa;

            const divImage = division.slugEn === 'clinical'
              ? '/images/veterinarian.jpg'
              : division.slugEn === 'grooming'
              ? '/images/grooming.jpg'
              : '/images/petshop.jpg';

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
                  <div className="w-full md:w-56 h-32 rounded-xl overflow-hidden border border-border-gold/40 shadow-gold shrink-0">
                    <img
                      src={divImage}
                      alt={divName}
                      className="w-full h-full object-cover"
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
                            <Button asChild size="sm" className="bg-primary/15 text-primary hover:bg-primary hover:text-charcoal-950 font-semibold text-xs rounded-full">
                              <a href="tel:+982122000000">{t('bookAppointment')}</a>
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
  );
}
