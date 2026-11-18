import { Metadata } from 'next';
import { db } from "@/lib/db";
import Image from "next/image";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from '@/i18n/routing';
import { getSitePictures } from "@/lib/media";
import { JsonLdScript } from "@/lib/seo/json-ld";
import { pageMetadata } from "@/lib/seo/metadata";
import { absoluteUrl } from "@/lib/seo/site";
import { getClinicNAP } from "@/lib/clinic/nap";
import { PageHero } from '@/components/content/page-hero';
import { CtaBand } from '@/components/content/cta-band';
import { BagIcon } from '@/components/content/icons';

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

  return pageMetadata({
    title: 'درباره کلینیک دامپزشکی پت‌باس | تیم و شعبه قیطریه',
    description:
      'با تیم دامپزشکان و کارکنان کلینیک پت‌باس در قیطریه تهران آشنا شوید؛ تجهیزات، بخش‌های تخصصی و استانداردهای درمانی و مراقبت از حیوانات خانگی.',
    path: '/about',
    image: '/images/reception.jpg',
    keywords: ['درباره پت‌باس', 'تیم دامپزشکی پت‌باس', 'کلینیک دامپزشکی قیطریه'],
  });
}

const SECTIONS = [
  { href: '/services', title: 'خدمات کلینیک', text: 'واکسیناسیون، جراحی، دندانپزشکی و گرومینگ با تعرفه هر خدمت.' },
  { href: '/shop', title: 'پت‌شاپ آنلاین', text: 'غذا، مکمل و لوازم سگ و گربه با نمایش تاریخ انقضا.' },
  { href: '/blog', title: 'مجله پت‌باس', text: 'راهنمای تغذیه، سلامت و نگهداری حیوانات خانگی.' },
];

export default async function AboutPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('About');

  const [staff, sitePictures, nap] = await Promise.all([
    db.staffMember.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' },
    }),
    getSitePictures(),
    getClinicNAP(),
  ]);

  return (
    <>
      <JsonLdScript
        data={{
          '@context': 'https://schema.org',
          '@type': 'AboutPage',
          name: 'درباره کلینیک دامپزشکی پت‌باس',
          url: absoluteUrl('/about'),
          inLanguage: 'fa-IR',
          isPartOf: { '@id': absoluteUrl('/#website') },
          about: { '@id': absoluteUrl('/#organization') },
        }}
      />
      <div className="bg-background">
        <PageHero
          crumbs={[
            { name: 'خانه', href: '/' },
            { name: 'درباره ما', href: '/about' },
          ]}
          badge={t('badge')}
          title={t('title')}
          subtitle={t('subtitle')}
        />

        <div className="container-site section">
          {/* Story + Mission */}
          <div className="mb-10 grid grid-cols-1 gap-4 sm:mb-16 sm:gap-6 md:grid-cols-2">
            <section className="card-luxury p-5 sm:p-8">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl border border-primary/20 bg-primary/10 text-primary">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/></svg>
              </div>
              <h2 className="mb-2 text-xl font-black text-foreground sm:text-2xl">{t('ourStory')}</h2>
              <p className="text-sm leading-8 text-muted-foreground sm:text-[15px]">{t('storyText')}</p>
            </section>
            <section className="card-luxury p-5 sm:p-8">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl border border-primary/20 bg-primary/10 text-primary">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>
              </div>
              <h2 className="mb-2 text-xl font-black text-foreground sm:text-2xl">{t('ourMission')}</h2>
              <p className="text-sm leading-8 text-muted-foreground sm:text-[15px]">{t('missionText')}</p>
            </section>
          </div>

          {/* Facility photos */}
          <div className="mb-10 grid grid-cols-1 gap-4 sm:mb-16 sm:gap-6 md:grid-cols-2">
            <figure className="overflow-hidden rounded-2xl border border-border-gold/50">
              <div className="relative aspect-[16/10] w-full bg-charcoal-900">
                <Image
                  src={sitePictures.about_clinic}
                  alt="سالن پذیرش کلینیک پت‌باس"
                  fill
                  sizes="(max-width: 768px) 100vw, 50vw"
                  className="object-cover"
                />
              </div>
              <figcaption className="border-t border-border bg-surface p-4 text-sm font-semibold text-foreground">
                سالن اختصاصی پذیرش و امکانات تشخیصی
              </figcaption>
            </figure>
            <figure className="overflow-hidden rounded-2xl border border-border-gold/50">
              <div className="relative aspect-[16/10] w-full bg-charcoal-900">
                <Image
                  src={sitePictures.about_veterinarian}
                  alt="معاینه و درمان در کلینیک پت‌باس"
                  fill
                  sizes="(max-width: 768px) 100vw, 50vw"
                  className="object-cover"
                />
              </div>
              <figcaption className="border-t border-border bg-surface p-4 text-sm font-semibold text-foreground">
                معاینات بالینی، درمان و جراحی‌های تخصصی
              </figcaption>
            </figure>
          </div>

          {/* Team */}
          {staff.length > 0 && (
            <section className="mb-10 sm:mb-16" aria-labelledby="team-title">
              <div className="mb-6 sm:mb-8">
                <p className="mb-1 text-xs font-bold text-primary sm:text-sm">{t('teamBadge')}</p>
                <h2 id="team-title" className="text-xl font-black text-foreground sm:text-2xl">{t('teamTitle')}</h2>
                <p className="mt-1.5 text-sm leading-7 text-muted-foreground">{t('teamSubtitle')}</p>
              </div>
              <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
                {staff.map((member) => (
                  <div key={member.id} className="card-luxury p-4 text-center sm:p-6">
                    <div className="relative mx-auto mb-3 flex h-20 w-20 items-center justify-center overflow-hidden rounded-full border-2 border-border-gold bg-surface-elevated text-2xl font-bold text-primary">
                      {member.photoId ? (
                        <Image src={member.photoId} alt={member.nameFa} fill sizes="80px" className="object-cover" />
                      ) : (
                        <span aria-hidden>{member.nameFa.trim().charAt(0)}</span>
                      )}
                    </div>
                    <h3 className="text-sm font-bold leading-7 text-foreground sm:text-base">{member.nameFa}</h3>
                    {member.titleFa && <p className="mt-0.5 text-xs font-semibold leading-6 text-primary">{member.titleFa}</p>}
                    {member.bioFa && (
                      <p className="mt-2 text-xs leading-6 text-muted-foreground">{member.bioFa}</p>
                    )}
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Cross-links */}
          <div className="mb-10 grid grid-cols-1 gap-3 sm:mb-16 sm:grid-cols-3 sm:gap-4">
            {SECTIONS.map((s) => (
              <Link
                key={s.href}
                href={s.href}
                className="surface-card hover-lift block p-5"
              >
                <h3 className="text-base font-bold text-foreground">{s.title}</h3>
                <p className="mt-1 text-sm leading-7 text-muted-foreground">{s.text}</p>
              </Link>
            ))}
          </div>

          <CtaBand
            title="برای معاینه یا مشاوره نوبت بگیرید"
            text={`${nap.addressFa}. ${nap.workingHoursSummaryFa}.`}
            nap={nap}
          >
            <Link href="/services" className="btn btn-secondary">مشاهده خدمات</Link>
            <Link href="/shop" className="btn btn-secondary">
              <BagIcon className="h-4 w-4" />
              پت‌شاپ
            </Link>
          </CtaBand>
        </div>
      </div>
    </>
  );
}
