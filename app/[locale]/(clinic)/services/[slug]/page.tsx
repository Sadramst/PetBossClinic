import type { Metadata } from 'next';
import Image from 'next/image';
import { notFound } from 'next/navigation';
import { setRequestLocale } from 'next-intl/server';
import { Link } from '@/i18n/routing';
import { Breadcrumbs } from '@/components/shop/breadcrumbs';
import { getClinicNAP, type ClinicNAP } from '@/lib/clinic/nap';
import { getRelatedServices, getServiceBySlug } from '@/lib/clinic/services';
import { servicePath } from '@/lib/clinic/service-urls';
import { getSitePictures, type SitePictures } from '@/lib/media';
import { FAQPageJsonLd, JsonLdScript } from '@/lib/seo/json-ld';
import { pageMetadata } from '@/lib/seo/metadata';
import { absoluteUrl } from '@/lib/seo/site';
import { formatServicePrice } from '@/lib/format/price';
import { decodeSlug } from '@/lib/shop/urls';

export const revalidate = 300;

export function generateStaticParams() {
  // Rendered on first request then cached; keeps builds independent of the DB.
  return [];
}

type Params = Promise<{ locale: string; slug: string }>;
type Service = NonNullable<Awaited<ReturnType<typeof getServiceBySlug>>>;

const DIVISION_COPY: Record<
  string,
  { benefits: string[]; before: string[]; image: keyof SitePictures }
> = {
  'بخش-درمانی': {
    image: 'division_veterinary',
    benefits: [
      'معاینه بالینی و بررسی کامل وضعیت سلامت',
      'بررسی سابقه درمان، واکسیناسیون و داروهای مصرفی',
      'توضیح مراحل درمان و مراقبت‌های بعد از مراجعه',
      'پیگیری وضعیت حیوان توسط تیم درمان',
    ],
    before: [
      'کارت واکسیناسیون و سابقه درمان را همراه بیاورید.',
      'فهرست داروهای فعلی حیوان را بنویسید.',
      'حیوان را در قفس حمل مناسب و با قلاده یا بند بیاورید.',
    ],
  },
  'گرومینگ': {
    image: 'division_grooming',
    benefits: [
      'بررسی پوست و مو پیش از شروع کار',
      'استفاده از شامپو و محصولات مناسب نوع پوست',
      'خشک‌کردن کامل و برس‌کشی حرفه‌ای',
      'بررسی گوش، ناخن و بهداشت عمومی',
    ],
    before: [
      'اگر گره مو یا مشکل پوستی وجود دارد، پیش از مراجعه اطلاع دهید.',
      'آخرین زمان شامپو و وضعیت واکسیناسیون را بگویید.',
      'برای حیوانات مضطرب، زمان آرام‌تری هماهنگ می‌کنیم.',
    ],
  },
  'پت-شاپ': {
    image: 'division_petshop',
    benefits: [
      'مشاوره انتخاب محصول متناسب با سن و نژاد',
      'بررسی تاریخ انقضا و اصالت کالا',
      'راهنمای مصرف و نگهداری محصول',
      'پشتیبانی تلفنی پس از خرید',
    ],
    before: [
      'سن، نژاد و وزن حیوان را بگویید تا انتخاب دقیق‌تر باشد.',
      'اگر حیوان رژیم درمانی دارد، نام غذا یا دارو را همراه داشته باشید.',
      'برای خرید عمده یا محصول خاص، پیش از مراجعه تماس بگیرید.',
    ],
  },
};

const DEFAULT_COPY = DIVISION_COPY['بخش-درمانی'];
const TRUST = [
  { title: 'زیر نظر دامپزشک', text: 'انتخاب روش و مواد مصرفی با نظر دامپزشک انجام می‌شود.' },
  { title: 'تجهیزات استاندارد', text: 'از تجهیزات و مواد مصرفی معتبر و بهداشتی استفاده می‌کنیم.' },
  { title: 'پیگیری بعد از خدمت', text: 'در صورت نیاز، وضعیت حیوان را پس از مراجعه پیگیری می‌کنیم.' },
];

function copyFor(service: Service) {
  return DIVISION_COPY[service.division.slugFa] ?? DEFAULT_COPY;
}

function divisionImage(pictures: SitePictures, service: Service): string {
  return pictures[copyFor(service).image] || '/images/veterinarian.jpg';
}

function benefitsFor(service: Service): string[] {
  if (service.benefitsFa) {
    const list = service.benefitsFa
      .split(/\n|•|؛/)
      .map((s) => s.trim())
      .filter((s) => s.length > 3);
    if (list.length) return list;
  }
  return copyFor(service).benefits;
}

function priceLabel(service: Service): string {
  return formatServicePrice(service.priceDisplayMode, service.priceFrom, service.priceTo, 'fa');
}

function serviceFaqs(service: Service, nap: ClinicNAP): Array<{ question: string; answer: string }> {
  if (service.faqs.length > 0) {
    return service.faqs.map((f) => ({ question: f.questionFa, answer: f.answerFa }));
  }

  const priceAnswer =
    service.priceDisplayMode === 'ON_REQUEST'
      ? 'هزینه این خدمت بر اساس وضعیت حیوان و اقدامات لازم تعیین می‌شود؛ برای اعلام دقیق هزینه با کلینیک تماس بگیرید.'
      : `هزینه این خدمت ${priceLabel(service)} است و هزینه نهایی پس از معاینه به شما اعلام می‌شود.`;

  return [
    { question: `هزینه ${service.nameFa} چقدر است؟`, answer: priceAnswer },
    {
      question: `${service.nameFa} چقدر طول می‌کشد؟`,
      answer: service.durationFa
        ? `مدت تقریبی این خدمت ${service.durationFa} است؛ زمان دقیق بسته به وضعیت حیوان مشخص می‌شود.`
        : 'مدت زمان بسته به وضعیت حیوان و اقدامات لازم متفاوت است؛ پیش از مراجعه با کلینیک هماهنگ کنید.',
    },
    {
      question: `برای ${service.nameFa} چگونه نوبت بگیرم؟`,
      answer: `با شماره ${nap.phoneDisplayFa} تماس بگیرید یا در واتس‌اپ پیام دهید. ${nap.workingHoursSummaryFa}.`,
    },
  ];
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  const service = await getServiceBySlug(decodeSlug(slug));
  if (!service) return { title: 'خدمت یافت نشد', robots: { index: false, follow: false } };

  const pictures = await getSitePictures();
  const image = service.ogImageId && !service.ogImageId.startsWith('data:') ? service.ogImageId : divisionImage(pictures, service);
  const price = service.priceDisplayMode === 'ON_REQUEST' ? 'اعلام هزینه پس از معاینه' : priceLabel(service);
  const description = service.metaDescriptionFa || `${service.descriptionFa ?? ''} ${price}؛ انجام توسط دامپزشکان پت‌باس در قیطریه تهران.`.trim();

  return pageMetadata({
    title: service.metaTitleFa || `${service.nameFa} | خدمات دامپزشکی پت‌باس`,
    description,
    path: servicePath(service.slugFa),
    canonical: service.canonicalUrl,
    image,
    imageAlt: service.nameFa,
    noindex: service.noindex,
    keywords: [
      service.nameFa,
      service.division.nameFa,
      'دامپزشکی تهران',
      'کلینیک دامپزشکی قیطریه',
      'پت‌باس',
    ],
  });
}

export default async function ServiceDetailPage({ params }: { params: Params }) {
  const { locale, slug } = await params;
  setRequestLocale(locale);

  const service = await getServiceBySlug(decodeSlug(slug));
  if (!service) notFound();

  const [related, nap, pictures] = await Promise.all([
    getRelatedServices(service.divisionId, service.id),
    getClinicNAP(),
    getSitePictures(),
  ]);

  const price = priceLabel(service);
  const image = service.ogImageId && !service.ogImageId.startsWith('data:') ? service.ogImageId : divisionImage(pictures, service);
  const faqs = serviceFaqs(service, nap);
  const url = absoluteUrl(servicePath(service.slugFa));
  const hasPrice = !!service.priceFrom && service.priceFrom > 0;

  const serviceJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Service',
    '@id': `${url}#service`,
    name: service.nameFa,
    description: service.descriptionFa ?? `${service.nameFa} در کلینیک دامپزشکی پت‌باس تهران.`,
    serviceType: service.division.nameFa,
    url,
    provider: { '@type': 'VeterinaryCare', '@id': absoluteUrl('/#veterinary') },
    areaServed: [
      { '@type': 'City', name: 'تهران' },
      { '@type': 'Place', name: 'قیطریه' },
    ],
    ...(hasPrice && {
      offers: {
        '@type': 'AggregateOffer',
        priceCurrency: 'IRR',
        lowPrice: service.priceFrom! * 10,
        ...(service.priceTo && service.priceTo > service.priceFrom! && { highPrice: service.priceTo * 10 }),
        offerCount: 1,
        availability: 'https://schema.org/InStock',
        url,
      },
    }),
  };

  return (
    <div className="container mx-auto max-w-6xl px-4 py-6 sm:py-10">
      <JsonLdScript data={serviceJsonLd} />
      <FAQPageJsonLd faqs={faqs} />

      <Breadcrumbs
        items={[
          { name: 'خانه', href: '/' },
          { name: 'خدمات کلینیک', href: '/services' },
          { name: service.nameFa, href: servicePath(service.slugFa) },
        ]}
      />

      <div className="mt-6 grid grid-cols-1 gap-8 lg:grid-cols-[1.35fr_1fr]">
        <div className="space-y-8">
          <header className="space-y-4">
            <Link href="/services" className="text-xs font-bold text-primary hover:underline">
              {service.division.nameFa}
            </Link>
            <h1 className="text-2xl sm:text-3xl font-black leading-[1.6]">{service.nameFa}</h1>
            <p className="text-sm sm:text-base text-muted-foreground leading-8">
              {service.descriptionFa ||
                `${service.nameFa} توسط تیم دامپزشکی پت‌باس در قیطریه تهران انجام می‌شود.`}
            </p>
            <div className="flex flex-wrap gap-2 text-xs font-bold">
              <span className="rounded-full border border-primary/40 bg-primary/10 text-primary px-3 py-1">{price}</span>
              {service.durationFa && (
                <span className="rounded-full border border-border px-3 py-1 text-muted-foreground">
                  مدت تقریبی: {service.durationFa}
                </span>
              )}
              <span className="rounded-full border border-border px-3 py-1 text-muted-foreground">
                {nap.workingHoursSummaryFa}
              </span>
            </div>
          </header>

          <div className="relative aspect-[16/9] overflow-hidden rounded-3xl border border-border">
            <Image
              src={image}
              alt={`${service.nameFa} در کلینیک دامپزشکی پت‌باس`}
              fill
              priority
              sizes="(max-width: 1024px) 100vw, 65vw"
              className="object-cover"
            />
          </div>

          <section className="rounded-2xl border border-border bg-surface-card p-6">
            <h2 className="text-lg font-bold mb-4">این خدمت شامل چه چیزهایی است؟</h2>
            <ul className="space-y-3 text-sm leading-7 text-foreground/85">
              {benefitsFor(service).map((item) => (
                <li key={item} className="flex gap-2">
                  <span aria-hidden className="text-primary">✓</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
            {service.priceNoteFa && <p className="mt-4 text-xs text-muted-foreground">{service.priceNoteFa}</p>}
          </section>

          <section>
            <h2 className="text-lg font-bold mb-4">چرا پت‌باس؟</h2>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              {TRUST.map((item) => (
                <div key={item.title} className="rounded-2xl border border-border bg-surface p-4">
                  <h3 className="text-sm font-bold">{item.title}</h3>
                  <p className="mt-1 text-xs leading-6 text-muted-foreground">{item.text}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-2xl border border-border bg-surface p-6">
            <h2 className="text-lg font-bold mb-3">قبل از مراجعه</h2>
            <ul className="space-y-2 text-sm leading-7 text-muted-foreground">
              {copyFor(service).before.map((item) => (
                <li key={item} className="flex gap-2">
                  <span aria-hidden className="text-primary">•</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-bold mb-4">سوالات متداول درباره {service.nameFa}</h2>
            <div className="space-y-3">
              {faqs.map((faq) => (
                <details key={faq.question} className="group rounded-xl border border-border bg-surface-card overflow-hidden">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-5 py-4 text-sm font-bold">
                    <span>{faq.question}</span>
                    <span aria-hidden className="text-primary transition-transform group-open:rotate-180">⌄</span>
                  </summary>
                  <p className="border-t border-border/60 px-5 py-4 text-sm leading-7 text-muted-foreground">{faq.answer}</p>
                </details>
              ))}
            </div>
          </section>

          {related.length > 0 && (
            <section>
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-lg font-bold">خدمات مرتبط</h2>
                <Link href="/services" className="text-xs text-primary hover:underline">همه خدمات</Link>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                {related.map((item) => (
                  <Link
                    key={item.id}
                    href={servicePath(item.slugFa)}
                    className="rounded-2xl border border-border bg-surface-card p-4 transition-colors hover:border-primary"
                  >
                    <h3 className="text-sm font-bold">{item.nameFa}</h3>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {formatServicePrice(item.priceDisplayMode, item.priceFrom, item.priceTo, 'fa')}
                    </p>
                  </Link>
                ))}
              </div>
            </section>
          )}
        </div>

        <aside className="h-fit space-y-4 lg:sticky lg:top-28">
          <div className="rounded-2xl border border-border-gold/50 bg-surface-card p-6 shadow-gold space-y-4">
            <div>
              <p className="text-xs text-muted-foreground">هزینه تقریبی</p>
              <p className="mt-1 text-xl font-black text-gradient-gold">{price}</p>
              {service.priceDisplayMode === 'ON_REQUEST' && (
                <p className="mt-1 text-xs text-muted-foreground">پس از معاینه، هزینه دقیق اعلام می‌شود.</p>
              )}
            </div>
            <a
              href={nap.telLink}
              className="block rounded-xl bg-gradient-gold px-4 py-3 text-center text-sm font-extrabold text-charcoal-950"
            >
              تماس و رزرو نوبت
            </a>
            {nap.whatsappLink && (
              <a
                href={nap.whatsappLink}
                target="_blank"
                rel="noopener"
                className="block rounded-xl border border-border px-4 py-3 text-center text-sm font-bold hover:border-primary"
              >
                پرسش در واتس‌اپ
              </a>
            )}
            <div className="border-t border-border pt-4 text-xs leading-6 text-muted-foreground">
              <address className="not-italic">{nap.addressFa}</address>
              <p className="mt-1">
                تلفن:{' '}
                <a href={nap.telLink} className="font-bold text-foreground" dir="ltr">
                  {nap.phoneDisplayFa}
                </a>
              </p>
              <a
                href={`https://maps.google.com/?q=${nap.geo.lat},${nap.geo.lng}`}
                target="_blank"
                rel="noopener"
                className="mt-1 inline-block text-primary hover:underline"
              >
                مسیریابی روی نقشه
              </a>
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-surface p-5 text-xs leading-6 text-muted-foreground">
            این صفحه اطلاعات عمومی خدمت است و جایگزین معاینه دامپزشک نیست. برای تصمیم درباره درمان، با دامپزشک
            مشورت کنید.
          </div>
        </aside>
      </div>
    </div>
  );
}
