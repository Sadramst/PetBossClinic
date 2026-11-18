import { Link } from '@/i18n/routing';
import { BreadcrumbJsonLd } from '@/lib/seo/json-ld';

export interface Crumb {
  name: string;
  href: string;
}

/** Visible breadcrumb trail + matching BreadcrumbList structured data. */
export function Breadcrumbs({ items }: { items: Crumb[] }) {
  return (
    <>
      <BreadcrumbJsonLd items={items} locale="fa" />
      <nav aria-label="مسیر صفحه" className="text-xs text-muted-foreground">
        {/* One scrollable row on phones (no wrapping under the tall mobile header); wraps from sm up. */}
        <ol className="scrollbar-none -mx-1 flex items-center gap-0.5 overflow-x-auto whitespace-nowrap sm:flex-wrap sm:overflow-visible">
          {items.map((c, i) => (
            <li key={c.href} className="flex min-w-0 shrink-0 items-center gap-0.5 last:shrink">
              {i > 0 && (
                <svg className="rtl-flip h-3.5 w-3.5 shrink-0 opacity-60" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d="m9 6 6 6-6 6" />
                </svg>
              )}
              {i === items.length - 1 ? (
                <span aria-current="page" className="inline-block max-w-[55vw] truncate px-1 py-2 text-foreground/80 sm:max-w-md">
                  {c.name}
                </span>
              ) : (
                <Link href={c.href} className="inline-flex min-h-9 items-center rounded-md px-1 -outline-offset-2 transition-colors hover:text-primary">
                  {c.name}
                </Link>
              )}
            </li>
          ))}
        </ol>
      </nav>
    </>
  );
}
