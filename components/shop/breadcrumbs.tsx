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
        <ol className="flex flex-wrap items-center gap-1.5">
          {items.map((c, i) => (
            <li key={c.href} className="flex items-center gap-1.5">
              {i > 0 && <span aria-hidden>‹</span>}
              {i === items.length - 1 ? (
                <span aria-current="page" className="text-foreground/80 line-clamp-1">{c.name}</span>
              ) : (
                <Link href={c.href} className="hover:text-primary">{c.name}</Link>
              )}
            </li>
          ))}
        </ol>
      </nav>
    </>
  );
}
