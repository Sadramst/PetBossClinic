import { db } from "@/lib/db";
import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";

export default async function HomePage() {
  const t = await getTranslations('Home');

  // Fetch data from DB
  const divisions = await db.division.findMany({
    where: { isActive: true },
    orderBy: { sortOrder: 'asc' },
  });

  const services = await db.service.findMany({
    where: { isActive: true },
    orderBy: { sortOrder: 'asc' },
    take: 6,
    include: { division: true },
  });

  const staff = await db.staffMember.findMany({
    where: { isActive: true },
    orderBy: { sortOrder: 'asc' },
    take: 4,
  });

  const testimonials = await db.testimonial.findMany({
    where: { isActive: true },
    orderBy: { sortOrder: 'asc' },
    take: 5,
  });

  const faqs = await db.faq.findMany({
    where: { isActive: true },
    orderBy: { sortOrder: 'asc' },
    take: 6,
  });

  // Division icons
  const divisionIcons = [
    // Clinical (stethoscope)
    <svg key="clin" xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M4.8 2.3A.3.3 0 1 0 5 2H4a2 2 0 0 0-2 2v5a6 6 0 0 0 6 6v0a6 6 0 0 0 6-6V4a2 2 0 0 0-2-2h-1a.2.2 0 1 0 .3.3"/><path d="M8 15v1a6 6 0 0 0 6 6v0a6 6 0 0 0 6-6v-4"/><circle cx="20" cy="10" r="2"/></svg>,
    // Grooming (scissors)
    <svg key="groom" xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="6" cy="6" r="3"/><path d="M8.12 8.12 12 12"/><path d="M20 4 8.12 15.88"/><circle cx="6" cy="18" r="3"/><path d="M14.8 14.8 20 20"/></svg>,
    // Shop (shopping bag)
    <svg key="shop" xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z"/><path d="M3 6h18"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>,
  ];

  return (
    <div className="flex flex-col">

      {/* ═══ HERO SECTION ═══ */}
      <section className="relative bg-gradient-hero text-white overflow-hidden">
        {/* Decorative gold accent */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-20 start-10 w-72 h-72 bg-gold-500 rounded-full blur-3xl" />
          <div className="absolute bottom-10 end-20 w-96 h-96 bg-gold-400 rounded-full blur-3xl" />
        </div>
        <div className="container-site relative z-10 py-24 md:py-36 text-center">
          {/* Tagline badge */}
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-gold-500/20 text-gold-300 text-sm font-medium mb-8 border border-gold-500/30">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/></svg>
            {t('tagline')}
          </div>

          <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight mb-6 max-w-4xl mx-auto leading-tight">
            {t('heroTitle')}
          </h1>
          <p className="text-lg md:text-xl text-charcoal-200 mb-10 max-w-2xl mx-auto leading-relaxed">
            {t('heroSubtitle')}
          </p>
          <div className="flex flex-col sm:flex-row justify-center gap-4">
            <Button asChild size="lg" className="bg-gradient-gold hover:opacity-90 text-white rounded-full px-8 shadow-gold text-base">
              <a href="tel:+982122000000">{t('heroCta')}</a>
            </Button>
            <Button asChild variant="outline" size="lg" className="rounded-full px-8 border-charcoal-500 text-charcoal-100 hover:bg-charcoal-700 text-base">
              <Link href="/services">{t('heroSecondaryCta')}</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* ═══ DIVISIONS SECTION ═══ */}
      <section className="section-padding bg-white">
        <div className="container-site">
          <div className="text-center mb-14">
            <h2 className="text-3xl md:text-4xl font-bold text-charcoal-800 mb-4">{t('divisionsTitle')}</h2>
            <p className="text-muted-foreground max-w-xl mx-auto">{t('divisionsSubtitle')}</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {divisions.map((div, idx) => (
              <Card key={div.id} className="group border-border/50 hover:border-gold-300 hover:shadow-lg transition-all duration-300 text-center p-8">
                <div className="w-16 h-16 mx-auto mb-6 bg-gold-50 text-gold-600 rounded-2xl flex items-center justify-center group-hover:bg-gold-500 group-hover:text-white transition-colors">
                  {divisionIcons[idx] || divisionIcons[0]}
                </div>
                <CardHeader className="p-0 mb-3">
                  <CardTitle className="text-xl text-charcoal-800">{div.nameFa}</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <p className="text-sm text-muted-foreground line-clamp-3">{div.descriptionFa}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ SERVICES SECTION ═══ */}
      <section className="section-padding bg-surface">
        <div className="container-site">
          <div className="text-center mb-14">
            <h2 className="text-3xl md:text-4xl font-bold text-charcoal-800 mb-4">{t('servicesTitle')}</h2>
            <p className="text-muted-foreground max-w-xl mx-auto">{t('servicesSubtitle')}</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {services.map((service) => (
              <Card key={service.id} className="group border-border/50 hover:border-gold-300 hover:shadow-md transition-all">
                <CardHeader>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] uppercase tracking-wider text-gold-600 font-semibold bg-gold-50 px-2 py-0.5 rounded">
                      {service.division.nameFa}
                    </span>
                  </div>
                  <CardTitle className="text-lg text-charcoal-800 group-hover:text-gold-600 transition-colors">
                    {service.nameFa}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground line-clamp-2 mb-4">{service.descriptionFa}</p>
                  {service.priceFrom && (
                    <p className="text-sm font-semibold text-gold-600">
                      {service.priceFrom.toLocaleString('fa-IR')} {service.priceTo ? `— ${service.priceTo.toLocaleString('fa-IR')}` : ''} تومان
                    </p>
                  )}
                  {service.priceNoteFa && (
                    <p className="text-xs text-muted-foreground mt-1">{service.priceNoteFa}</p>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
          <div className="text-center mt-10">
            <Button asChild variant="outline" className="rounded-full px-8 border-gold-300 text-gold-600 hover:bg-gold-50">
              <Link href="/services">{t('viewAllServices')}</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* ═══ TEAM SECTION ═══ */}
      <section className="section-padding bg-white">
        <div className="container-site">
          <div className="text-center mb-14">
            <h2 className="text-3xl md:text-4xl font-bold text-charcoal-800 mb-4">{t('teamTitle')}</h2>
            <p className="text-muted-foreground max-w-xl mx-auto">{t('teamSubtitle')}</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
            {staff.map((member) => (
              <div key={member.id} className="text-center group">
                <div className="w-28 h-28 mx-auto mb-4 rounded-full bg-gradient-to-br from-gold-100 to-gold-200 flex items-center justify-center text-gold-700 text-3xl font-bold shadow-md group-hover:shadow-gold transition-shadow">
                  {member.nameFa.charAt(0)}
                </div>
                <h3 className="text-lg font-bold text-charcoal-800">{member.nameFa}</h3>
                <p className="text-sm text-gold-600 font-medium mb-2">{member.titleFa}</p>
                <p className="text-xs text-muted-foreground line-clamp-2">{member.bioFa}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ TESTIMONIALS SECTION ═══ */}
      <section className="section-padding bg-charcoal-800 text-white">
        <div className="container-site">
          <div className="text-center mb-14">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">{t('testimonialsTitle')}</h2>
            <p className="text-charcoal-300 max-w-xl mx-auto">{t('testimonialsSubtitle')}</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {testimonials.slice(0, 3).map((test) => (
              <div key={test.id} className="bg-charcoal-700/50 rounded-xl p-6 border border-charcoal-600/50">
                {/* Stars */}
                <div className="flex gap-1 mb-4">
                  {Array.from({ length: test.rating }).map((_, i) => (
                    <svg key={i} xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="currentColor" className="text-gold-400"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
                  ))}
                </div>
                <p className="text-charcoal-200 text-sm mb-4 leading-relaxed">&ldquo;{test.contentFa}&rdquo;</p>
                <p className="text-sm font-semibold text-gold-400">{test.nameFa}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ FAQ SECTION ═══ */}
      <section className="section-padding bg-surface">
        <div className="container-site max-w-3xl">
          <div className="text-center mb-14">
            <h2 className="text-3xl md:text-4xl font-bold text-charcoal-800 mb-4">{t('faqTitle')}</h2>
            <p className="text-muted-foreground">{t('faqSubtitle')}</p>
          </div>
          <div className="space-y-4">
            {faqs.map((faq) => (
              <details key={faq.id} className="group bg-white rounded-xl border border-border/50 overflow-hidden">
                <summary className="flex items-center justify-between cursor-pointer px-6 py-4 text-sm font-semibold text-charcoal-800 hover:bg-gold-50/50 transition-colors list-none">
                  <span>{faq.questionFa}</span>
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-gold-500 transition-transform group-open:rotate-180"><path d="m6 9 6 6 6-6"/></svg>
                </summary>
                <div className="px-6 pb-4 text-sm text-muted-foreground leading-relaxed">
                  {faq.answerFa}
                </div>
              </details>
            ))}
          </div>
          <div className="text-center mt-8">
            <Button asChild variant="outline" className="rounded-full px-8 border-gold-300 text-gold-600 hover:bg-gold-50">
              <Link href="/faq">{t('viewAllFaq')}</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* ═══ LOCATION / MAP SECTION ═══ */}
      <section className="section-padding bg-white">
        <div className="container-site">
          <div className="text-center mb-14">
            <h2 className="text-3xl md:text-4xl font-bold text-charcoal-800 mb-4">{t('locationTitle')}</h2>
            <p className="text-muted-foreground max-w-xl mx-auto">{t('locationSubtitle')}</p>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
            {/* Map embed */}
            <div className="rounded-2xl overflow-hidden shadow-lg border border-border/50 aspect-video">
              <iframe
                src="https://www.google.com/maps/embed?pb=!1m17!1m12!1m3!1d3237.5!2d51.4350853!3d35.790937!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m2!1m1!2zMzXCsDQ3JzI3LjQiTiA1McKwMjYnMDYuMyJF!5e0!3m2!1sfa!2s!4v1"
                width="100%"
                height="100%"
                style={{ border: 0 }}
                allowFullScreen
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
                title="Pet Boss Clinic Location"
              />
            </div>
            {/* Info card */}
            <div className="space-y-6">
              <div className="bg-surface rounded-2xl p-8 border border-border/50">
                <h3 className="text-lg font-bold text-charcoal-800 mb-4">کلینیک دامپزشکی پت‌باس</h3>
                <div className="space-y-3 text-sm text-muted-foreground">
                  <p>📍 تهران، خیابان شریعتی، نرسیده به مترو قیطریه، پلاک ۱۷۳۳</p>
                  <p>📞 ۰۲۱-۲۲XXXXXX</p>
                  <p>📧 info@petbossclinic.com</p>
                  <p>🕐 شنبه تا پنج‌شنبه: ۹ الی ۲۱ — جمعه: ۱۰ الی ۱۴</p>
                </div>
              </div>
              <div className="flex flex-col sm:flex-row gap-3">
                <Button asChild className="bg-gradient-gold hover:opacity-90 text-white rounded-full shadow-gold flex-1">
                  <a href="https://www.google.com/maps?q=35.790937,51.4350853&z=17&hl=en" target="_blank" rel="noopener noreferrer">
                    {t('getDirections')}
                  </a>
                </Button>
                <Button asChild variant="outline" className="rounded-full border-gold-300 text-gold-600 hover:bg-gold-50 flex-1">
                  <Link href="/contact">{t('contactUs')}</Link>
                </Button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ═══ STICKY MOBILE BAR ═══ */}
      <div className="fixed bottom-0 inset-x-0 z-40 lg:hidden bg-white/95 backdrop-blur border-t border-border shadow-lg p-3">
        <div className="flex gap-3">
          <Button asChild className="flex-1 bg-gradient-gold text-white rounded-full shadow-gold">
            <a href="tel:+982122000000">
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="me-2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
              تماس
            </a>
          </Button>
          <Button asChild variant="outline" className="flex-1 rounded-full border-green-500 text-green-600 hover:bg-green-50">
            <a href="https://wa.me/989120000000" target="_blank" rel="noopener noreferrer">
              واتساپ
            </a>
          </Button>
        </div>
      </div>

    </div>
  );
}
