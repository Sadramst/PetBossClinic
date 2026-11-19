import { Link } from '@/i18n/routing';
import { PetBossLogo } from '@/components/shared/pet-boss-logo';
import { SocialIcon } from '@/components/shared/social-icon';
import type { ClinicNAP } from '@/lib/clinic/nap';
import type { NavItem } from '@/lib/navigation/menu';
import { brandPath, categoryPath } from '@/lib/shop/urls';
import { FooterCapture } from '@/components/marketing/footer-capture';

interface LinkItem {
  id: string;
  slugFa: string;
  nameFa: string;
}

const SOCIAL_LABELS: Record<string, string> = {
  INSTAGRAM: 'اینستاگرام',
  WHATSAPP: 'واتس‌اپ',
  TELEGRAM: 'تلگرام',
  APARAT: 'آپارات',
  YOUTUBE: 'یوتیوب',
  LINKEDIN: 'لینکدین',
  X: 'ایکس (توییتر)',
  FACEBOOK: 'فیس‌بوک',
};

const TRUST_ITEMS = [
  {
    title: 'ضمانت اصالت کالا',
    text: 'انتخاب‌شده زیر نظر دامپزشک',
    path: 'M12 3 5 6v5c0 4.5 3 8 7 9.5 4-1.5 7-5 7-9.5V6l-7-3Z M9 12l2 2 4-4',
  },
  {
    title: 'تاریخ انقضای معتبر',
    text: 'تاریخ هر کالا در صفحه محصول',
    path: 'M4 7a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7Z M4 10h16 M8 3v4 M16 3v4 M9 15l2 2 4-4',
  },
  {
    title: 'پرداخت در محل',
    text: 'برای سفارش‌های شهر تهران',
    path: 'M3 7a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z M3 10h18 M7 15h4',
  },
  {
    title: 'مشاوره دامپزشک',
    text: 'راهنمایی رایگان پیش از خرید',
    path: 'M12 20s-7-4.5-7-10a4 4 0 0 1 7-2.5A4 4 0 0 1 19 10c0 5.5-7 10-7 10Z M12 10v4 M10 12h4',
  },
];

/** Fixed help and legal links: shoppers and eNamad reviewers look for these in the footer. */
const CUSTOMER_LINKS = [
  { href: '/account', label: 'پیگیری سفارش' },
  { href: '/cart', label: 'سبد خرید' },
  { href: '/shipping', label: 'راهنمای خرید و ارسال' },
  { href: '/returns', label: 'رویه بازگرداندن کالا' },
  { href: '/terms', label: 'قوانین و مقررات' },
  { href: '/privacy', label: 'حریم خصوصی' },
];

const DEFAULT_CLINIC_LINKS = [
  { href: '/', label: 'خانه' },
  { href: '/services', label: 'خدمات کلینیک' },
  { href: '/about', label: 'درباره ما' },
  { href: '/faq', label: 'سوالات متداول' },
  { href: '/contact', label: 'تماس با ما' },
];

export function Footer({
  nap,
  logoUrl,
  navItems,
  categories = [],
  brands = [],
  enamad = null,
  welcomeLabel,
}: {
  nap?: ClinicNAP;
  logoUrl?: string;
  navItems?: NavItem[];
  categories?: LinkItem[];
  brands?: LinkItem[];
  enamad?: { id: string; code: string } | null;
  /** Short description of the welcome offer, e.g. «۱۰٪ تخفیف». */
  welcomeLabel?: string;
}) {
  const clinicLinks = [
    ...(navItems && navItems.length > 0
      ? navItems.filter((i) => i.url !== '/shop').map((i) => ({ href: i.url, label: i.labelFa }))
      : DEFAULT_CLINIC_LINKS),
    { href: '/blog', label: 'مجله پت‌باس' },
  ];
  // The FAQ belongs with customer help; add it there when the admin menu does not already list it.
  const customerLinks = clinicLinks.some((l) => l.href === '/faq')
    ? CUSTOMER_LINKS
    : [...CUSTOMER_LINKS, { href: '/faq', label: 'سوالات متداول' }];

  return (
    <footer className="pb-bottom-nav border-t border-border bg-surface text-muted-foreground print:hidden">
      {/* Trust band */}
      <div className="border-b border-border">
        <ul className="container mx-auto grid max-w-7xl grid-cols-2 gap-x-4 gap-y-5 px-4 py-6 lg:grid-cols-4">
          {TRUST_ITEMS.map((t) => (
            <li key={t.title} className="flex items-center gap-3">
              <span
                aria-hidden
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-border-gold bg-primary/10 text-primary"
              >
                <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d={t.path} />
                </svg>
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-bold text-foreground">{t.title}</span>
                <span className="block text-xs">{t.text}</span>
              </span>
            </li>
          ))}
        </ul>
      </div>

      <FooterCapture offerLabel={welcomeLabel} />

      <div className="container mx-auto grid max-w-7xl gap-x-8 gap-y-9 px-4 py-10 sm:grid-cols-2 lg:grid-cols-[1.5fr_1fr_1fr_1fr_1fr] lg:py-12">
        {/* Brand & contact */}
        <div className="space-y-4 sm:col-span-2 lg:col-span-1">
          <Link href="/" className="inline-block" aria-label="پت‌باس">
            <PetBossLogo size="md" variant="gold" logoUrl={logoUrl} />
          </Link>
          <p className="text-sm leading-7 text-foreground/80">
            کلینیک تخصصی دامپزشکی و پت‌شاپ پت‌باس در قیطریه تهران؛ درمان، جراحی، گرومینگ و فروش غذا و لوازم اصل سگ و گربه
            زیر نظر دامپزشک.
          </p>
          {nap && (
            <address className="space-y-2 text-sm not-italic text-foreground/80">
              <p>{nap.addressFa}</p>
              <p>
                تلفن:{' '}
                <a href={nap.telLink} className="font-bold text-foreground hover:text-primary" dir="ltr">
                  {nap.phoneDisplayFa}
                </a>
              </p>
              {nap.workingHoursSummaryFa && <p>ساعات کاری: {nap.workingHoursSummaryFa}</p>}
            </address>
          )}
          <div className="flex flex-wrap items-center gap-4">
            {nap?.socialLinks && nap.socialLinks.length > 0 && (
              <ul className="flex flex-wrap gap-2">
                {nap.socialLinks.map((s) => (
                  <li key={s.platform}>
                    <a
                      href={s.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={SOCIAL_LABELS[s.platform.toUpperCase()] ?? s.platform}
                      className="flex h-11 w-11 items-center justify-center rounded-full border border-border bg-surface-card text-foreground transition-colors hover:border-primary hover:text-primary"
                    >
                      <SocialIcon platform={s.platform} size={18} />
                    </a>
                  </li>
                ))}
              </ul>
            )}
            {enamad && (
              <a
                referrerPolicy="origin"
                target="_blank"
                rel="noopener"
                href={`https://trustseal.enamad.ir/?id=${enamad.id}&Code=${enamad.code}`}
                className="inline-block rounded-xl bg-white p-2"
                aria-label="نماد اعتماد الکترونیکی"
              >
                {/* eslint-disable-next-line @next/next/no-img-element -- eNamad requires its own hosted image with the origin referrer */}
                <img
                  referrerPolicy="origin"
                  src={`https://trustseal.enamad.ir/logo.aspx?id=${enamad.id}&Code=${enamad.code}`}
                  alt="نماد اعتماد الکترونیکی"
                  width={90}
                  height={90}
                  loading="lazy"
                  style={{ cursor: 'pointer' }}
                />
              </a>
            )}
          </div>
        </div>

        <FooterLinks title="پت‌شاپ" links={categories.map((c) => ({ href: categoryPath(c.slugFa), label: c.nameFa }))} />
        <FooterLinks title="برندهای محبوب" links={brands.slice(0, 12).map((b) => ({ href: brandPath(b.slugFa), label: b.nameFa }))} />
        <FooterLinks title="راهنمای مشتریان" links={customerLinks} />
        <FooterLinks title="کلینیک پت‌باس" links={clinicLinks} />
      </div>

      <div className="border-t border-border">
        <div className="container mx-auto flex max-w-7xl flex-col items-center justify-between gap-2 px-4 py-4 text-center text-xs sm:flex-row sm:text-start">
          <p>© {new Date().toLocaleDateString('fa-IR-u-ca-persian', { year: 'numeric' })} کلینیک دامپزشکی و پت‌شاپ پت‌باس — تمامی حقوق محفوظ است.</p>
          <div className="flex items-center gap-4">
            <p>
              طراحی و توسعه توسط{' '}
              <a href="https://www.appilico.com.au/" target="_blank" rel="noopener" className="text-primary hover:underline">
                Appilico
              </a>
            </p>
            {/* "#top" scrolls to the top of the document without any script */}
            <a
              href="#top"
              className="inline-flex min-h-11 items-center gap-1.5 rounded-xl border border-border px-3 text-foreground/85 transition-colors hover:border-primary hover:text-primary"
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="m6 14 6-6 6 6" />
              </svg>
              بازگشت به بالا
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}

function FooterLinks({ title, links }: { title: string; links: { href: string; label: string }[] }) {
  if (links.length === 0) return null;
  return (
    <nav aria-label={title}>
      <h2 className="mb-2 text-sm font-bold text-primary sm:mb-3">{title}</h2>
      {/* Two columns on phones keep the footer short; rows are tall enough to tap. */}
      <ul className="grid grid-cols-2 gap-x-4 text-sm text-foreground/80 sm:grid-cols-1">
        {links.map((l) => (
          <li key={l.href}>
            <Link href={l.href} className="flex min-h-10 items-center transition-colors hover:text-primary sm:min-h-0 sm:py-1.5">
              {l.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
