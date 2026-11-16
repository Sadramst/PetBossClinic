import { Link } from '@/i18n/routing';
import { PetBossLogo } from '@/components/shared/pet-boss-logo';
import { SocialIcon } from '@/components/shared/social-icon';
import type { ClinicNAP } from '@/lib/clinic/nap';
import type { NavItem } from '@/lib/navigation/menu';
import { brandPath, categoryPath } from '@/lib/shop/urls';

interface LinkItem {
  id: string;
  slugFa: string;
  nameFa: string;
}

export function Footer({
  nap,
  logoUrl,
  navItems,
  categories = [],
  brands = [],
}: {
  nap?: ClinicNAP;
  logoUrl?: string;
  navItems?: NavItem[];
  categories?: LinkItem[];
  brands?: LinkItem[];
}) {
  const clinicLinks =
    navItems && navItems.length > 0
      ? navItems.filter((i) => i.url !== '/shop').map((i) => ({ href: i.url, label: i.labelFa }))
      : [
          { href: '/', label: 'خانه' },
          { href: '/services', label: 'خدمات کلینیک' },
          { href: '/about', label: 'درباره ما' },
          { href: '/faq', label: 'سوالات متداول' },
          { href: '/contact', label: 'تماس با ما' },
        ];

  return (
    <footer className="bg-surface border-t border-border text-muted-foreground pb-16 lg:pb-0">
      <div className="container mx-auto max-w-7xl px-4 py-12 grid gap-10 sm:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr_1fr]">
        {/* Brand & contact */}
        <div className="space-y-4">
          <Link href="/" className="inline-block" aria-label="پت‌باس">
            <PetBossLogo size="md" variant="gold" logoUrl={logoUrl} />
          </Link>
          <p className="text-sm leading-7 text-foreground/80">
            کلینیک تخصصی دامپزشکی و پت‌شاپ پت‌باس در قیطریه تهران؛ درمان، جراحی، گرومینگ و فروش غذا و لوازم اصل سگ و گربه
            زیر نظر دامپزشک.
          </p>
          {nap && (
            <address className="not-italic text-sm space-y-2 text-foreground/80">
              <p>{nap.addressFa}</p>
              <p>
                تلفن:{' '}
                <a href={nap.telLink} className="hover:text-primary" dir="ltr">
                  {nap.phoneDisplayFa}
                </a>
              </p>
              {nap.workingHoursSummaryFa && <p>ساعات کاری: {nap.workingHoursSummaryFa}</p>}
            </address>
          )}
          {nap?.socialLinks && nap.socialLinks.length > 0 && (
            <div className="flex flex-wrap gap-2.5">
              {nap.socialLinks.map((s) => (
                <a
                  key={s.platform}
                  href={s.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={s.platform}
                  className="w-9 h-9 rounded-full bg-surface-card border border-border flex items-center justify-center text-foreground hover:text-primary hover:border-primary"
                >
                  <SocialIcon platform={s.platform} size={16} />
                </a>
              ))}
            </div>
          )}
        </div>

        <FooterLinks title="پت‌شاپ" links={categories.map((c) => ({ href: categoryPath(c.slugFa), label: c.nameFa }))} />
        <FooterLinks title="برندهای محبوب" links={brands.slice(0, 12).map((b) => ({ href: brandPath(b.slugFa), label: b.nameFa }))} />
        <FooterLinks title="کلینیک پت‌باس" links={clinicLinks} />
      </div>

      <div className="border-t border-border">
        <div className="container mx-auto max-w-7xl px-4 py-5 flex flex-col sm:flex-row gap-2 items-center justify-between text-xs">
          <p>© {new Date().toLocaleDateString('fa-IR-u-ca-persian', { year: 'numeric' })} کلینیک دامپزشکی و پت‌شاپ پت‌باس — تمامی حقوق محفوظ است.</p>
          <p>
            طراحی و توسعه توسط{' '}
            <a href="https://www.appilico.com.au/" target="_blank" rel="noopener" className="text-primary hover:underline">
              Appilico
            </a>
          </p>
        </div>
      </div>
    </footer>
  );
}

function FooterLinks({ title, links }: { title: string; links: { href: string; label: string }[] }) {
  if (links.length === 0) return null;
  return (
    <nav aria-label={title}>
      <h2 className="text-primary font-bold mb-4 text-sm">{title}</h2>
      <ul className="space-y-2 text-sm text-foreground/80">
        {links.map((l) => (
          <li key={l.href}>
            <Link href={l.href} className="hover:text-primary">
              {l.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
