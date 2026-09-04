import { db } from "@/lib/db";
import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";

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
    <div className="section-padding">
      <div className="container-site">
        {/* Page Header */}
        <div className="text-center mb-16">
          <h1 className="text-4xl md:text-5xl font-bold text-charcoal-800 mb-4">{t('title')}</h1>
          <p className="text-muted-foreground max-w-2xl mx-auto text-lg">{t('subtitle')}</p>
        </div>

        {/* Services by Division */}
        <div className="space-y-16">
          {divisions.map((division) => (
            <div key={division.id}>
              <div className="flex items-center gap-3 mb-8">
                <div className="w-1.5 h-8 bg-gradient-gold rounded-full" />
                <h2 className="text-2xl font-bold text-charcoal-800">{division.nameFa}</h2>
              </div>
              {division.descriptionFa && (
                <p className="text-muted-foreground mb-8 max-w-2xl">{division.descriptionFa}</p>
              )}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {division.services.map((service) => (
                  <Card key={service.id} className="group border-border/50 hover:border-gold-300 hover:shadow-md transition-all">
                    <CardHeader>
                      <CardTitle className="text-lg text-charcoal-800 group-hover:text-gold-600 transition-colors">
                        {service.nameFa}
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-muted-foreground line-clamp-3 mb-4">{service.descriptionFa}</p>
                      {service.priceFrom && (
                        <div className="flex items-baseline gap-1">
                          <span className="text-sm font-bold text-gold-600">
                            {service.priceFrom.toLocaleString('fa-IR')}
                          </span>
                          {service.priceTo && (
                            <span className="text-sm font-bold text-gold-600">
                              — {service.priceTo.toLocaleString('fa-IR')}
                            </span>
                          )}
                          <span className="text-xs text-muted-foreground">{t('toman')}</span>
                        </div>
                      )}
                      {service.priceNoteFa && (
                        <p className="text-xs text-muted-foreground mt-1">{service.priceNoteFa}</p>
                      )}
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
