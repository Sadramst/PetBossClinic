import type { ReactNode } from 'react'
import { Link } from '@/i18n/routing'
import { AdminTabs, type AdminTabsProps } from './admin-tabs'

export interface Crumb {
  label: string
  href?: string
}

export interface PageHeaderProps {
  title: string
  subtitle?: ReactNode
  /** «پیشخوان» is always added as the first crumb. */
  breadcrumbs?: Crumb[]
  actions?: ReactNode
  tabs?: AdminTabsProps
}

const ROOT = 'پیشخوان'

/** Title, breadcrumb trail, primary actions and optional tabs: the top of every admin page. */
export function PageHeader({ title, subtitle, breadcrumbs, actions, tabs }: PageHeaderProps) {
  const trail: Crumb[] = breadcrumbs?.length ? (breadcrumbs[0].label === ROOT ? breadcrumbs : [{ label: ROOT, href: '/admin' }, ...breadcrumbs]) : []
  return (
    <header className="mb-5 space-y-3">
      {trail.length > 0 && (
        <nav aria-label="مسیر صفحه" data-testid="breadcrumbs">
          <ol className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
            {trail.map((c, i) => {
              const last = i === trail.length - 1
              return (
                <li key={`${c.label}-${i}`} className="flex items-center gap-1.5">
                  {c.href && !last ? (
                    <Link href={c.href} className="hover:text-primary">
                      {c.label}
                    </Link>
                  ) : (
                    <span aria-current={last ? 'page' : undefined} className={last ? 'font-bold text-foreground/80' : undefined}>
                      {c.label}
                    </span>
                  )}
                  {!last && (
                    <span aria-hidden className="text-border">
                      /
                    </span>
                  )}
                </li>
              )
            })}
          </ol>
        </nav>
      )}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-xl font-extrabold sm:text-2xl">{title}</h1>
          {subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
      {tabs && <AdminTabs {...tabs} />}
    </header>
  )
}
