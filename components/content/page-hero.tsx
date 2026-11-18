import type { ReactNode } from 'react';
import { Breadcrumbs, type Crumb } from '@/components/shop/breadcrumbs';

export interface PageHeroProps {
  /** Trail including the current page. Breadcrumbs also emits the BreadcrumbList JSON-LD. */
  crumbs: Crumb[];
  title: ReactNode;
  subtitle?: ReactNode;
  /** Small gold label above the title. */
  badge?: ReactNode;
  /** Buttons / meta shown under the subtitle. */
  children?: ReactNode;
}

/**
 * Shared header for clinic, content and legal pages: visible breadcrumbs,
 * a single start-aligned h1 and a short subtitle. Compact on phones so the
 * content starts within the first screen.
 */
export function PageHero({ crumbs, title, subtitle, badge, children }: PageHeroProps) {
  return (
    <section className="relative overflow-hidden border-b border-border/60 bg-gradient-hero">
      <div
        aria-hidden
        className="pointer-events-none absolute -top-24 start-0 h-72 w-72 rounded-full bg-[radial-gradient(circle_at_center,rgba(197,160,89,0.14)_0%,transparent_70%)]"
      />
      <div className="container-site relative py-6 sm:py-12">
        <Breadcrumbs items={crumbs} />
        <div className="mt-4 max-w-3xl sm:mt-6">
          {badge && <p className="mb-2 text-xs font-bold text-primary sm:text-sm">{badge}</p>}
          <h1 className="text-2xl font-black leading-[1.5] text-foreground sm:text-4xl sm:leading-[1.5]">{title}</h1>
          {subtitle && (
            <p className="mt-2 text-sm leading-8 text-muted-foreground sm:mt-3 sm:text-base sm:leading-8">{subtitle}</p>
          )}
          {children && <div className="mt-5 flex flex-wrap gap-2.5">{children}</div>}
        </div>
      </div>
    </section>
  );
}
