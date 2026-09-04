import { db } from "@/lib/db";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/routing";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { PetBossLogo } from "@/components/shared/pet-boss-logo";
import { LuxuryPillBadge } from "@/components/ui/luxury-pill-badge";

export default async function HomePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const isEn = locale === 'en';
  const t = await getTranslations('Home');

  // Fetch data from DB safely
  const [divisions, services, staff, testimonials, faqs] = await Promise.all([
    db.division.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' },
    }),
    db.service.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' },
      take: 6,
      include: { division: true },
    }),
    db.staffMember.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' },
      take: 4,
    }),
    db.testimonial.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' },
      take: 5,
    }),
    db.faq.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' },
      take: 6,
    }),
  ]);

  // Division icons
  const divisionIcons = [
    // Clinical (stethoscope)
    <svg key="clin" xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M4.8 2.3A.3.3 0 1 0 5 2H4a2 2 0 0 0-2 2v5a6 6 0 0 0 6 6v0a6 6 0 0 0 6-6V4a2 2 0 0 0-2-2h-1a.2.2 0 1 0 .3.3"/><path d="M8 15v1a6 6 0 0 0 6 6v0a6 6 0 0 0 6-6v-4"/><circle cx="20" cy="10" r="2"/></svg>,
    // Grooming (scissors)
    <svg key="groom" xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><circle cx="6" cy="6" r="3"/><path d="M8.12 8.12 12 12"/><path d="M20 4 8.12 15.88"/><circle cx="6" cy="18" r="3"/><path d="M14.8 14.8 20 20"/></svg>,
    // Shop (shopping bag)
    <svg key="shop" xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z"/><path d="M3 6h18"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>,
  ];

  return (
    <div className="flex flex-col">

      {/* ═══ SIGNATURE LUXURY HERO SECTION ═══ */}
      <section className="relative bg-gradient-hero text-foreground overflow-hidden border-b border-border/60 py-20 md:py-28">
        {/* Subtle Ambient Gold Glows */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div className="absolute top-1/4 start-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-primary/10 rounded-full blur-[140px]" />
          <div className="absolute bottom-0 end-10 w-[400px] h-[400px] bg-primary/5 rounded-full blur-[120px]" />
        </div>

        <div className="container-site relative z-10 flex flex-col items-center text-center">
          {/* Main Crowned Lion Emblem */}
          <div className="mb-6 animate-fade-in">
            <PetBossLogo size="xl" showText={false} variant="gold" />
          </div>

          <h2 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-black tracking-widest text-gradient-gold mb-2 uppercase">
            PET BOSS
          </h2>
          <p className="text-lg sm:text-xl md:text-2xl font-semibold text-foreground/90 mb-8">
            {t('clinicTitle')}
          </p>

          {/* Physical Branding Golden Pills directly from petbossclinic.jpeg */}
          <div className="flex flex-wrap items-center justify-center gap-2.5 sm:gap-3 max-w-3xl mx-auto mb-10">
            <LuxuryPillBadge variant="gold">{t('careWithLove')}</LuxuryPillBadge>
            <LuxuryPillBadge variant="gold">{t('specializedSurgery')}</LuxuryPillBadge>
            <LuxuryPillBadge variant="gold">{t('dentistry')}</LuxuryPillBadge>
            <LuxuryPillBadge variant="gold">{t('internalMedicine')}</LuxuryPillBadge>
            <LuxuryPillBadge variant="gold">{t('hospitalization')}</LuxuryPillBadge>
            <LuxuryPillBadge variant="gold">{t('luxuryShop')}</LuxuryPillBadge>
          </div>

          <p className="text-base sm:text-lg text-muted-foreground max-w-2xl mx-auto mb-10 leading-relaxed">
            {t('heroSubtitle')}
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 w-full sm:w-auto">
            <Button
              asChild
              size="lg"
              className="bg-gradient-gold hover:opacity-95 text-charcoal-950 font-bold rounded-full px-9 py-6 text-base shadow-gold-lg border border-gold-300/40 w-full sm:w-auto"
            >
              <a href="tel:+982122000000" className="flex items-center justify-center gap-2.5">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
                <span>{t('heroCta')}</span>
              </a>
            </Button>
            <Button
              asChild
              variant="outline"
              size="lg"
              className="rounded-full px-8 py-6 border-border-gold text-foreground hover:bg-surface-elevated hover:border-primary text-base w-full sm:w-auto"
            >
              <Link href="/services">{t('heroSecondaryCta')}</Link>
            </Button>
          </div>

          {/* Luxury Reception Showcase */}
          <div className="mt-14 w-full max-w-4xl mx-auto rounded-3xl overflow-hidden border-2 border-border-gold/60 shadow-gold-lg relative group">
            <div className="aspect-[16/9] w-full overflow-hidden bg-charcoal-900 relative">
              <img
                src="/images/reception.jpg"
                alt="Pet Boss Luxury Clinic Lounge"
                className="w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-700"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-charcoal-950/90 via-charcoal-950/20 to-transparent flex items-end p-6 sm:p-8">
                <div className="text-start">
                  <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/20 border border-primary/40 text-primary text-xs font-semibold backdrop-blur-md mb-2">
                    ✨ {isEn ? 'Signature Luxury Atmosphere' : 'فضای اشرافی و مدرن کلینیک'}
                  </span>
                  <p className="text-sm sm:text-base font-bold text-foreground">
                    {isEn ? 'Experience world-class veterinary medicine & pet hospitality in Tehran' : 'تجربه‌ای منحصربه‌فرد از طبابت و مراقبت باکیفیت حیوانات خانگی در محیطی مجلل'}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ═══ 3 CORE DIVISIONS SECTION ═══ */}
      <section className="section-padding bg-surface">
        <div className="container-site">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-extrabold text-foreground mb-4">
              {t('divisionsTitle')}
            </h2>
            <p className="text-muted-foreground max-w-xl mx-auto text-base">
              {t('divisionsSubtitle')}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {divisions.map((div, idx) => {
              const divName = isEn ? (div.nameEn || div.nameFa) : div.nameFa;
              const divDesc = isEn ? (div.descriptionEn || div.descriptionFa) : div.descriptionFa;
              const divImage = idx === 0 ? '/images/veterinarian.jpg' : idx === 1 ? '/images/grooming.jpg' : '/images/petshop.jpg';
              return (
                <div
                  key={div.id}
                  className="card-luxury overflow-hidden flex flex-col group relative"
                >
                  <div className="relative aspect-[16/10] w-full overflow-hidden bg-charcoal-900 border-b border-border-gold/30">
                    <img
                      src={divImage}
                      alt={divName}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                    <div className="absolute top-3 start-3 w-12 h-12 rounded-xl bg-surface/90 backdrop-blur border border-border-gold flex items-center justify-center text-primary shadow-gold">
                      {divisionIcons[idx] || divisionIcons[0]}
                    </div>
                  </div>
                  <div className="p-6 sm:p-8 text-center flex flex-col items-center flex-grow">
                    <h3 className="text-xl font-bold text-foreground mb-3 group-hover:text-primary transition-colors">
                      {divName}
                    </h3>
                    <p className="text-sm text-muted-foreground leading-relaxed mb-6 flex-grow">
                      {divDesc}
                    </p>
                    <Link
                      href="/services"
                      className="inline-flex items-center gap-1.5 text-xs font-bold text-primary hover:text-primary-hover group-hover:underline"
                    >
                      <span>{t('learnMoreServices')}</span>
                      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="rtl:rotate-180"><path d="m9 18 6-6-6-6"/></svg>
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ═══ SERVICES CATALOG PREVIEW ═══ */}
      <section className="section-padding bg-background">
        <div className="container-site">
          <div className="text-center mb-16">
            <span className="badge-pill-outline mb-3">{t('servicesBadge')}</span>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-foreground mb-4">
              {t('servicesTitle')}
            </h2>
            <p className="text-muted-foreground max-w-xl mx-auto text-base">
              {t('servicesSubtitle')}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {services.map((service) => {
              const sName = isEn ? (service.nameEn || service.nameFa) : service.nameFa;
              const sDesc = isEn ? (service.descriptionEn || service.descriptionFa) : service.descriptionFa;
              const sDivName = isEn ? (service.division.nameEn || service.division.nameFa) : service.division.nameFa;
              const sDuration = isEn ? (service.durationEn || service.durationFa) : service.durationFa;
              const sPriceNote = isEn ? (service.priceNoteEn || service.priceNoteFa) : service.priceNoteFa;

              return (
                <Card key={service.id} className="card-luxury">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <span className="text-[11px] font-bold text-primary bg-primary/10 border border-primary/20 px-2.5 py-0.5 rounded-full">
                        {sDivName}
                      </span>
                      {sDuration && (
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                          {sDuration}
                        </span>
                      )}
                    </div>
                    <CardTitle className="text-lg font-bold text-foreground group-hover:text-primary transition-colors">
                      {sName}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground line-clamp-2 mb-4 leading-relaxed">
                      {sDesc}
                    </p>
                    <div className="pt-3 border-t border-border flex items-center justify-between">
                      <div>
                        {service.priceFrom ? (
                          <div className="text-sm font-bold text-primary">
                            <span>
                              {isEn
                                ? service.priceFrom.toLocaleString('en-US')
                                : service.priceFrom.toLocaleString('fa-IR')}
                            </span>
                            {service.priceTo && (
                              <span>
                                {' '}{t('to')}{' '}
                                {isEn
                                  ? service.priceTo.toLocaleString('en-US')
                                  : service.priceTo.toLocaleString('fa-IR')}
                              </span>
                            )}
                            <span className="text-xs font-normal text-muted-foreground ms-1">{t('toman')}</span>
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">{t('callForPrice')}</span>
                        )}
                        {sPriceNote && (
                          <p className="text-[11px] text-muted-foreground mt-0.5">{sPriceNote}</p>
                        )}
                      </div>
                      <Button asChild size="sm" variant="ghost" className="text-primary hover:text-primary hover:bg-primary/10 text-xs">
                        <a href="tel:+982122000000">{t('bookNow')}</a>
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          <div className="text-center mt-12">
            <Button asChild size="lg" variant="outline" className="rounded-full px-9 border-border-gold text-foreground hover:bg-surface hover:border-primary">
              <Link href="/services">{t('viewAllServices')}</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* ═══ VETERINARY TEAM ═══ */}
      <section className="section-padding bg-surface border-y border-border/60">
        <div className="container-site">
          <div className="text-center mb-16">
            <span className="badge-pill-outline mb-3">{t('teamBadge')}</span>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-foreground mb-4">
              {t('teamTitle')}
            </h2>
            <p className="text-muted-foreground max-w-xl mx-auto text-base">
              {t('teamSubtitle')}
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {staff.map((vet) => {
              const vName = isEn ? (vet.nameEn || vet.nameFa) : vet.nameFa;
              const vTitle = isEn ? (vet.titleEn || vet.titleFa) : vet.titleFa;
              const vSpecialty = isEn ? (vet.specialtyEn || vet.specialtyFa) : vet.specialtyFa;

              return (
                <div key={vet.id} className="card-luxury p-6 text-center flex flex-col items-center">
                  <div className="w-24 h-24 rounded-full bg-surface-elevated border-2 border-border-gold flex items-center justify-center text-primary mb-5 shadow-gold overflow-hidden">
                    <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                  </div>
                  <h3 className="text-lg font-bold text-foreground mb-1">{vName}</h3>
                  <p className="text-xs font-semibold text-primary mb-2">{vTitle}</p>
                  {vSpecialty && (
                    <p className="text-xs text-muted-foreground mb-3">{vSpecialty}</p>
                  )}
                  {vet.licenseNo && (
                    <span className="text-[10px] text-muted-foreground bg-surface-elevated px-2.5 py-1 rounded-full border border-border">
                      {t('medicalLicense')}: {vet.licenseNo}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ═══ TESTIMONIALS ═══ */}
      <section className="section-padding bg-background">
        <div className="container-site">
          <div className="text-center mb-16">
            <span className="badge-pill-outline mb-3">
              {isEn ? 'Client Satisfaction' : 'رضایت مراجعین'}
            </span>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-foreground mb-4">
              {t('testimonialsTitle')}
            </h2>
            <p className="text-muted-foreground max-w-xl mx-auto text-base">
              {t('testimonialsSubtitle')}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {testimonials.map((item) => {
              const tName = isEn ? (item.nameEn || item.nameFa) : item.nameFa;
              const tContent = isEn ? (item.contentEn || item.contentFa) : item.contentFa;
              return (
                <Card key={item.id} className="card-luxury p-6 flex flex-col justify-between">
                  <div>
                    {/* Golden Stars */}
                    <div className="flex items-center gap-1 mb-4 text-primary">
                      {[...Array(item.rating || 5)].map((_, i) => (
                        <svg key={i} xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
                      ))}
                    </div>
                    <p className="text-sm text-foreground/90 leading-relaxed mb-6 italic">
                      «{tContent}»
                    </p>
                  </div>
                  <div className="pt-4 border-t border-border flex items-center justify-between text-xs">
                    <div>
                      <span className="font-bold text-foreground block">{tName}</span>
                      <span className="text-muted-foreground text-[11px]">
                        {isEn ? 'Clinic Patient Parent' : 'مراجعه‌کننده به کلینیک'}
                      </span>
                    </div>
                    <span className="text-[10px] text-primary bg-primary/10 px-2 py-0.5 rounded">
                      {isEn ? 'Verified Client' : 'مراجع کلینیک'}
                    </span>
                  </div>
                </Card>
              );
            })}
          </div>
        </div>
      </section>

      {/* ═══ FAQS ACCORDION ═══ */}
      <section className="section-padding bg-surface border-t border-border/60">
        <div className="container-site max-w-4xl">
          <div className="text-center mb-14">
            <span className="badge-pill-outline mb-3">
              {isEn ? 'Answers to Your Questions' : 'پاسخ به سوالات شما'}
            </span>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-foreground mb-4">
              {t('faqTitle')}
            </h2>
            <p className="text-muted-foreground text-base">
              {t('faqSubtitle')}
            </p>
          </div>

          <div className="space-y-4">
            {faqs.map((faq) => {
              const qText = isEn ? (faq.questionEn || faq.questionFa) : faq.questionFa;
              const aText = isEn ? (faq.answerEn || faq.answerFa) : faq.answerFa;
              return (
                <details
                  key={faq.id}
                  className="card-luxury p-5 group open:bg-surface-elevated transition-colors cursor-pointer"
                >
                  <summary className="font-bold text-base text-foreground list-none flex items-center justify-between">
                    <span>{qText}</span>
                    <span className="text-primary group-open:rotate-180 transition-transform duration-200">
                      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"/></svg>
                    </span>
                  </summary>
                  <p className="mt-4 text-sm text-muted-foreground leading-relaxed pt-3 border-t border-border">
                    {aText}
                  </p>
                </details>
              );
            })}
          </div>

          <div className="text-center mt-10">
            <Button asChild variant="outline" className="rounded-full px-8 border-border-gold text-foreground hover:bg-surface-elevated">
              <Link href="/faq">{t('viewAllFaq')}</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* ═══ CLINIC LOCATION & MAP ═══ */}
      <section className="section-padding bg-background border-t border-border/60">
        <div className="container-site">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 items-center">
            <div>
              <span className="badge-pill-outline mb-3">
                {isEn ? 'Easy Access' : 'دسترسی آسان'}
              </span>
              <h2 className="text-3xl sm:text-4xl font-extrabold text-foreground mb-4">
                {t('locationTitle')}
              </h2>
              <p className="text-muted-foreground text-base mb-8 leading-relaxed">
                {t('locationSubtitle')}
              </p>

              <div className="space-y-4 mb-8">
                <div className="flex items-start gap-3 p-4 rounded-xl bg-surface-card border border-border">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>
                  </div>
                  <div>
                    <h4 className="font-bold text-foreground text-sm mb-1">
                      {isEn ? 'Clinic Address' : 'نشانی کلینیک'}
                    </h4>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      {isEn
                        ? 'Shariati St., north of Sadr Bridge, near Gheytarieh Metro Station, No. 1733, Tehran, Iran'
                        : 'تهران، خیابان شریعتی، بالاتر از پل صدر، نرسیده به ایستگاه مترو قیطریه، پلاک ۱۷۳۳'}
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-4 rounded-xl bg-surface-card border border-border">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                  </div>
                  <div>
                    <h4 className="font-bold text-foreground text-sm mb-1">
                      {isEn ? 'Working Hours' : 'ساعات کاری'}
                    </h4>
                    <p className="text-xs text-muted-foreground">
                      {isEn
                        ? 'Every day from 10:00 AM to 10:00 PM (including holidays)'
                        : 'همه روزه از ۱۰:۰۰ صبح الی ۲۲:۰۰ شب (شامل روزهای تعطیل)'}
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap gap-3">
                <Button asChild className="bg-gradient-gold text-charcoal-950 font-bold rounded-full px-6 shadow-gold">
                  <a
                    href="https://maps.google.com/?q=35.790937,51.4350853"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {isEn ? 'Navigate with Google Maps' : 'مسیریابی با گوگل مپ'}
                  </a>
                </Button>
                <Button asChild variant="outline" className="rounded-full px-6 border-border-gold text-foreground hover:bg-surface">
                  <a
                    href="https://waze.com/ul?ll=35.790937,51.4350853&navigate=yes"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {isEn ? 'Navigate with Waze' : 'مسیریابی با ویز'}
                  </a>
                </Button>
              </div>
            </div>

            {/* Map Embed */}
            <div className="w-full h-80 lg:h-96 rounded-2xl overflow-hidden border border-border-gold shadow-gold-lg bg-surface-card relative">
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
      </section>

      {/* ═══ STICKY MOBILE EMERGENCY CALL BAR ═══ */}
      <div className="fixed bottom-0 inset-x-0 z-40 sm:hidden bg-surface-card/95 backdrop-blur border-t border-border-gold p-3 flex gap-3 shadow-2xl">
        <a
          href="tel:+982122000000"
          className="flex-1 bg-gradient-gold text-charcoal-950 font-bold text-center py-3 rounded-full text-sm flex items-center justify-center gap-2 shadow-gold"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
          {isEn ? 'Emergency Call' : 'تماس فوری و اورژانس'}
        </a>
        <a
          href="https://wa.me/989120000000"
          target="_blank"
          rel="noopener noreferrer"
          className="w-12 h-12 rounded-full bg-surface-elevated border border-border-gold flex items-center justify-center text-primary shrink-0"
          aria-label="WhatsApp"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
        </a>
      </div>

    </div>
  );
}
