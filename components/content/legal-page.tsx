import type { ReactNode } from 'react';
import { Link } from '@/i18n/routing';
import { CtaBand } from '@/components/content/cta-band';
import { PageHero } from '@/components/content/page-hero';
import type { ClinicNAP } from '@/lib/clinic/nap';

export interface LegalSection {
  id: string;
  title: string;
  content: ReactNode;
}

const PAGES = [
  { href: '/shipping', label: 'راهنمای خرید و ارسال' },
  { href: '/returns', label: 'رویه بازگرداندن کالا' },
  { href: '/terms', label: 'قوانین و مقررات' },
  { href: '/privacy', label: 'حریم خصوصی' },
];

/** Bulleted list styled for legal copy. */
export function Bullets({ items }: { items: ReactNode[] }) {
  return (
    <ul className="list-disc space-y-2 ps-6 marker:text-primary">
      {items.map((item, i) => (
        <li key={i}>{item}</li>
      ))}
    </ul>
  );
}

/**
 * Shared layout of the shop's policy pages (shipping, returns, terms, privacy):
 * header, table of contents, numbered sections and a contact band. The text itself
 * lives in each page; the shop owner should review it before relying on it.
 */
export function LegalPage({
  path,
  title,
  subtitle,
  sections,
  nap,
  notice,
}: {
  path: string;
  title: string;
  subtitle: string;
  sections: LegalSection[];
  nap: ClinicNAP;
  notice?: ReactNode;
}) {
  return (
    <>
      <PageHero
        badge="پت‌شاپ پت‌باس"
        title={title}
        subtitle={subtitle}
        crumbs={[
          { name: 'خانه', href: '/' },
          { name: title, href: path },
        ]}
      />
      <div className="container-site section">
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-[260px_minmax(0,1fr)]">
          <nav aria-label="فهرست مطالب" className="h-fit rounded-2xl border border-border bg-surface-card p-4 text-sm lg:sticky lg:top-40">
            <p className="mb-2 font-bold">فهرست مطالب</p>
            <ol className="space-y-1.5">
              {sections.map((s, i) => (
                <li key={s.id}>
                  <a href={`#${s.id}`} className="block rounded-md py-1 text-foreground/85 hover:text-primary">
                    {(i + 1).toLocaleString('fa-IR')}. {s.title}
                  </a>
                </li>
              ))}
            </ol>
            <p className="mt-4 border-t border-border pt-3 text-xs text-muted-foreground">سایر راهنماها</p>
            <ul className="mt-2 space-y-1.5">
              {PAGES.filter((p) => p.href !== path).map((p) => (
                <li key={p.href}>
                  <Link href={p.href} className="text-foreground/85 hover:text-primary">
                    {p.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          <article className="min-w-0 space-y-9">
            {notice}
            {sections.map((s, i) => (
              <section key={s.id} id={s.id} className="scroll-mt-header">
                <h2 className="mb-3 text-lg font-black sm:text-xl">
                  {(i + 1).toLocaleString('fa-IR')}. {s.title}
                </h2>
                <div className="space-y-3 text-sm leading-8 text-foreground/85">{s.content}</div>
              </section>
            ))}
          </article>
        </div>

        <CtaBand
          className="mt-12"
          title="سوالی دارید؟"
          text="همکاران ما در ساعات کاری کلینیک پاسخگوی شما هستند. هنگام تماس، شماره سفارش را در دسترس داشته باشید."
          nap={nap}
          callLabel="تماس با کلینیک"
        />
      </div>
    </>
  );
}
