import type { ComponentType, ReactNode, SVGProps } from 'react';
import type { Metadata } from 'next';
import Image from 'next/image';
import { setRequestLocale } from 'next-intl/server';
import { db } from '@/lib/db';
import { Link } from '@/i18n/routing';
import { SiteSearch } from '@/components/layout/header';
import { ProductCard } from '@/components/shop/product-card';
import { Rating } from '@/components/ui/rating';
import { SectionHeading } from '@/components/ui/section-heading';
import {
  ArrowForwardIcon,
  BagIcon,
  CalendarCheckIcon,
  CheckIcon,
  ChevronDownIcon,
  ClockIcon,
  MapPinIcon,
  PhoneIcon,
  ShieldCheckIcon,
  StethoscopeIcon,
  TruckIcon,
} from '@/components/home/icons';
import { RailScroller } from '@/components/home/rail-scroller';
import { getClinicNAP } from '@/lib/clinic/nap';
import { formatServicePrice } from '@/lib/format/price';
import { VeterinaryCareJsonLd, FAQPageJsonLd, ItemListJsonLd } from '@/lib/seo/json-ld';
import { pageMetadata } from '@/lib/seo/metadata';
import { SITE_HOME_DESCRIPTION, SITE_HOME_TITLE, absoluteUrl } from '@/lib/seo/site';
import { getActiveCategories, getNavCatalog, getProductRail, type ProductCardData } from '@/lib/shop/catalog';
import { brandPath, categoryPath, productPath } from '@/lib/shop/urls';

export const revalidate = 300;

export function generateStaticParams() {
  return [{ locale: 'fa' }];
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  setRequestLocale(locale);
  return pageMetadata({
    title: SITE_HOME_TITLE,
    description: SITE_HOME_DESCRIPTION,
    path: '/',
    image: '/images/petboss-sign.jpg',
  });
}

/** Same gutter as the site header so section edges line up with it. */
const WRAP = 'container mx-auto max-w-7xl px-4';
/** Vertical rhythm between homepage sections. */
const GAP = 'pt-10 sm:pt-14';

type IconType = ComponentType<SVGProps<SVGSVGElement>>;

const TRUST: { Icon: IconType; title: string; text: string }[] = [
  { Icon: ShieldCheckIcon, title: 'ضمانت اصالت', text: 'فقط کالای اصل از واردکنندگان معتبر' },
  { Icon: CalendarCheckIcon, title: 'تاریخ انقضای معتبر', text: 'تاریخ انقضای هر کالا روی صفحه محصول' },
  { Icon: StethoscopeIcon, title: 'مشاوره رایگان دامپزشک', text: 'انتخاب غذا و مکمل با نظر دامپزشک' },
  { Icon: TruckIcon, title: 'ارسال سریع در تهران', text: 'تحویل با پیک در کوتاه‌ترین زمان' },
];

const PETS = [
  { pet: 'cat', title: 'همه چیز برای گربه', short: 'گربه', text: 'غذای خشک و پوچ، تشویقی، خاک و اسباب‌بازی', img: '/images/categories/cat-dry-food.jpg' },
  { pet: 'dog', title: 'همه چیز برای سگ', short: 'سگ', text: 'غذای خشک و کنسرو، تشویقی، قلاده و لوازم', img: '/images/categories/dog-dry-food.jpg' },
];

const CLINIC_PHOTOS = [
  { src: '/images/veterinarian.jpg', alt: 'اتاق معاینه دامپزشکی پت‌باس' },
  { src: '/images/grooming.jpg', alt: 'سالن گرومینگ و آرایش سگ و گربه پت‌باس' },
  { src: '/images/reception.jpg', alt: 'پذیرش کلینیک و پت‌شاپ پت‌باس' },
  { src: '/images/petboss-signboard.jpg', alt: 'تابلوی کلینیک دامپزشکی پت‌باس در قیطریه' },
];

const CLINIC_POINTS = ['معاینه و واکسیناسیون', 'جراحی و دندانپزشکی', 'گرومینگ و آرایش تخصصی', 'مشاوره تغذیه با دامپزشک'];

const BRAND_LIMIT = 16;

/** First letter of the name for the avatar fallback, skipping the «دکتر» title. */
function initialOf(name: string) {
  const bare = name.replace(/^\s*دکتر\s+/, '').trim() || name.trim();
  return bare.charAt(0);
}

export default async function HomePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);

  const [sections, siteSetting, nap, categories, nav, featured, catFood, dogFood, treats, divisions, services, staff, testimonials, faqs] =
    await Promise.all([
      db.homepageSection.findMany({ orderBy: { sortOrder: 'asc' } }),
      db.siteSetting.findFirst({ select: { heroTitleFa: true, heroSubtitleFa: true } }),
      getClinicNAP(),
      getActiveCategories(),
      getNavCatalog(),
      getProductRail({ isFeatured: true }, 10),
      getProductRail({ category: { slugFa: { in: ['cat-dry-food', 'cat-wet-food'] } } }, 10),
      getProductRail({ category: { slugFa: { in: ['dog-dry-food', 'dog-wet-food'] } } }, 10),
      getProductRail({ category: { slugFa: { in: ['cat-treats', 'dog-treats'] } } }, 10),
      db.division.findMany({ where: { isActive: true }, orderBy: { sortOrder: 'asc' } }),
      db.service.findMany({ where: { isActive: true }, orderBy: { sortOrder: 'asc' }, take: 6, include: { division: true } }),
      db.staffMember.findMany({ where: { isActive: true }, orderBy: { sortOrder: 'asc' }, take: 4 }),
      db.testimonial.findMany({ where: { isActive: true }, orderBy: { sortOrder: 'asc' }, take: 6 }),
      db.faq.findMany({ where: { isActive: true }, orderBy: { sortOrder: 'asc' }, take: 8 }),
    ]);

  // Admin-managed section titles and visibility (Admin > Homepage)
  const sec = new Map(sections.map((s) => [s.key, s]));
  const visible = (key: string) => sec.get(key)?.isVisible !== false;
  const titleOf = (key: string, fallback: string) => sec.get(key)?.titleFa || fallback;
  const subtitleOf = (key: string, fallback: string) => sec.get(key)?.subtitleFa || fallback;

  const hero = sec.get('hero');
  const heroTitle = hero?.titleFa || siteSetting?.heroTitleFa || 'پت‌شاپ و کلینیک دامپزشکی پت‌باس';
  const heroSubtitle =
    hero?.subtitleFa ||
    siteSetting?.heroSubtitleFa ||
    'غذا، تشویقی و لوازم اصل سگ و گربه با تاریخ انقضای معتبر، در کنار خدمات تخصصی دامپزشکی و گرومینگ در قیطریه تهران.';

  const shopCategories = categories.filter((c) => c._count.products > 0);
  const popularChips = shopCategories.slice(0, 6);
  // If nothing is marked featured yet, fall back to in-stock picks.
  const picks = featured.length >= 4 ? featured : await getProductRail({}, 10);

  const brands = nav.brands.slice(0, BRAND_LIMIT);
  const moreBrands = nav.brands.length - brands.length;

  return (
    <>
      <VeterinaryCareJsonLd nap={nap} locale="fa" />
      {faqs.length > 0 && <FAQPageJsonLd faqs={faqs.map((f) => ({ question: f.questionFa, answer: f.answerFa }))} />}
      <ItemListJsonLd
        name="منتخب محصولات پت‌باس"
        urls={picks.map((p) => absoluteUrl(productPath(p.slugFa)))}
      />

      {visible('hero') && (
        <section className="iran-hero" aria-labelledby="hero-title">
          <div className="iran-hero-grid">
            <div className="iran-hero-copy">
              <span className="iran-eyebrow">{hero?.eyebrowFa || 'پت‌باس؛ برای آن‌ها که عضوی از خانواده‌اند'}</span>
              <h1 id="hero-title">{heroTitle}<span className="iran-hero-signature" aria-hidden="true">با عشق، برای رفیقت.</span></h1>
              <p>{heroSubtitle}</p>
              <div className="iran-hero-actions"><Link href={hero?.ctaHref || '/shop'} className="btn btn-gold btn-lg">{hero?.ctaLabelFa || 'کشف فروشگاه'} <ArrowForwardIcon className="h-5 w-5"/></Link><Link href="/services" className="iran-clinic-link">خدمات و نوبت کلینیک ←</Link></div>
              <div className="iran-hero-notes"><span><CalendarCheckIcon className="h-4 w-4"/>بررسی تاریخ انقضا</span><span><MapPinIcon className="h-4 w-4"/>خرید از کلینیک قیطریه</span></div>
            </div>
            <Link href="/shop?pet=cat" className="iran-hero-picture"><Image src="/images/editorial/pet-family.webp" alt="تصویر هنری سگ و گربه، همراهان دوست‌داشتنی خانواده" fill priority sizes="(max-width:768px) 100vw,50vw" className="object-cover"/><span className="iran-picture-label"><span>کوچک‌ترین عضو خانواده،<br/>بزرگ‌ترین عشق زندگی.</span><strong>از انتخاب تا مراقبت <ArrowForwardIcon className="h-5 w-5"/></strong></span><span className="iran-photo-stamp" aria-hidden="true">PET BOSS<br/><small>WITH LOVE, ALWAYS</small></span></Link>
          </div>
          <div className="iran-quick-paths"><span>دنبال چی می‌گردی؟</span><Link href="/shop?pet=cat">غذا و لوازم گربه</Link><Link href="/shop?pet=dog">غذا و لوازم سگ</Link><Link href="/shop/cat-litter-hygiene">خاک و بهداشت</Link><Link href="/shop/pet-toys">بازی و سرگرمی</Link><Link href="/services">کلینیک و گرومینگ</Link></div>
        </section>
      )}

      {/* ═══ TRUST ═══ */}
      <section aria-label="چرا پت‌باس" className="border-b border-border bg-surface">
        <ul className={`${WRAP} py-4 sm:py-6 grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4`}>
          {TRUST.map(({ Icon, title, text }) => (
            <li
              key={title}
              className="flex flex-col sm:flex-row items-start gap-2 sm:gap-3 rounded-2xl border border-border bg-surface-card p-3 sm:p-4"
            >
              <span className="flex h-10 w-10 sm:h-11 sm:w-11 shrink-0 items-center justify-center rounded-xl border border-primary/20 bg-primary/10 text-primary">
                <Icon className="h-5 w-5 sm:h-6 sm:w-6" />
              </span>
              <div className="min-w-0">
                <p className="font-bold text-[13px] sm:text-sm">{title}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{text}</p>
              </div>
            </li>
          ))}
        </ul>
      </section>

      {visible('shop') && (
        <>
          {/* ═══ SHOP BY PET ═══ */}
          <section aria-labelledby="home-pets" className={`iran-home-section ${WRAP} ${GAP}`}>
            <SectionHeading id="home-pets" title="خرید بر اساس حیوان خانگی" />
            <div className="grid grid-cols-2 gap-3 sm:gap-4">
              {PETS.map((p) => (
                <Link
                  key={p.pet}
                  href={`/shop?pet=${p.pet}`}
                  className={`iran-pet-tile iran-pet-${p.pet} group relative block h-40 sm:h-56 rounded-2xl sm:rounded-3xl overflow-hidden border border-border hover:border-primary transition-colors`}
                >
                  <Image
                    src="/images/editorial/pet-family.webp"
                    alt=""
                    fill
                    sizes="(max-width: 1280px) 50vw, 620px"
                    className={`object-cover group-hover:scale-105 transition-transform duration-700 ${p.pet === 'cat' ? 'object-right' : 'object-left'}`}
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-charcoal-950 via-charcoal-950/55 to-charcoal-950/10" aria-hidden />
                  <div className="absolute inset-x-0 bottom-0 p-3 sm:p-6">
                    <h3 className="text-base sm:text-2xl font-black text-white">
                      <span className="sm:hidden">{p.short}</span>
                      <span className="hidden sm:inline">{p.title}</span>
                    </h3>
                    <p className="hidden sm:block text-sm text-white/80 mt-1.5">{p.text}</p>
                    <span className="mt-1 sm:mt-3 inline-flex items-center gap-1 text-xs sm:text-sm font-bold text-gold-300">
                      مشاهده محصولات
                      <ArrowForwardIcon className="h-4 w-4 transition-transform group-hover:-translate-x-1" />
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          </section>

          {/* ═══ CATEGORIES ═══ */}
          {shopCategories.length > 0 && (
            <section aria-labelledby="home-categories" className={`iran-home-section ${WRAP} ${GAP}`}>
              <SectionHeading
                id="home-categories"
                title={titleOf('shop', 'دسته‌بندی‌های پت‌شاپ')}
                subtitle={subtitleOf('shop', 'هر آنچه دوست پشمالوی شما نیاز دارد، دسته‌بندی‌شده و آماده خرید.')}
                href="/shop"
                linkAriaLabel="مشاهده همه محصولات پت‌شاپ"
              />
              <ul className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-8 gap-x-3 gap-y-4">
                {shopCategories.map((c) => (
                  <li key={c.id}>
                    <Link href={categoryPath(c.slugFa)} className="group flex flex-col items-center gap-2 text-center">
                      <span className="relative w-full aspect-square rounded-2xl overflow-hidden border border-border bg-surface-card group-hover:border-primary transition-colors">
                        <Image
                          src={c.imageId && !c.imageId.startsWith('data:') ? c.imageId : '/images/categories/other.jpg'}
                          alt={c.nameFa}
                          fill
                          sizes="(max-width: 640px) 33vw, (max-width: 1024px) 25vw, 150px"
                          className="object-cover group-hover:scale-105 transition-transform duration-500"
                        />
                      </span>
                      <span className="text-xs font-medium clamp-2 group-hover:text-primary transition-colors">{c.nameFa}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <ProductRail featured title="پیشنهاد ویژه پت‌باس" subtitle="منتخب دامپزشکان و پرفروش‌های این هفته" href="/shop" products={picks} />
          <ProductRail title="غذای گربه" href="/shop?pet=cat" products={catFood} />
          <ProductRail title="غذای سگ" href="/shop?pet=dog" products={dogFood} />
          <ProductRail title="تشویقی سگ و گربه" href={categoryPath('cat-treats')} products={treats} />

          {/* ═══ BRANDS ═══ */}
          {brands.length > 0 && (
            <section aria-labelledby="home-brands" className={`iran-home-section ${WRAP} ${GAP}`}>
              <SectionHeading
                id="home-brands"
                title="برندهای معتبر"
                subtitle="محصولات اصل از برندهای شناخته‌شده جهانی"
                href={moreBrands > 0 ? '/shop' : undefined}
                linkLabel="همه برندها"
                linkAriaLabel="مشاهده همه برندها در پت‌شاپ"
              />
              <ul className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-8 gap-2.5 sm:gap-3">
                {brands.map((b) => (
                  <li key={b.id}>
                    <Link
                      href={brandPath(b.slugFa)}
                      className="flex h-14 items-center justify-center rounded-xl border border-border bg-surface-card px-2 text-center text-xs sm:text-sm font-bold hover:border-primary hover:text-primary transition-colors"
                    >
                      <span className="clamp-2 leading-5">{b.nameFa}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}

      {/* ═══ CLINIC ═══ */}
      {(visible('divisions') || visible('services')) && (
        <section aria-labelledby="home-clinic" className="mt-10 sm:mt-14 border-y border-border bg-surface">
          <div className={`${WRAP} py-10 sm:py-14 space-y-10`}>
            <div className="grid grid-cols-1 gap-8 lg:gap-12 lg:grid-cols-[1fr_1.1fr] items-center">
              <div className="space-y-5">
                <span className="inline-flex items-center gap-2 text-xs font-bold text-primary">
                  <StethoscopeIcon className="h-4 w-4" />
                  کلینیک تخصصی دامپزشکی
                </span>
                <h2 id="home-clinic" className="text-2xl sm:text-3xl font-black leading-[1.5] text-balance">
                  {titleOf('divisions', 'درمان، جراحی و گرومینگ زیر یک سقف')}
                </h2>
                <p className="text-sm text-muted-foreground leading-8">
                  {subtitleOf(
                    'divisions',
                    'دامپزشکان پت‌باس همه روزه در قیطریه آماده معاینه، واکسیناسیون، جراحی، دندانپزشکی و گرومینگ سگ و گربه هستند.'
                  )}
                </p>
                <ul className="grid grid-cols-2 gap-x-4 gap-y-2.5 text-sm">
                  {CLINIC_POINTS.map((t) => (
                    <li key={t} className="flex items-start gap-2">
                      <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">
                        <CheckIcon className="h-3.5 w-3.5" strokeWidth={2.6} />
                      </span>
                      {t}
                    </li>
                  ))}
                </ul>
                <p className="flex items-start gap-2 text-xs text-muted-foreground">
                  <ClockIcon className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                  <span>{nap.workingHoursSummaryFa}</span>
                </p>
                <div className="grid grid-cols-2 gap-3 sm:flex sm:flex-wrap">
                  <a href={nap.telLink} className="btn btn-gold px-4 sm:px-6">
                    <PhoneIcon className="h-4.5 w-4.5 shrink-0" />
                    رزرو نوبت
                  </a>
                  <Link href="/services" className="btn btn-outline px-4 sm:px-6">
                    خدمات و تعرفه‌ها
                  </Link>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3 pb-6">
                {CLINIC_PHOTOS.map((photo, i) => (
                  <div
                    key={photo.src}
                    className={`relative aspect-[4/3] sm:aspect-[4/5] rounded-2xl overflow-hidden border border-border ${i % 2 ? 'translate-y-6' : ''}`}
                  >
                    <Image src={photo.src} alt={photo.alt} fill sizes="(max-width: 1024px) 50vw, 25vw" className="object-cover" />
                  </div>
                ))}
              </div>
            </div>

            {visible('divisions') && divisions.length > 0 && (
              <ul className="grid sm:grid-cols-3 gap-3 sm:gap-4">
                {divisions.map((d) => (
                  <li key={d.id} className="rounded-2xl border border-border bg-surface-card p-5 border-s-2 border-s-primary/60">
                    <h3 className="font-bold">{d.nameFa}</h3>
                    {d.descriptionFa && <p className="text-sm text-muted-foreground mt-2 leading-7 clamp-3">{d.descriptionFa}</p>}
                  </li>
                ))}
              </ul>
            )}

            {visible('services') && services.length > 0 && (
              <div>
                <SectionHeading
                  title={titleOf('services', 'خدمات پرمراجعه کلینیک')}
                  href="/services"
                  linkAriaLabel="مشاهده همه خدمات کلینیک"
                />
                <ul className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
                  {services.map((s) => (
                    <li key={s.id} className="rounded-2xl border border-border bg-surface-card p-5 flex flex-col hover:border-border-gold transition-colors">
                      <span className="text-[11px] font-semibold text-primary">{s.division.nameFa}</span>
                      <h3 className="font-bold mt-1">{s.nameFa}</h3>
                      {s.descriptionFa && <p className="text-sm text-muted-foreground mt-2 leading-7 clamp-2">{s.descriptionFa}</p>}
                      <div className="mt-auto pt-4 flex items-center justify-between gap-3 text-sm">
                        <span className="font-bold text-primary">{formatServicePrice(s.priceDisplayMode, s.priceFrom, s.priceTo, 'fa')}</span>
                        <a
                          href={nap.telLink}
                          aria-label={`نوبت بگیرید: ${s.nameFa}`}
                          className="inline-flex min-h-9 shrink-0 items-center gap-1 rounded-lg border border-border-gold px-3 text-xs font-bold text-primary hover:bg-primary/10 transition-colors"
                        >
                          <PhoneIcon className="h-3.5 w-3.5" />
                          نوبت بگیرید
                        </a>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </section>
      )}

      {/* ═══ TEAM ═══ */}
      {visible('staff') && staff.length > 0 && (
        <section aria-labelledby="home-staff" className={`iran-home-section ${WRAP} ${GAP}`}>
          <SectionHeading id="home-staff" title={titleOf('staff', 'کادر دامپزشکی')} subtitle={sec.get('staff')?.subtitleFa ?? undefined} />
          <ul className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            {staff.map((v) => (
              <li key={v.id} className="rounded-2xl border border-border bg-surface-card p-4 sm:p-5 text-center">
                <div className="relative w-20 h-20 mx-auto rounded-full overflow-hidden border-2 border-border-gold bg-surface">
                  {v.photoId ? (
                    <Image src={v.photoId} alt={v.nameFa} fill sizes="80px" className="object-cover" />
                  ) : (
                    <span className="flex h-full w-full items-center justify-center bg-primary/10 text-2xl font-black text-primary" aria-hidden>
                      {initialOf(v.nameFa)}
                    </span>
                  )}
                </div>
                <h3 className="font-bold mt-3 text-sm sm:text-base">{v.nameFa}</h3>
                {v.titleFa && <p className="text-xs text-primary mt-1">{v.titleFa}</p>}
                {v.specialtyFa && <p className="text-xs text-muted-foreground mt-1">{v.specialtyFa}</p>}
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* ═══ TESTIMONIALS ═══ */}
      {visible('testimonials') && testimonials.length > 0 && (
        <section aria-labelledby="home-testimonials" className={`iran-home-section ${WRAP} ${GAP}`}>
          <SectionHeading id="home-testimonials" title={titleOf('testimonials', 'نظر مشتریان پت‌باس')} />
          <ul className="flex gap-3 overflow-x-auto snap-x snap-mandatory scroll-px-4 scrollbar-none -mx-4 px-4 pb-1 md:mx-0 md:px-0 md:pb-0 md:grid md:grid-cols-3 md:gap-4 md:overflow-visible">
            {testimonials.map((t) => (
              <li
                key={t.id}
                className="snap-start shrink-0 w-[84%] sm:w-[46%] md:w-auto rounded-2xl border border-border bg-surface-card p-5 flex flex-col"
              >
                <Rating value={t.rating || 5} size="sm" className="self-start" />
                <blockquote className="text-sm leading-7 mt-3 flex-1">«{t.contentFa}»</blockquote>
                <p className="mt-4 flex items-center gap-2 text-xs font-bold">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary" aria-hidden>
                    {t.nameFa.trim().charAt(0)}
                  </span>
                  {t.nameFa}
                </p>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* ═══ FAQ ═══ */}
      {visible('faq') && faqs.length > 0 && (
        <section aria-labelledby="home-faq" className={`container mx-auto max-w-4xl px-4 ${GAP}`}>
          <SectionHeading id="home-faq" title={titleOf('faq', 'سوالات متداول')} href="/faq" linkAriaLabel="مشاهده همه سوالات متداول" />
          <div className="space-y-2">
            {faqs.map((f) => (
              <details key={f.id} className="group rounded-2xl border border-border bg-surface-card open:border-border-gold transition-colors">
                <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 rounded-2xl px-4 py-3 text-sm sm:text-base font-semibold hover:text-primary transition-colors [&::-webkit-details-marker]:hidden">
                  {f.questionFa}
                  <ChevronDownIcon className="h-5 w-5 shrink-0 text-primary transition-transform group-open:rotate-180" strokeWidth={2.2} />
                </summary>
                <p className="px-4 pb-4 text-sm text-muted-foreground leading-7">{f.answerFa}</p>
              </details>
            ))}
          </div>
        </section>
      )}

      {/* ═══ LOCATION ═══ */}
      {visible('contact') && (
        <section aria-labelledby="home-contact" className={`${WRAP} py-10 sm:py-14`}>
          <div className="grid lg:grid-cols-2 rounded-3xl border border-border bg-surface-card overflow-hidden">
            <div className="p-5 sm:p-8 space-y-4">
              <h2 id="home-contact" className="text-xl sm:text-2xl font-black">{titleOf('contact', 'مراجعه حضوری به پت‌باس')}</h2>
              <ul className="space-y-3 text-sm">
                <InfoRow icon={<MapPinIcon className="h-5 w-5" />}>
                  <span className="text-muted-foreground leading-7">{nap.addressFa}</span>
                </InfoRow>
                <InfoRow icon={<ClockIcon className="h-5 w-5" />}>ساعات کاری: {nap.workingHoursSummaryFa}</InfoRow>
                <InfoRow icon={<PhoneIcon className="h-5 w-5" />}>
                  تلفن:{' '}
                  <a href={nap.telLink} className="text-primary font-bold hover:underline" dir="ltr">
                    {nap.phoneDisplayFa}
                  </a>
                </InfoRow>
              </ul>
              <div className="flex flex-wrap gap-2 pt-2">
                <a href={`https://maps.google.com/?q=${nap.geo.lat},${nap.geo.lng}`} target="_blank" rel="noopener" className="btn btn-secondary btn-sm min-h-10">
                  مسیریابی گوگل مپ
                </a>
                <a href={`https://neshan.org/maps/@${nap.geo.lat},${nap.geo.lng},16z`} target="_blank" rel="noopener" className="btn btn-secondary btn-sm min-h-10">
                  مسیریابی نشان
                </a>
                <a href={`https://waze.com/ul?ll=${nap.geo.lat},${nap.geo.lng}&navigate=yes`} target="_blank" rel="noopener" className="btn btn-secondary btn-sm min-h-10">
                  ویز
                </a>
              </div>
            </div>
            <iframe
              title="موقعیت کلینیک پت‌باس روی نقشه"
              src={`https://maps.google.com/maps?q=${nap.geo.lat},${nap.geo.lng}&hl=fa&z=16&output=embed`}
              className="w-full h-72 lg:h-full min-h-72 border-0"
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
            />
          </div>
        </section>
      )}
    </>
  );
}

function InfoRow({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return (
    <li className="flex items-start gap-3">
      <span className="mt-0.5 shrink-0 text-primary">{icon}</span>
      <span className="min-w-0">{children}</span>
    </li>
  );
}

function ProductRail({
  title,
  subtitle,
  href,
  products,
  featured = false,
}: {
  title: string;
  subtitle?: string;
  href: string;
  products: ProductCardData[];
  /** Gold-framed panel for the lead rail so the rails do not all look alike. */
  featured?: boolean;
}) {
  if (products.length === 0) return null;

  // 2 cards + a peek on phones, 3 on tablets, exactly 5 per view on desktop (gap is 0.75rem).
  const item = 'flex w-[44%] sm:w-[30%] lg:w-[calc((100%-3rem)/5)] [&>article]:w-full';

  const rail = (
    <RailScroller label={title} className="rail rail-bleed sm:scroll-px-0! pb-1">
      {products.map((p) => (
        <li key={p.id} className={item}>
          <ProductCard product={p} />
        </li>
      ))}
      <li className={item}>
        <Link
          href={href}
          aria-label={`مشاهده همه: ${title}`}
          className="group flex w-full min-h-40 flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-border-gold bg-surface-card p-4 text-center text-sm font-bold text-primary hover:bg-primary/5 transition-colors"
        >
          <span className="flex h-12 w-12 items-center justify-center rounded-full border border-border-gold bg-primary/10 transition-transform group-hover:-translate-x-1">
            <ArrowForwardIcon className="h-5 w-5" />
          </span>
          مشاهده همه
        </Link>
      </li>
    </RailScroller>
  );

  const heading = (
    <SectionHeading
      title={title}
      subtitle={subtitle}
      eyebrow={featured ? 'منتخب پت‌باس' : undefined}
      href={href}
      linkAriaLabel={`مشاهده همه ${title}`}
    />
  );

  return (
    <section aria-label={title} className={`iran-home-section ${WRAP} ${GAP}`}>
      {featured ? (
        <div className="rounded-3xl border border-border-gold bg-surface p-4 sm:p-6 shadow-gold overflow-hidden lg:overflow-visible">
          {heading}
          {rail}
        </div>
      ) : (
        <>
          {heading}
          {rail}
        </>
      )}
    </section>
  );
}
