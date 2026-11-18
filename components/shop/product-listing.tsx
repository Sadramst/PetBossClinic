import type { ReactNode } from 'react';
import { Link } from '@/i18n/routing';
import { ProductCard } from '@/components/shop/product-card';
import { MobileFilterSheet, SortSelect } from '@/components/shop/sort-select';
import { Breadcrumbs, type Crumb } from '@/components/shop/breadcrumbs';
import { EmptyState } from '@/components/ui/empty-state';
import { Pagination } from '@/components/ui/pagination';
import { getClinicNAP } from '@/lib/clinic/nap';
import { ItemListJsonLd } from '@/lib/seo/json-ld';
import { absoluteUrl } from '@/lib/seo/site';
import { brandPath, categoryPath, productPath } from '@/lib/shop/urls';
import { filtersToQuery, SORT_LABELS, type ShopFilters, type SortKey } from '@/lib/shop/filters';
import type { ProductCardData } from '@/lib/shop/catalog';

interface FacetLink {
  id: string;
  slugFa: string;
  nameFa: string;
  count: number;
}

export interface ProductListingProps {
  title: string;
  intro?: string | null;
  /** Small label above the title, e.g. «برند». */
  eyebrow?: string;
  /** Visual shown beside the title, e.g. a brand logo tile. */
  headerMedia?: ReactNode;
  breadcrumbs: Crumb[];
  /** Path the filters apply to: /shop, /shop/<category> or /brand/<slug>. */
  basePath: string;
  filters: ShopFilters;
  products: ProductCardData[];
  total: number;
  pageCount: number;
  categories: FacetLink[];
  brands: FacetLink[];
  activeCategoryId?: string;
  activeBrandId?: string;
  /** Hide the pet filter on pages that are already species-specific. */
  showPetFilter?: boolean;
  /** Category shortcut chips above the results on phones (off when the page shows its own strip). */
  showCategoryChips?: boolean;
}

const fa = (n: number) => n.toLocaleString('fa-IR');

export function ProductListing(props: ProductListingProps) {
  const { filters, basePath, products, total, pageCount } = props;
  const href = (f: Partial<ShopFilters>, page?: number) => `${basePath}${filtersToQuery({ ...filters, ...f }, page)}`;
  const sortHrefs = Object.fromEntries(
    (Object.keys(SORT_LABELS) as SortKey[]).map((k) => [k, href({ sort: k }, 1)])
  ) as Record<SortKey, string>;
  const showPetFilter = props.showPetFilter !== false;

  const chips: { label: string; remove: string }[] = [];
  if (filters.q) chips.push({ label: `«${filters.q}»`, remove: href({ q: '' }, 1) });
  if (filters.pet) chips.push({ label: filters.pet === 'cat' ? 'گربه' : 'سگ', remove: href({ pet: null }, 1) });
  if (filters.inStock) chips.push({ label: 'فقط موجود', remove: href({ inStock: false }, 1) });
  if (filters.min || filters.max) {
    const range = [filters.min ? `از ${fa(filters.min)}` : '', filters.max ? `تا ${fa(filters.max)}` : ''].filter(Boolean).join(' ');
    chips.push({ label: `قیمت ${range} تومان`, remove: href({ min: null, max: null }, 1) });
  }
  // "Clear all" keeps the chosen sort: it is not a filter.
  const clearHref = `${basePath}${filtersToQuery({ sort: filters.sort })}`;

  return (
    <div className="iran-listing container mx-auto max-w-7xl px-4 py-5 sm:py-8">
      <ItemListJsonLd name={props.title} urls={products.map((p) => absoluteUrl(productPath(p.slugFa)))} />
      <Breadcrumbs items={props.breadcrumbs} />

      <header className="iran-listing-intro mb-5 mt-3 flex items-start gap-4 sm:mb-6 sm:mt-4">
        {props.headerMedia}
        <div className="min-w-0">
          {props.eyebrow && <p className="mb-1 text-xs font-bold text-primary">{props.eyebrow}</p>}
          <h1 className="text-xl font-extrabold leading-9 sm:text-3xl sm:leading-[1.5]">{props.title}</h1>
          {props.intro && filters.page === 1 && (
            <p className="mt-2 max-w-3xl text-sm leading-7 text-muted-foreground">{props.intro}</p>
          )}
        </div>
      </header>

      {props.showCategoryChips !== false && props.categories.length > 0 && (
        <nav aria-label="میان‌بر دسته‌بندی‌ها" className="mb-4 lg:hidden">
          <ul className="rail rail-bleed gap-2 pb-1">
            {props.categories.map((c) => (
              <li key={c.id}>
                <Link
                  href={categoryPath(c.slugFa)}
                  aria-current={c.id === props.activeCategoryId ? 'page' : undefined}
                  className="chip h-10 whitespace-nowrap px-4 text-[13px]"
                >
                  {c.nameFa}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      )}

      <div className="grid gap-6 lg:grid-cols-[260px_minmax(0,1fr)]">
        {/* Desktop sidebar; on phones the facet lists move below the products (chips above cover categories) */}
        <aside className="order-2 min-w-0 space-y-4 lg:order-1">
          <div className="hidden rounded-2xl border border-border bg-surface-card lg:block">
            <h2 className="flex items-center justify-between gap-2 p-4 pb-3 font-bold">
              فیلترها
              {chips.length > 0 && (
                <Link href={clearHref} className="text-xs font-semibold text-muted-foreground hover:text-primary">
                  حذف همه
                </Link>
              )}
            </h2>
            <FilterForm id="filters-desktop" basePath={basePath} filters={filters} showPetFilter={showPetFilter} />
          </div>

          <FacetNav title="دسته‌بندی‌ها" items={props.categories} activeId={props.activeCategoryId} pathFor={categoryPath} />
          {props.brands.length > 0 && (
            <FacetNav title="برندها" items={props.brands} activeId={props.activeBrandId} pathFor={brandPath} />
          )}
        </aside>

        <section aria-label="محصولات" className="order-1 min-w-0 lg:order-2">
          <div className="mb-4 flex items-center gap-2 sm:gap-3">
            <MobileFilterSheet count={chips.length} formId="filters-mobile" clearHref={clearHref} className="lg:hidden">
              <FilterForm id="filters-mobile" basePath={basePath} filters={filters} showPetFilter={showPetFilter} inSheet />
            </MobileFilterSheet>
            <SortSelect value={filters.sort} hrefFor={sortHrefs} />
            <p className="ms-auto shrink-0 text-end text-[13px] text-muted-foreground sm:text-sm">
              <span className="font-bold text-foreground">{fa(total)}</span> محصول
              {pageCount > 1 && (
                <span className="hidden sm:inline">
                  {' '}
                  · صفحه {fa(filters.page)} از {fa(pageCount)}
                </span>
              )}
            </p>
          </div>

          {chips.length > 0 && (
            <div className="mb-4 flex flex-wrap items-center gap-2">
              {chips.map((c) => (
                <Link
                  key={c.label}
                  href={c.remove}
                  aria-label={`حذف فیلتر ${c.label}`}
                  className="inline-flex h-9 max-w-full items-center rounded-full border border-primary/40 bg-primary/10 px-3 text-xs font-semibold text-primary transition-colors hover:bg-primary/20"
                >
                  <span className="truncate">{c.label}</span>
                  {/* Kept as text (leading space included): e2e looks for "<label> ✕" */}
                  <span aria-hidden className="ms-1.5 text-[11px]">{' ✕'}</span>
                </Link>
              ))}
              {chips.length > 1 && (
                <Link href={clearHref} className="inline-flex h-9 items-center px-2 text-xs text-muted-foreground hover:text-primary">
                  حذف همه
                </Link>
              )}
            </div>
          )}

          {products.length === 0 ? (
            <EmptyResults query={filters.q} filtered={chips.length > 0} basePath={basePath} />
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 xl:grid-cols-4">
              {products.map((p, i) => (
                <ProductCard key={p.id} product={p} priority={i < 4} />
              ))}
            </div>
          )}

          <Pagination page={filters.page} pageCount={pageCount} hrefFor={(n) => href({}, n)} />
        </section>
      </div>
    </div>
  );
}

/** No results: echo the query and offer a way out (all products, or ask the clinic). */
async function EmptyResults({ query, filtered, basePath }: { query: string; filtered: boolean; basePath: string }) {
  const nap = await getClinicNAP();
  const contact = nap.whatsappLink ? (
    <a href={nap.whatsappLink} target="_blank" rel="noopener noreferrer" className="btn btn-outline">
      پرسش در واتس‌اپ
    </a>
  ) : (
    <a href={nap.telLink} className="btn btn-outline">
      تماس با کلینیک
    </a>
  );

  return (
    <EmptyState
      variant="card"
      icon={
        <svg className="h-7 w-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <circle cx="11" cy="11" r="6.5" />
          <path d="m20 20-4.2-4.2M8.8 11h4.4" />
        </svg>
      }
      title={query ? `برای «${query}» محصولی پیدا نشد` : 'محصولی با این مشخصات پیدا نشد'}
      description={
        query
          ? 'املای عبارت را بررسی کنید، نام برند یا نوع محصول را کوتاه‌تر بنویسید یا از کارشناسان کلینیک بپرسید؛ شاید همین حالا در قفسه داشته باشیم.'
          : filtered
            ? 'با این فیلترها چیزی نمانده است. چند فیلتر را بردارید یا از کارشناسان کلینیک بپرسید.'
            : 'این بخش به‌زودی تکمیل می‌شود. تا آن زمان می‌توانید از کارشناسان کلینیک بپرسید.'
      }
      action={
        <Link href="/shop" className="btn btn-gold">
          مشاهده همه محصولات
        </Link>
      }
      secondaryAction={contact}
    >
      {filtered && basePath !== '/shop' && (
        <Link href={basePath} className="mt-4 text-sm font-semibold text-primary hover:underline">
          حذف فیلترها در همین بخش
        </Link>
      )}
    </EmptyState>
  );
}

function FacetNav({
  title,
  items,
  activeId,
  pathFor,
}: {
  title: string;
  items: FacetLink[];
  activeId?: string;
  pathFor: (slug: string) => string;
}) {
  return (
    <nav aria-label={title} className="rounded-2xl border border-border bg-surface-card p-4">
      <h2 className="mb-2 text-sm font-bold">{title}</h2>
      <ul className="scrollbar-thin -mx-1 max-h-80 space-y-0.5 overflow-y-auto px-1 text-sm">
        {items.map((c) => (
          <li key={c.id}>
            <Link
              href={pathFor(c.slugFa)}
              aria-current={c.id === activeId ? 'page' : undefined}
              className={`flex min-h-10 items-center justify-between gap-2 rounded-lg px-2.5 py-1.5 -outline-offset-2 transition-colors hover:bg-surface-hover ${
                c.id === activeId ? 'bg-surface-hover font-bold text-primary' : 'text-foreground/85'
              }`}
            >
              <span>{c.nameFa}</span>
              <span className="text-xs text-muted-foreground">{fa(c.count)}</span>
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

const PET_OPTIONS = [
  ['', 'همه'],
  ['cat', 'گربه'],
  ['dog', 'سگ'],
] as const;

/** Filters as a plain GET form: keeps URLs shareable and needs no client state. */
function FilterForm({
  id,
  basePath,
  filters,
  showPetFilter,
  inSheet = false,
}: {
  id: string;
  basePath: string;
  filters: ShopFilters;
  showPetFilter: boolean;
  /** Inside the mobile sheet the submit button lives in the sheet footer. */
  inSheet?: boolean;
}) {
  return (
    <form id={id} action={basePath} method="get" className={`space-y-5 text-sm ${inSheet ? '' : 'px-4 pb-4'}`}>
      <div>
        <label htmlFor={`${id}-q`} className={inSheet ? 'field-label' : 'sr-only'}>
          جستجو در محصولات
        </label>
        <input
          id={`${id}-q`}
          type="search"
          name="q"
          defaultValue={filters.q}
          placeholder="نام محصول یا برند…"
          enterKeyHint="search"
          className="field"
        />
      </div>

      {showPetFilter && (
        <fieldset>
          <legend className="mb-2 font-semibold">مناسب برای</legend>
          <div className="grid grid-cols-3 gap-2">
            {PET_OPTIONS.map(([v, l]) => (
              <label key={v} className="relative cursor-pointer">
                <input
                  type="radio"
                  name="pet"
                  value={v}
                  defaultChecked={(filters.pet ?? '') === v}
                  className="peer absolute inset-0 h-full w-full cursor-pointer opacity-0"
                />
                <span className="flex h-11 items-center justify-center rounded-xl border border-border bg-input font-semibold transition-colors peer-checked:border-primary peer-checked:bg-primary/10 peer-checked:text-primary peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-primary">
                  {l}
                </span>
              </label>
            ))}
          </div>
        </fieldset>
      )}

      <fieldset>
        <legend className="mb-2 font-semibold">
          محدوده قیمت <span className="text-xs font-normal text-muted-foreground">(تومان)</span>
        </legend>
        <div className="flex items-center gap-2">
          <label htmlFor={`${id}-min`} className="sr-only">
            حداقل قیمت به تومان
          </label>
          <input
            id={`${id}-min`}
            name="min"
            inputMode="numeric"
            autoComplete="off"
            defaultValue={filters.min ?? ''}
            placeholder="از"
            className="field min-w-0 flex-1"
          />
          <span aria-hidden className="text-muted-foreground">
            –
          </span>
          <label htmlFor={`${id}-max`} className="sr-only">
            حداکثر قیمت به تومان
          </label>
          <input
            id={`${id}-max`}
            name="max"
            inputMode="numeric"
            autoComplete="off"
            defaultValue={filters.max ?? ''}
            placeholder="تا"
            className="field min-w-0 flex-1"
          />
        </div>
        <p className="field-hint mt-1.5 text-xs text-muted-foreground">مبلغ را به تومان و با ارقام انگلیسی وارد کنید.</p>
      </fieldset>

      <label className="flex min-h-11 cursor-pointer items-center gap-3 font-semibold">
        <input type="checkbox" name="stock" value="1" defaultChecked={filters.inStock} className="h-5 w-5 shrink-0 accent-primary" />
        فقط کالاهای موجود
      </label>

      {filters.sort !== 'popular' && <input type="hidden" name="sort" value={filters.sort} />}
      {!inSheet && (
        <button type="submit" className="btn btn-gold btn-block">
          اعمال فیلتر
        </button>
      )}
    </form>
  );
}
