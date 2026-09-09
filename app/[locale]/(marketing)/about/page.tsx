import { Metadata } from 'next';
import { db } from "@/lib/db";
import Image from "next/image";
import { getTranslations } from "next-intl/server";
import { LuxuryPillBadge } from "@/components/ui/luxury-pill-badge";
import { getSitePictures } from "@/lib/media";
import { BreadcrumbJsonLd } from "@/lib/seo/json-ld";

export const revalidate = 60;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const isEn = locale === 'en';

  const title = isEn
    ? 'About Pet Boss Clinic'
    : 'درباره کلینیک پت باس | بهترین مرکز دامپزشکی شمال تهران قیطریه';

  const description = isEn
    ? 'Meet the Pet Boss Clinic team — expert veterinarians providing premium pet healthcare, grooming & products in Gheitariyeh, North Tehran since day one.'
    : 'با تیم متخصص کلینیک دامپزشکی پت باس آشنا شوید. ارائه خدمات تخصصی دامپزشکی، گرومینگ و محصولات باکیفیت در قیطریه شمال تهران.';

  return {
    title,
    description,
    alternates: {
      canonical: isEn ? '/en/about' : '/about',
      languages: { 'fa-IR': '/about', en: '/en/about' },
    },
    openGraph: {
      title,
      description,
      url: isEn ? '/en/about' : '/about',
      images: [{ url: '/images/reception.jpg', width: 1200, height: 630 }],
    },
  };
}


export default async function AboutPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const isEn = locale === 'en';
  const t = await getTranslations('About');

  const [staff, sitePictures] = await Promise.all([
    db.staffMember.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' },
    }),
    getSitePictures(),
  ]);

  return (
    <>
      <BreadcrumbJsonLd
        items={[
          { name: isEn ? 'Home' : 'خانه', href: '/' },
          { name: isEn ? 'About Us' : 'درباره ما', href: '/about' },
        ]}
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
            <div className="aspect-[16/10] w-full bg-charcoal-900 overflow-hidden relative">
              <Image
                src={sitePictures.about_clinic}
                alt="Pet Boss Lounge"
                fill
                sizes="(max-width: 768px) 100vw, 50vw"
                className="object-cover group-hover:scale-105 transition-transform duration-500"
              />
            </div>
            <div className="p-4 bg-surface border-t border-border">
              <p className="text-xs font-semibold text-foreground">
                {isEn ? 'Signature Welcome Lounge & Diagnostics' : 'سالن اختصاصی پذیرش و امکانات تشخیصی'}
              </p>
            </div>
          </div>
          <div className="rounded-3xl overflow-hidden border border-border-gold/50 shadow-gold relative group">
            <div className="aspect-[16/10] w-full bg-charcoal-900 overflow-hidden relative">
              <Image
                src={sitePictures.about_veterinarian}
                alt="Pet Boss Care"
                fill
                sizes="(max-width: 768px) 100vw, 50vw"
                className="object-cover group-hover:scale-105 transition-transform duration-500"
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
        {staff.length > 0 && (
          <>
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
          </>
        )}
      </div>
    </div>
    </>
  );
}
