import { db } from "@/lib/db";
import { getTranslations } from "next-intl/server";
import { LuxuryPillBadge } from "@/components/ui/luxury-pill-badge";

export default async function AboutPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const isEn = locale === 'en';
  const t = await getTranslations('About');

  const staff = await db.staffMember.findMany({
    where: { isActive: true },
    orderBy: { sortOrder: 'asc' },
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

        {/* Story + Mission */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-20">
          <div className="card-luxury p-8 flex flex-col justify-between">
            <div>
              <div className="w-14 h-14 bg-primary/10 text-primary rounded-xl flex items-center justify-center mb-6 border border-primary/20 shadow-gold">
                <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/></svg>
              </div>
              <h2 className="text-2xl font-bold text-foreground mb-4">{t('ourStory')}</h2>
              <p className="text-muted-foreground leading-relaxed text-sm">{t('storyText')}</p>
            </div>
          </div>
          <div className="card-luxury p-8 flex flex-col justify-between">
            <div>
              <div className="w-14 h-14 bg-primary/10 text-primary rounded-xl flex items-center justify-center mb-6 border border-primary/20 shadow-gold">
                <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="m16 10-5.12 5.12a2.12 2.12 0 0 1-3 0v0a2.12 2.12 0 0 1 0-3L13 7"/></svg>
              </div>
              <h2 className="text-2xl font-bold text-foreground mb-4">{t('ourMission')}</h2>
              <p className="text-muted-foreground leading-relaxed text-sm">{t('missionText')}</p>
            </div>
          </div>
        </div>

        {/* Facility Gallery Highlights */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-20">
          <div className="rounded-3xl overflow-hidden border border-border-gold/50 shadow-gold relative group">
            <div className="aspect-[16/10] w-full bg-charcoal-900 overflow-hidden">
              <img
                src="/images/reception.jpg"
                alt="Pet Boss Lounge"
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
              />
            </div>
            <div className="p-4 bg-surface border-t border-border">
              <p className="text-xs font-semibold text-foreground">
                {isEn ? 'Signature Welcome Lounge & Diagnostics' : 'سالن اختصاصی پذیرش و امکانات تشخیصی'}
              </p>
            </div>
          </div>
          <div className="rounded-3xl overflow-hidden border border-border-gold/50 shadow-gold relative group">
            <div className="aspect-[16/10] w-full bg-charcoal-900 overflow-hidden">
              <img
                src="/images/veterinarian.jpg"
                alt="Pet Boss Care"
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
              />
            </div>
            <div className="p-4 bg-surface border-t border-border">
              <p className="text-xs font-semibold text-foreground">
                {isEn ? 'Compassionate Surgical & Internal Medicine' : 'معاینات بالینی، درمان و جراحی‌های تخصصی'}
              </p>
            </div>
          </div>
        </div>

        {/* Team */}
        <div className="text-center mb-12">
          <span className="badge-pill-outline mb-3">{t('teamBadge')}</span>
          <h2 className="text-3xl font-extrabold text-foreground mb-4">{t('teamTitle')}</h2>
          <p className="text-muted-foreground max-w-xl mx-auto text-base">{t('teamSubtitle')}</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
          {staff.map((member) => {
            const mName = isEn ? (member.nameEn || member.nameFa) : member.nameFa;
            const mTitle = isEn ? (member.titleEn || member.titleFa) : member.titleFa;
            const mBio = isEn ? (member.bioEn || member.bioFa) : member.bioFa;

            return (
              <div key={member.id} className="card-luxury p-6 text-center">
                <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-surface-elevated border-2 border-border-gold flex items-center justify-center text-primary text-2xl font-bold shadow-gold">
                  {mName.charAt(0)}
                </div>
                <h3 className="text-lg font-bold text-foreground mb-1">{mName}</h3>
                <p className="text-xs text-primary font-semibold mb-2">{mTitle}</p>
                {mBio && (
                  <p className="text-xs text-muted-foreground leading-relaxed">{mBio}</p>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
