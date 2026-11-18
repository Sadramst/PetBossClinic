import { Metadata } from 'next';
import { db } from "@/lib/db";
import Image from "next/image";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from '@/i18n/routing';
import { getSitePictures } from "@/lib/media";
import { ServiceJsonLd } from '@/lib/seo/json-ld';
import { pageMetadata } from '@/lib/seo/metadata';
import { servicePath } from '@/lib/clinic/service-urls';
import { formatServicePrice } from "@/lib/format/price";
import { getClinicNAP } from "@/lib/clinic/nap";
import { PageHero } from '@/components/content/page-hero';
import { CtaBand } from '@/components/content/cta-band';
import { BagIcon, ChatIcon, ChevronIcon, ClockIcon, PhoneIcon } from '@/components/content/icons';

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
    title: 'خدمات دامپزشکی پت‌باس | واکسیناسیون، جراحی و گرومینگ',
    description:
      'واکسیناسیون، جراحی، ارتوپدی، دندانپزشکی و گرومینگ سگ و گربه زیر نظر دامپزشکان پت‌باس در قیطریه تهران؛ همراه با تعرفه‌ها و نوبت‌دهی.',
    path: '/services',
    image: '/images/veterinarian.jpg',
    keywords: ['واکسیناسیون سگ و گربه', 'جراحی دامپزشکی تهران', 'گرومینگ قیطریه', 'تعرفه دامپزشکی'],
  });
}

export default async function ServicesPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('Services');

  const [divisions, sitePictures, nap] = await Promise.all([
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
    getClinicNAP(),
  ]);

  // Build service items for JSON-LD
  const allServices = divisions.flatMap((div) =>
    div.services.map((svc) => ({
      name: svc.nameFa,
      description: svc.descriptionFa || '',
      priceFrom: svc.priceFrom,
      priceTo: svc.priceTo,
    }))
  );

  const anchorOf = (division: { id: string; slugEn: string | null }) => `division-${division.slugEn || division.id}`;

  return (
    <>
      <ServiceJsonLd services={allServices} providerName="کلینیک دامپزشکی پت باس" locale={locale} />
      <div className="bg-background">
        <PageHero
          crumbs={[
            { name: 'خانه', href: '/' },
            { name: 'خدمات', href: '/services' },
          ]}
          badge={t('badge')}
          title={t('title')}
          subtitle={t('subtitle')}
        >
          <a href={nap.telLink} className="btn btn-gold">
            <PhoneIcon className="h-4 w-4" />
            تماس و رزرو نوبت
          </a>
          {nap.whatsappLink && (
            <a href={nap.whatsappLink} target="_blank" rel="noopener noreferrer" className="btn btn-outline">
              <ChatIcon className="h-4 w-4" />
              واتس‌اپ
            </a>
          )}
        </PageHero>

        <div className="container-site section">
          {divisions.length > 1 && (
            <nav aria-label="بخش‌های کلینیک" className="rail rail-bleed mb-6 gap-2 sm:mb-8">
              {divisions.map((division) => (
                <a key={division.id} href={`#${anchorOf(division)}`} className="chip min-h-11 px-4">
                  {division.nameFa}
                  <span className="text-xs font-normal text-muted-foreground">
                    {division.services.length.toLocaleString('fa-IR')}
                  </span>
                </a>
              ))}
            </nav>
          )}

          {divisions.length === 0 && (
            <p className="rounded-2xl border border-border bg-surface-card p-8 text-center text-sm leading-8 text-muted-foreground">
              فهرست خدمات در حال به‌روزرسانی است. برای اطلاع از خدمات و تعرفه‌ها با کلینیک تماس بگیرید.
            </p>
          )}

          <div className="space-y-8 sm:space-y-12">
            {divisions.map((division, idx) => {
              const divImage = division.slugEn === 'clinical'
                ? sitePictures.division_veterinary
                : division.slugEn === 'grooming'
                ? sitePictures.division_grooming
                : sitePictures.division_petshop;
              const isShop = division.slugEn !== 'clinical' && division.slugEn !== 'grooming';

              return (
                <section
                  key={division.id}
                  id={anchorOf(division)}
                  className="scroll-mt-header rounded-2xl border border-border/60 bg-surface p-4 sm:p-8"
                >
                  <div className="mb-5 flex flex-col gap-4 border-b border-border/60 pb-5 sm:mb-8 sm:pb-6 md:flex-row md:items-center md:justify-between md:gap-6">
                    <div className="max-w-2xl">
                      <div className="mb-2 flex items-center gap-3">
                        <span aria-hidden className="h-7 w-1.5 rounded-full bg-gradient-gold" />
                        <h2 className="text-xl font-black text-foreground sm:text-2xl">{division.nameFa}</h2>
                      </div>
                      {division.descriptionFa && (
                        <p className="text-sm leading-8 text-muted-foreground">{division.descriptionFa}</p>
                      )}
                      {isShop && (
                        <Link href="/shop" className="mt-2 inline-flex min-h-11 items-center gap-1.5 text-sm font-bold text-primary hover:underline">
                          <BagIcon className="h-4 w-4" />
                          خرید آنلاین از پت‌شاپ
                          <ChevronIcon className="h-4 w-4" />
                        </Link>
                      )}
                    </div>
                    <div className="relative h-36 w-full shrink-0 overflow-hidden rounded-xl border border-border-gold/40 md:h-32 md:w-56">
                      <Image
                        src={divImage}
                        alt={`${division.nameFa} کلینیک پت‌باس`}
                        fill
                        priority={idx === 0}
                        sizes="(max-width: 768px) 100vw, 224px"
                        className="object-cover"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-4 sm:gap-5 md:grid-cols-2 lg:grid-cols-3">
                    {division.services.map((service) => {
                      const onRequest =
                        service.priceDisplayMode === 'ON_REQUEST' || !service.priceFrom || service.priceFrom <= 0;

                      return (
                        <article key={service.id} className="card-luxury group relative flex flex-col p-4 sm:p-5">
                          {service.durationFa && (
                            <span className="mb-2 inline-flex items-center gap-1 self-start rounded-md bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                              <ClockIcon className="h-3 w-3" />
                              {service.durationFa}
                            </span>
                          )}
                          <h3 className="text-base font-bold leading-8 text-foreground sm:text-lg">
                            <Link
                              href={servicePath(service.slugFa)}
                              className="transition-colors after:absolute after:inset-0 after:rounded-[inherit] group-hover:text-primary"
                            >
                              {service.nameFa}
                              <ChevronIcon className="ms-1 inline-block h-4 w-4 text-primary" />
                            </Link>
                          </h3>
                          {service.descriptionFa && (
                            <p className="mt-1 line-clamp-3 text-sm leading-7 text-muted-foreground">{service.descriptionFa}</p>
                          )}
                          <div className="mt-auto flex items-center justify-between gap-3 pt-4">
                            <div className="min-w-0">
                              {onRequest ? (
                                <p className="text-xs text-muted-foreground">قیمت: تماس بگیرید</p>
                              ) : (
                                <p className="text-sm font-bold text-primary">
                                  {formatServicePrice(service.priceDisplayMode, service.priceFrom, service.priceTo, 'fa')}
                                </p>
                              )}
                              {service.priceNoteFa && (
                                <p className="mt-0.5 text-xs text-muted-foreground">{service.priceNoteFa}</p>
                              )}
                            </div>
                            <a
                              href={nap.telLink}
                              aria-label={`رزرو تلفنی ${service.nameFa}`}
                              className="btn btn-outline btn-sm relative z-10 min-h-11 shrink-0"
                            >
                              <PhoneIcon className="h-4 w-4" />
                              رزرو تلفنی
                            </a>
                          </div>
                        </article>
                      );
                    })}
                  </div>
                </section>
              );
            })}
          </div>

          <CtaBand
            className="mt-8 sm:mt-12"
            title="برای انتخاب خدمت مناسب راهنمایی می‌خواهید؟"
            text={`با پذیرش کلینیک تماس بگیرید تا با توجه به سن، نژاد و وضعیت حیوان شما راهنمایی شوید. ${nap.workingHoursSummaryFa}.`}
            nap={nap}
          >
            <Link href="/shop" className="btn btn-secondary">
              <BagIcon className="h-4 w-4" />
              پت‌شاپ آنلاین
            </Link>
          </CtaBand>
        </div>
      </div>
    </>
  );
}
