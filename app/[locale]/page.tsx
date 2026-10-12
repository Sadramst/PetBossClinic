import type { Metadata } from 'next';
import { db } from "@/lib/db";
import Image from "next/image";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/routing";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { PetBossLogo } from "@/components/shared/pet-boss-logo";
import { LuxuryPillBadge } from "@/components/ui/luxury-pill-badge";
import { getSitePictures } from "@/lib/media";
import { getClinicNAP } from "@/lib/clinic/nap";
import { formatPrice, formatServicePrice } from "@/lib/format/price";
import { toPersianDigits } from "@/lib/utils/phone";
import {
  VeterinaryCareJsonLd,
  FAQPageJsonLd,
  BreadcrumbJsonLd,
} from '@/lib/seo/json-ld';

export const revalidate = 60;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const isEn = locale === 'en';

  const title = isEn
    ? 'Pet Boss Clinic & Pet Shop | Veterinary Surgery, Dentistry & Grooming in Tehran'
    : 'کلینیک دامپزشکی و پت شاپ پت باس تهران | جراحی، دندانپزشکی، واکسیناسیون و گرومینگ';

  const description = isEn
    ? 'Pet Boss Clinic in Gheitariyeh, Shariati, Tehran. Specialized veterinary surgery, dental care, professional grooming, vaccination, and luxury pet boutique.'
    : 'کلینیک تخصصی دامپزشکی پت باس در قیطریه، خیابان شریعتی تهران. خدمات جراحی، دندانپزشکی حیوانات، واکسیناسیون سگ و گربه، گرومینگ تخصصی و پت شاپ لوکس.';

  return {
    title,
    description,
    keywords: isEn
      ? ['veterinary clinic Tehran', 'pet shop Gheitariyeh', 'dog cat surgery Tehran', 'pet dental clinic Tehran', 'dog grooming Tehran', 'Pet Boss Clinic']
      : ['کلینیک دامپزشکی تهران', 'دامپزشکی قیطریه', 'دامپزشکی شریعتی', 'پت شاپ قیطریه', 'واکسیناسیون سگ و گربه', 'جراحی حیوانات خانگی تهران', 'دندانپزشکی سگ و گربه', 'گرومینگ سگ تهران'],
    alternates: {
      canonical: isEn ? 'https://www.petbossclinic.com/en' : 'https://www.petbossclinic.com',
      languages: {
        'fa-IR': 'https://www.petbossclinic.com',
        en: 'https://www.petbossclinic.com/en',
      },
    },
    openGraph: {
      title,
      description,
      url: isEn ? 'https://www.petbossclinic.com/en' : 'https://www.petbossclinic.com',
      images: [{ url: '/images/petboss-sign.jpg', width: 1200, height: 630, alt: title }],
    },
  };
}

export default async function HomePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const isEn = locale === 'en';
  const t = await getTranslations('Home');

  // Fetch data from DB safely
  const [
    divisions,
    services,
    staff,
    testimonials,
    faqs,
    sitePictures,
    featuredProductsDb,
    nap,
    siteSetting,
    homepageSectionsDb,
  ] = await Promise.all([
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
      take: 6,
    }),
    db.faq.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' },
      take: 6,
    }),
    getSitePictures(),
    db.product.findMany({
      where: { isActive: true, isFeatured: true },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
      take: 6,
      include: {
        category: true,
        images: {
          orderBy: { sortOrder: 'asc' },
        },
      },
    }),
    getClinicNAP(),
    db.siteSetting.findFirst({
      select: {
        heroTitleFa: true,
        heroTitleEn: true,
        heroSubtitleFa: true,
        heroSubtitleEn: true,
      },
    }),
    db.homepageSection.findMany({
      orderBy: { sortOrder: 'asc' },
    }),
  ]);

  // Fallback to active products if featured is less than 3
  const featuredProducts = featuredProductsDb.length >= 3
    ? featuredProductsDb
    : await db.product.findMany({
        where: { isActive: true },
        orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
        take: 6,
        include: {
          category: true,
          images: {
            orderBy: { sortOrder: 'asc' },
          },
        },
      });

  // Map homepage sections for dynamic admin control
  const sectionMap = new Map(homepageSectionsDb.map((s) => [s.key, s]));

  const secHero = sectionMap.get('hero');
  const secDivisions = sectionMap.get('divisions');
  const secServices = sectionMap.get('services');
  const secShop = sectionMap.get('shop');
  const secStaff = sectionMap.get('staff');
  const secTestimonials = sectionMap.get('testimonials');
  const secFaq = sectionMap.get('faq');
  const secContact = sectionMap.get('contact');

  const heroTitle = (isEn ? (secHero?.titleEn || siteSetting?.heroTitleEn) : (secHero?.titleFa || siteSetting?.heroTitleFa)) || t('clinicTitle');
  const heroSubtitle = (isEn ? (secHero?.subtitleEn || siteSetting?.heroSubtitleEn) : (secHero?.subtitleFa || siteSetting?.heroSubtitleFa)) || t('heroSubtitle');
  const heroBadge = (isEn ? secHero?.badgeEn : secHero?.badgeFa) || (isEn ? 'North Tehran Premier Veterinary Center' : 'پیشرفته‌ترین مرکز درمانی و جراحی حیوانات خانگی در شمال تهران');

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
    <>
      {/* ═══ SEO STRUCTURED DATA (JSON-LD) ═══ */}
      <VeterinaryCareJsonLd nap={nap} locale={locale} />
      <BreadcrumbJsonLd items={[{ name: isEn ? 'Home' : 'خانه', href: '/' }]} locale={locale} />
      {faqs.length > 0 && (
        <FAQPageJsonLd
          faqs={faqs.map((faq) => ({
            question: isEn ? (faq.questionEn || faq.questionFa) : faq.questionFa,
            answer: isEn ? (faq.answerEn || faq.answerFa) : faq.answerFa,
          }))}
        />
      )}

      <div className="bg-background text-foreground transition-colors duration-200">

      {/* ═══ HERO SECTION ═══ */}
      {secHero?.isVisible !== false && (
        <section className="relative overflow-hidden bg-gradient-hero text-foreground py-20 lg:py-28 border-b border-border">
          {/* Subtle ambient light */}
          <div className="absolute inset-0 pointer-events-none overflow-hidden">
            <div className="absolute -top-32 start-1/4 w-96 h-96 bg-primary/10 rounded-full blur-[100px]" />
            <div className="absolute -bottom-32 end-1/4 w-96 h-96 bg-primary/5 rounded-full blur-[100px]" />
          </div>

          <div className="container-site relative z-10">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-8 items-center">
              {/* Text content */}
              <div className="lg:col-span-7 text-center lg:text-start">
                <LuxuryPillBadge variant="outline" className="mb-6">
                  {heroBadge}
                </LuxuryPillBadge>

                <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black tracking-tight leading-[1.15] mb-6">
                  {heroTitle}
                </h1>

                <p className="text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto lg:mx-0 mb-8 leading-relaxed font-normal">
                  {heroSubtitle}
                </p>

                {/* CTAs */}
                <div className="flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-4">
                  <Button asChild size="lg" className="w-full sm:w-auto rounded-full px-8 bg-gradient-gold text-charcoal-950 font-bold shadow-gold hover:opacity-95 text-base">
                    <a href={secHero?.ctaHref || nap.telLink || "#"}>
                      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="me-2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
                      {secHero?.ctaLabelFa && !isEn ? secHero.ctaLabelFa : (secHero?.ctaLabelEn && isEn ? secHero.ctaLabelEn : t('bookAppointment'))}
                    </a>
                  </Button>
                  <Button asChild size="lg" variant="outline" className="w-full sm:w-auto rounded-full px-8 border-border-gold text-foreground hover:bg-surface-elevated text-base">
                    <Link href="/services">
                      {t('exploreServices')}
                    </Link>
                  </Button>
                </div>

                {/* Trust stats */}
                <div className="grid grid-cols-3 gap-4 pt-10 mt-10 border-t border-border/60 max-w-lg mx-auto lg:mx-0">
                  <div>
                    <div className="text-2xl lg:text-3xl font-extrabold text-foreground tracking-tight text-gradient-gold">
                      {isEn ? '+10' : '۱۰+'}
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5">{t('statYears')}</div>
                  </div>
                  <div>
                    <div className="text-2xl lg:text-3xl font-extrabold text-foreground tracking-tight text-gradient-gold">
                      {isEn ? '+15,000' : '۱۵,۰۰۰+'}
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5">{t('statPatients')}</div>
                  </div>
                  <div>
                    <div className="text-2xl lg:text-3xl font-extrabold text-foreground tracking-tight text-gradient-gold">
                      {isEn ? '100%' : '۱۰۰٪'}
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5">{t('statSatisfaction')}</div>
                  </div>
                </div>
              </div>

              {/* Visual - Premium Brand Card */}
              <div className="lg:col-span-5 flex justify-center">
                <div className="relative w-full max-w-md aspect-square rounded-3xl bg-surface-card border border-border-gold p-8 flex flex-col items-center justify-center text-center shadow-gold-lg">
                  <div className="absolute inset-0 rounded-3xl bg-[radial-gradient(#d4af37_1px,transparent_1px)] [background-size:16px_16px] opacity-15" />
                  
                  <div className="relative z-10 flex flex-col items-center">
                    <PetBossLogo size="lg" variant="gold" logoUrl={sitePictures.site_logo} className="mb-6" />
                    
                    <span className="text-sm font-semibold tracking-widest text-primary uppercase mb-2">
                      {isEn ? 'Gheytariyeh, Tehran' : 'قیطریه، تهران'}
                    </span>
                    <p className="text-xs text-muted-foreground max-w-xs leading-relaxed">
                      {isEn ? nap.addressEn : nap.addressFa}
                    </p>

                    <div className="mt-6 pt-6 border-t border-border w-full flex items-center justify-between text-xs text-muted-foreground">
                      <span>{isEn ? 'Daily Hours:' : 'ساعات کاری:'}</span>
                      <span className="font-bold text-foreground">{isEn ? nap.workingHoursSummaryEn : nap.workingHoursSummaryFa}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* ═══ THREE DIVISIONS CARDS ═══ */}
      {secDivisions?.isVisible !== false && (
        <section className="section-padding bg-surface border-b border-border/60">
          <div className="container-site">
            <div className="text-center mb-16">
              <span className="badge-pill-outline mb-3">
                {isEn ? (secDivisions?.eyebrowEn || 'Integrated Care') : (secDivisions?.eyebrowFa || 'خدمات یکپارچه')}
              </span>
              <h2 className="text-3xl sm:text-4xl font-extrabold text-foreground mb-4">
                {isEn ? (secDivisions?.titleEn || t('divisionsTitle')) : (secDivisions?.titleFa || t('divisionsTitle'))}
              </h2>
              <p className="text-muted-foreground max-w-xl mx-auto text-base">
                {isEn ? (secDivisions?.subtitleEn || t('divisionsSubtitle')) : (secDivisions?.subtitleFa || t('divisionsSubtitle'))}
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {divisions.map((div, idx) => {
                const name = isEn ? (div.nameEn || div.nameFa) : div.nameFa;
                const desc = isEn ? (div.descriptionEn || div.descriptionFa) : div.descriptionFa;
                const divisionImages = [
                  sitePictures.division_veterinary,
                  sitePictures.division_grooming,
                  sitePictures.division_petshop,
                ];
                const pictureSrc = divisionImages[idx % divisionImages.length] || '/images/veterinarian.jpg';

                return (
                  <div
                    key={div.id}
                    className="card-luxury rounded-2xl overflow-hidden flex flex-col group border border-border hover:border-primary/60 transition-all duration-300"
                  >
                    <div className="relative aspect-[16/10] w-full overflow-hidden bg-surface-elevated">
                      {pictureSrc ? (
                        <Image
                          src={pictureSrc}
                          alt={name}
                          fill
                          sizes="(max-width: 768px) 100vw, 33vw"
                          className="object-cover group-hover:scale-105 transition-transform duration-500"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-primary/40 bg-surface-elevated">
                          {divisionIcons[idx % divisionIcons.length]}
                        </div>
                      )}
                      <div className="absolute inset-0 bg-gradient-to-t from-background/90 via-background/20 to-transparent" />
                      <div className="absolute bottom-3 start-4 text-primary">
                        {divisionIcons[idx % divisionIcons.length]}
                      </div>
                    </div>

                    <div className="p-6 flex flex-col flex-grow">
                      <h3 className="text-xl font-bold text-foreground mb-2 group-hover:text-primary transition-colors">
                        {name}
                      </h3>
                      <p className="text-sm text-muted-foreground leading-relaxed mb-6 flex-grow">
                        {desc}
                      </p>
                      <Link
                        href={idx === 2 ? "/shop" : "/services"}
                        className="inline-flex items-center gap-1.5 text-xs font-bold text-primary hover:text-primary-hover group-hover:underline"
                      >
                        <span>{idx === 2 ? t('viewShop') : t('learnMoreServices')}</span>
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="rtl:rotate-180"><path d="m9 18 6-6-6-6"/></svg>
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {/* ═══ SIGNATURE LUXURY PET SHOP & BOUTIQUE SHOWCASE ═══ */}
      {secShop?.isVisible !== false && featuredProducts.length > 0 && (
        <section className="section-padding bg-gradient-to-b from-surface via-surface-card to-background border-t border-b border-border-gold/40 relative overflow-hidden">
          <div className="absolute top-1/2 start-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[300px] bg-primary/5 rounded-full blur-[140px] pointer-events-none" />

          <div className="container-site relative z-10">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12">
              <div>
                <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-primary/10 border border-primary/30 text-primary text-xs font-semibold mb-3 shadow-gold">
                  <span>🛍️</span>
                  <span>{isEn ? (secShop?.eyebrowEn || 'Signature Luxury Boutique & Veterinary Shop') : (secShop?.eyebrowFa || 'بوتیک و پت‌شاپ اختصاصی کلینیک پت باس')}</span>
                </div>
                <h2 className="text-3xl sm:text-4xl font-extrabold text-foreground tracking-tight">
                  {isEn ? (
                    secShop?.titleEn ? secShop.titleEn : <>Curated Veterinary Nutrition & <span className="text-gradient-gold">Luxury Essentials</span></>
                  ) : (
                    secShop?.titleFa ? secShop.titleFa : <>ویترین منتخب تغذیه و <span className="text-gradient-gold">ملزومات لوکس پت باس</span></>
                  )}
                </h2>
                <p className="text-muted-foreground text-sm sm:text-base mt-2 max-w-2xl leading-relaxed">
                  {isEn
                    ? (secShop?.subtitleEn || 'Super-premium nutrition, medical prescription diets, and bespoke accessories with direct guidance from clinic veterinary surgeons.')
                    : (secShop?.subtitleFa || 'عرضه رسمی برترین برندهای غذای خشک سوپرپرمیوم، رژیم‌های درمانی، خمیرهای مالت و ملزومات رفاهی با تایید مستقیم کادر دامپزشکی پت باس.')}
                </p>
              </div>

              <div className="shrink-0">
                <Button
                  asChild
                  className="bg-gradient-gold text-charcoal-950 font-bold rounded-full px-7 py-3 text-xs sm:text-sm shadow-gold hover:opacity-95 flex items-center gap-2"
                >
                  <Link href="/shop">
                    <span>🛍️</span>
                    <span>{isEn ? (secShop?.ctaLabelEn || 'Explore Full Pet Shop Catalog') : (secShop?.ctaLabelFa || 'ورود به پت‌شاپ و مشاهده تمام محصولات')}</span>
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="rtl:rotate-180"><path d="m9 18 6-6-6-6"/></svg>
                  </Link>
                </Button>
              </div>
            </div>

            {/* Products Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {featuredProducts.map((p) => {
                const pName = isEn ? (p.nameEn || p.nameFa) : p.nameFa;
                const pImage = p.images?.[0]?.imageId || p.ogImageId;
                const catName = isEn ? (p.category.nameEn || p.category.nameFa) : p.category.nameFa;

                return (
                  <div
                    key={p.id}
                    className="card-luxury rounded-2xl overflow-hidden flex flex-col group border border-border hover:border-primary/60 transition-all duration-300 hover:shadow-gold"
                  >
                    {/* Visual Photo Area */}
                    <div className="relative aspect-[4/3] w-full bg-gradient-to-br from-charcoal-900 to-charcoal-950 overflow-hidden border-b border-border/50 flex items-center justify-center">
                      {pImage ? (
                        <Image
                          src={pImage}
                          alt={pName}
                          fill
                          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                          className="object-cover group-hover:scale-105 transition-transform duration-500"
                        />
                      ) : (
                        <div className="flex flex-col items-center justify-center p-6 text-center">
                          <span className="text-3xl mb-2">🐾</span>
                          <span className="text-xs font-semibold text-primary">{catName}</span>
                        </div>
                      )}
                      <div className="absolute top-3 start-3">
                        <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 backdrop-blur-sm">
                          {isEn ? 'In Stock / Inquire' : 'موجود در کلینیک'}
                        </span>
                      </div>
                    </div>

                    {/* Card Content */}
                    <div className="p-5 flex flex-col flex-grow justify-between">
                      <div>
                        <span className="text-[11px] font-semibold text-primary/90 mb-1.5 block">
                          {catName}
                        </span>
                        <h3 className="text-sm font-bold text-foreground leading-snug mb-2 group-hover:text-primary transition-colors line-clamp-2">
                          {pName}
                        </h3>
                        {p.shortDescFa && (
                          <p className="text-xs text-muted-foreground line-clamp-2 mb-4 leading-relaxed">
                            {isEn ? (p.shortDescEn || p.shortDescFa) : p.shortDescFa}
                          </p>
                        )}
                      </div>

                      <div className="pt-3 border-t border-border/60 mt-auto flex flex-col gap-3">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] text-muted-foreground">
                            {isEn ? 'Price:' : 'قیمت:'}
                          </span>
                          <span className="text-sm font-extrabold text-foreground tracking-tight text-gradient-gold">
                            {formatPrice(p.price, isEn ? 'en' : 'fa')}
                          </span>
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                          <Button asChild size="sm" variant="outline" className="text-xs rounded-xl border-border hover:border-primary">
                            <Link href="/shop">{isEn ? 'View in Shop' : 'مشاهده جزئیات'}</Link>
                          </Button>
                          <Button asChild size="sm" className="bg-gradient-gold text-charcoal-950 font-bold text-xs rounded-xl shadow-gold hover:opacity-95">
                            <a href={nap.telLink || "#"}>{isEn ? 'Call Clinic' : 'تماس و سفارش'}</a>
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Bottom Luxury Assurance Strip */}
            <div className="mt-12 p-6 rounded-2xl bg-surface-card border border-border-gold/40 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs">
              <div className="flex items-center gap-3">
                <span className="text-2xl">✨</span>
                <div>
                  <h4 className="font-bold text-foreground">
                    {isEn ? 'In-Person Visit in Gheytariyeh or Express Courier Dispatch' : 'خرید حضوری در کلینیک قیطریه یا ارسال فوری با پیک در تهران'}
                  </h4>
                  <p className="text-muted-foreground">
                    {isEn ? `Phone consultation and orders: ${nap.phoneDisplayEn} (${nap.workingHoursSummaryEn})` : `مشاوره تلفنی و ثبت سفارش: ${nap.phoneDisplayFa} (${nap.workingHoursSummaryFa})`}
                  </p>
                </div>
              </div>
              <Button asChild variant="outline" className="border-border-gold text-foreground hover:bg-surface rounded-full px-6">
                <Link href="/shop">{isEn ? 'Open Boutique Catalog' : 'کاتالوگ آنلاین پت‌شاپ'}</Link>
              </Button>
            </div>
          </div>
        </section>
      )}

      {/* ═══ SERVICES CATALOG PREVIEW ═══ */}
      {secServices?.isVisible !== false && (
        <section className="section-padding bg-background">
          <div className="container-site">
            <div className="text-center mb-16">
              <span className="badge-pill-outline mb-3">
                {isEn ? (secServices?.eyebrowEn || t('servicesBadge')) : (secServices?.eyebrowFa || t('servicesBadge'))}
              </span>
              <h2 className="text-3xl sm:text-4xl font-extrabold text-foreground mb-4">
                {isEn ? (secServices?.titleEn || t('servicesTitle')) : (secServices?.titleFa || t('servicesTitle'))}
              </h2>
              <p className="text-muted-foreground max-w-xl mx-auto text-base">
                {isEn ? (secServices?.subtitleEn || t('servicesSubtitle')) : (secServices?.subtitleFa || t('servicesSubtitle'))}
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {services.map((service) => {
                const sName = isEn ? (service.nameEn || service.nameFa) : service.nameFa;
                const sDesc = isEn ? (service.descriptionEn || service.descriptionFa) : service.descriptionFa;
                const sDiv = isEn ? (service.division.nameEn || service.division.nameFa) : service.division.nameFa;
                const sPriceNote = isEn ? (service.priceNoteEn || service.priceNoteFa) : service.priceNoteFa;

                return (
                  <Card key={service.id} className="card-luxury flex flex-col justify-between group hover:border-primary/60 transition-colors">
                    <CardHeader>
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-xs font-semibold text-primary/80 bg-primary/10 px-2.5 py-1 rounded-full border border-primary/20">
                          {sDiv}
                        </span>
                        {service.durationFa && (
                          <span className="text-xs text-muted-foreground">
                            ⏱ {isEn ? (service.durationEn || service.durationFa) : service.durationFa}
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
                          <div className="text-sm font-bold text-primary">
                            {formatServicePrice(
                              service.priceDisplayMode,
                              service.priceFrom,
                              service.priceTo,
                              isEn ? 'en' : 'fa'
                            )}
                          </div>
                          {sPriceNote && (
                            <p className="text-[11px] text-muted-foreground mt-0.5">{sPriceNote}</p>
                          )}
                        </div>
                        <Button asChild size="sm" variant="ghost" className="text-primary hover:text-primary hover:bg-primary/10 text-xs">
                          <a href={nap.telLink || "#"}>{t('bookNow')}</a>
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
      )}

      {/* ═══ VETERINARY TEAM ═══ */}
      {secStaff?.isVisible !== false && staff.length > 0 && (
        <section className="section-padding bg-surface border-y border-border/60">
          <div className="container-site">
            <div className="text-center mb-16">
              <span className="badge-pill-outline mb-3">
                {isEn ? (secStaff?.eyebrowEn || t('teamBadge')) : (secStaff?.eyebrowFa || t('teamBadge'))}
              </span>
              <h2 className="text-3xl sm:text-4xl font-extrabold text-foreground mb-4">
                {isEn ? (secStaff?.titleEn || t('teamTitle')) : (secStaff?.titleFa || t('teamTitle'))}
              </h2>
              <p className="text-muted-foreground max-w-xl mx-auto text-base">
                {isEn ? (secStaff?.subtitleEn || t('teamSubtitle')) : (secStaff?.subtitleFa || t('teamSubtitle'))}
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 justify-center">
              {staff.map((vet) => {
                const vName = isEn ? (vet.nameEn || vet.nameFa) : vet.nameFa;
                const vTitle = isEn ? (vet.titleEn || vet.titleFa) : vet.titleFa;
                const vSpecialty = isEn ? (vet.specialtyEn || vet.specialtyFa) : vet.specialtyFa;

                return (
                  <div key={vet.id} className="card-luxury p-6 text-center flex flex-col items-center">
                    <div className="w-24 h-24 rounded-full bg-surface-elevated border-2 border-border-gold flex items-center justify-center text-primary mb-5 shadow-gold overflow-hidden relative">
                      {vet.photoId ? (
                        <Image
                          src={vet.photoId}
                          alt={vName}
                          fill
                          sizes="96px"
                          className="object-cover"
                        />
                      ) : (
                        <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                      )}
                    </div>
                    <h3 className="text-lg font-bold text-foreground mb-1">{vName}</h3>
                    <p className="text-xs font-semibold text-primary mb-2">{vTitle}</p>
                    {vSpecialty && (
                      <p className="text-xs text-muted-foreground mb-3">{vSpecialty}</p>
                    )}
                    {vet.licenseNo && (
                      <span className="text-[10px] text-muted-foreground bg-surface-elevated px-2.5 py-1 rounded-full border border-border">
                        {t('medicalLicense')}: {isEn ? vet.licenseNo : toPersianDigits(vet.licenseNo)}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {/* ═══ TESTIMONIALS ═══ */}
      {secTestimonials?.isVisible !== false && testimonials.length > 0 && (
        <section className="section-padding bg-background">
          <div className="container-site">
            <div className="text-center mb-16">
              <span className="badge-pill-outline mb-3">
                {isEn ? (secTestimonials?.eyebrowEn || 'Client Satisfaction') : (secTestimonials?.eyebrowFa || 'رضایت مراجعین')}
              </span>
              <h2 className="text-3xl sm:text-4xl font-extrabold text-foreground mb-4">
                {isEn ? (secTestimonials?.titleEn || t('testimonialsTitle')) : (secTestimonials?.titleFa || t('testimonialsTitle'))}
              </h2>
              <p className="text-muted-foreground max-w-xl mx-auto text-base">
                {isEn ? (secTestimonials?.subtitleEn || t('testimonialsSubtitle')) : (secTestimonials?.subtitleFa || t('testimonialsSubtitle'))}
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {testimonials.map((item) => {
                const tName = isEn ? (item.nameEn || item.nameFa) : item.nameFa;
                const tContent = isEn ? (item.contentEn || item.contentFa) : item.contentFa;
                return (
                  <Card key={item.id} className="card-luxury p-6 flex flex-col justify-between">
                    <div>
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
      )}

      {/* ═══ FAQS ACCORDION ═══ */}
      {secFaq?.isVisible !== false && faqs.length > 0 && (
        <section className="section-padding bg-surface border-t border-border/60">
          <div className="container-site max-w-4xl">
            <div className="text-center mb-14">
              <span className="badge-pill-outline mb-3">
                {isEn ? (secFaq?.eyebrowEn || 'Answers to Your Questions') : (secFaq?.eyebrowFa || 'پاسخ به سوالات شما')}
              </span>
              <h2 className="text-3xl sm:text-4xl font-extrabold text-foreground mb-4">
                {isEn ? (secFaq?.titleEn || t('faqTitle')) : (secFaq?.titleFa || t('faqTitle'))}
              </h2>
              <p className="text-muted-foreground text-base">
                {isEn ? (secFaq?.subtitleEn || t('faqSubtitle')) : (secFaq?.subtitleFa || t('faqSubtitle'))}
              </p>
            </div>

            <div className="space-y-4">
              {faqs.map((faq) => {
                const qText = isEn ? (faq.questionEn || faq.questionFa) : faq.questionFa;
                let aText = isEn ? (faq.answerEn || faq.answerFa) : faq.answerFa;
                // If question or answer mentions working hours, dynamically verify against WorkingHour truth
                if (qText.includes('ساعت') || qText.toLowerCase().includes('hour')) {
                  aText = isEn
                    ? `Pet Boss Clinic & Pet Shop is open ${nap.workingHoursSummaryEn}. Emergency and admission services are continuously available throughout working hours.`
                    : `کلینیک و پت‌شاپ پت‌باس ${nap.workingHoursSummaryFa} آماده خدمت‌رسانی است. بخش اورژانس و پذیرش در طول ساعات کاری بدون تعطیلی فعال می‌باشد.`;
                }
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
      )}

      {/* ═══ CLINIC LOCATION & MAP ═══ */}
      {secContact?.isVisible !== false && (
        <section className="section-padding bg-background border-t border-border/60">
          <div className="container-site">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 items-center">
              <div>
                <span className="badge-pill-outline mb-3">
                  {isEn ? (secContact?.eyebrowEn || 'Easy Access') : (secContact?.eyebrowFa || 'دسترسی آسان')}
                </span>
                <h2 className="text-3xl sm:text-4xl font-extrabold text-foreground mb-4">
                  {isEn ? (secContact?.titleEn || t('locationTitle')) : (secContact?.titleFa || t('locationTitle'))}
                </h2>
                <p className="text-muted-foreground text-base mb-8 leading-relaxed">
                  {isEn ? (secContact?.subtitleEn || t('locationSubtitle')) : (secContact?.subtitleFa || t('locationSubtitle'))}
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
                        {isEn ? nap.addressEn : nap.addressFa}
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
                        {isEn ? nap.workingHoursSummaryEn : nap.workingHoursSummaryFa}
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
      )}

      {/* ═══ STICKY MOBILE EMERGENCY CALL BAR ═══ */}
      <div className="fixed bottom-0 inset-x-0 z-40 sm:hidden bg-surface-card/95 backdrop-blur border-t border-border-gold p-3 flex gap-3 shadow-2xl">
        <a
          href={nap.telLink}
          className="flex-1 bg-gradient-gold text-charcoal-950 font-bold text-center py-3 rounded-full text-sm flex items-center justify-center gap-2 shadow-gold"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
          {isEn ? `Emergency Call (${nap.phoneDisplayEn})` : `تماس فوری و اورژانس (${nap.phoneDisplayFa})`}
        </a>
      </div>

    </div>
    </>
  );
}
