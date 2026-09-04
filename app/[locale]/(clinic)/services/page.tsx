import { db } from "@/lib/db";
import { getTranslations } from "next-intl/server";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { LuxuryPillBadge } from "@/components/ui/luxury-pill-badge";

export default async function ServicesPage() {
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
            تعرفه‌ها و خدمات کلینیک
          </LuxuryPillBadge>
          <h1 className="text-4xl md:text-5xl font-extrabold text-foreground mb-4">{t('title')}</h1>
          <p className="text-muted-foreground max-w-2xl mx-auto text-lg leading-relaxed">{t('subtitle')}</p>
        </div>

        {/* Services by Division */}
        <div className="space-y-16">
          {divisions.map((division) => (
            <div key={division.id} className="p-8 rounded-2xl bg-surface border border-border/60">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-2 h-8 bg-gradient-gold rounded-full" />
                <h2 className="text-2xl font-bold text-foreground">{division.nameFa}</h2>
              </div>
              {division.descriptionFa && (
                <p className="text-muted-foreground mb-8 max-w-2xl text-sm leading-relaxed">{division.descriptionFa}</p>
              )}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {division.services.map((service) => (
                  <Card key={service.id} className="card-luxury">
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between mb-2">
                        {service.durationFa && (
                          <span className="text-xs text-primary bg-primary/10 px-2 py-0.5 rounded font-medium">
                            {service.durationFa}
                          </span>
                        )}
                      </div>
                      <CardTitle className="text-lg font-bold text-foreground group-hover:text-primary transition-colors">
                        {service.nameFa}
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-muted-foreground line-clamp-3 mb-4 leading-relaxed">{service.descriptionFa}</p>
                      <div className="pt-3 border-t border-border flex items-center justify-between">
                        <div>
                          {service.priceFrom ? (
                            <div className="flex items-baseline gap-1">
                              <span className="text-sm font-bold text-primary">
                                {service.priceFrom.toLocaleString('fa-IR')}
                              </span>
                              {service.priceTo && (
                                <span className="text-sm font-bold text-primary">
                                  — {service.priceTo.toLocaleString('fa-IR')}
                                </span>
                              )}
                              <span className="text-xs text-muted-foreground">{t('toman')}</span>
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground">تماس بگیرید</span>
                          )}
                          {service.priceNoteFa && (
                            <p className="text-[11px] text-muted-foreground mt-0.5">{service.priceNoteFa}</p>
                          )}
                        </div>
                        <Button asChild size="sm" className="bg-primary/15 text-primary hover:bg-primary hover:text-charcoal-950 font-semibold text-xs rounded-full">
                          <a href="tel:+982122000000">رزرو نوبت</a>
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
