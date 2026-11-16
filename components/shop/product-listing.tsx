import { Link } from '@/i18n/routing';
import { ProductCard } from '@/components/shop/product-card';
import { SortSelect } from '@/components/shop/sort-select';
import { Breadcrumbs, type Crumb } from '@/components/shop/breadcrumbs';
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
}

const fa = (n: number) => n.toLocaleString('fa-IR');

export function ProductListing(props: ProductListingProps) {
  const { filters, basePath, products, total, pageCount } = props;
  const href = (f: Partial<ShopFilters>, page?: number) => `${basePath}${filtersToQuery({ ...filters, ...f }, page)}`;
  const sortHrefs = Object.fromEntries(
    (Object.keys(SORT_LABELS) as SortKey[]).map((k) => [k, href({ sort: k }, 1)])
  ) as Record<SortKey, string>;

  const chips: { label: string; remove: string }[] = [];
  if (filters.q) chips.push({ label: `«${filters.q}»`, remove: href({ q: '' }, 1) });
  if (filters.pet) chips.push({ label: filters.pet === 'cat' ? 'گربه' : 'سگ', remove: href({ pet: null }, 1) });
  if (filters.inStock) chips.push({ label: 'فقط موجود', remove: href({ inStock: false }, 1) });
  if (filters.min || filters.max) {
    chips.push({
      label: `قیمت ${filters.min ? `از ${fa(filters.min)}` : ''} ${filters.max ? `تا ${fa(filters.max)}` : ''} تومان`,
      remove: href({ min: null, max: null }, 1),
    });
  }

  return (
    <div className="container mx-auto px-4 py-6 sm:py-8 max-w-7xl">
      <ItemListJsonLd name={props.title} urls={products.map((p) => absoluteUrl(productPath(p.slugFa)))} />
      <Breadcrumbs items={props.breadcrumbs} />

      <header className="mt-4 mb-6">
        <h1 className="text-2xl sm:text-3xl font-extrabold">{props.title}</h1>
        {props.intro && filters.page === 1 && (
          <p className="mt-2 text-sm text-muted-foreground leading-7 max-w-3xl">{props.intro}</p>
        )}
      </header>

      <div className="grid gap-6 lg:grid-cols-[250px_1fr]">
        {/* Desktop sidebar; on phones it moves below the products */}
        <aside className="space-y-4 order-2 lg:order-1">
          <div className="hidden lg:block rounded-2xl border border-border bg-surface-card">
            <h2 className="p-4 pb-3 font-bold">فیلترها</h2>
            <FilterForm basePath={basePath} filters={filters} showPetFilter={props.showPetFilter !== false} />
          </div>

          <FacetNav title="دسته‌بندی‌ها" items={props.categories} activeId={props.activeCategoryId} pathFor={categoryPath} />
          {props.brands.length > 0 && (
            <FacetNav title="برندها" items={props.brands} activeId={props.activeBrandId} pathFor={brandPath} />
          )}
        </aside>

        <section aria-label="محصولات" className="order-1 lg:order-2">
          {/* Phones: filters collapsed above the results */}
          <details className="lg:hidden mb-4 rounded-2xl border border-border bg-surface-card">
            <summary className="cursor-pointer list-none p-4 font-bold flex items-center justify-between">
              فیلتر و جستجو
              <span className="text-xs text-muted-foreground" aria-hidden>▾</span>
            </summary>
            <FilterForm basePath={basePath} filters={filters} showPetFilter={props.showPetFilter !== false} />
          </details>

          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <p className="text-sm text-muted-foreground">{fa(total)} محصول</p>
            <SortSelect value={filters.sort} hrefFor={sortHrefs} />
          </div>

          {chips.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-4">
              {chips.map((c) => (
                <Link
                  key={c.label}
                  href={c.remove}
                  className="text-xs rounded-full border border-primary/40 bg-primary/10 text-primary px-3 py-1 hover:bg-primary/20"
                >
                  {c.label} ✕
                </Link>
              ))}
              <Link href={basePath} className="text-xs text-muted-foreground hover:text-primary px-2 py-1">
                حذف همه
              </Link>
            </div>
          )}

          {products.length === 0 ? (
            <div className="rounded-2xl border border-border bg-surface-card p-10 text-center space-y-3">
              <p className="font-bold">محصولی با این مشخصات پیدا نشد.</p>
              <p className="text-sm text-muted-foreground">عبارت دیگری را امتحان کنید یا از کارشناسان کلینیک بپرسید.</p>
              <Link href="/shop" className="inline-block text-sm text-primary hover:underline">
                مشاهده همه محصولات
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4">
              {products.map((p, i) => (
                <ProductCard key={p.id} product={p} priority={i < 4} />
              ))}
            </div>
          )}

          {pageCount > 1 && <Pagination page={filters.page} pageCount={pageCount} hrefFor={(n) => href({}, n)} />}
        </section>
      </div>
    </div>
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
      <h2 className="text-sm font-bold mb-2">{title}</h2>
      <ul className="space-y-0.5 text-sm max-h-80 overflow-y-auto">
        {items.map((c) => (
          <li key={c.id}>
            <Link
              href={pathFor(c.slugFa)}
              aria-current={c.id === activeId ? 'page' : undefined}
              className={`flex justify-between gap-2 rounded-lg px-2 py-1.5 hover:bg-surface-hover ${
                c.id === activeId ? 'text-primary font-bold bg-surface-hover' : 'text-foreground/85'
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

/** Compact pagination: first, last, and a window around the current page. */
function Pagination({ page, pageCount, hrefFor }: { page: number; pageCount: number; hrefFor: (n: number) => string }) {
  const pages = new Set([1, pageCount, page - 1, page, page + 1].filter((n) => n >= 1 && n <= pageCount));
  const sorted = [...pages].sort((a, b) => a - b);
  return (
    <nav aria-label="صفحه‌بندی" className="mt-8 flex flex-wrap justify-center items-center gap-2">
      {page > 1 && (
        <Link href={hrefFor(page - 1)} rel="prev" className="h-10 px-4 inline-flex items-center rounded-xl border border-border hover:border-primary text-sm">
          قبلی
        </Link>
      )}
      {sorted.map((n, i) => (
        <span key={n} className="flex items-center gap-2">
          {i > 0 && n - sorted[i - 1] > 1 && <span className="text-muted-foreground">…</span>}
          <Link
            href={hrefFor(n)}
            aria-current={n === page ? 'page' : undefined}
            className={`min-w-10 h-10 px-3 inline-flex items-center justify-center rounded-xl border text-sm font-bold ${
              n === page ? 'bg-primary text-charcoal-950 border-primary' : 'border-border hover:border-primary'
            }`}
          >
            {fa(n)}
          </Link>
        </span>
      ))}
      {page < pageCount && (
        <Link href={hrefFor(page + 1)} rel="next" className="h-10 px-4 inline-flex items-center rounded-xl border border-border hover:border-primary text-sm">
          بعدی
        </Link>
      )}
    </nav>
  );
}

/** Filters as a plain GET form: works without JavaScript and keeps URLs shareable. */
function FilterForm({ basePath, filters, showPetFilter }: { basePath: string; filters: ShopFilters; showPetFilter: boolean }) {
  return (
    <form action={basePath} method="get" className="px-4 pb-4 space-y-4 text-sm">
      <input
        type="search"
        name="q"
        defaultValue={filters.q}
        placeholder="جستجو در محصولات…"
        className="w-full rounded-xl border border-border bg-input px-3 py-2.5"
      />
      {showPetFilter && (
        <fieldset className="space-y-1.5">
          <legend className="font-semibold mb-1">مناسب برای</legend>
          {[
            ['', 'همه'],
            ['cat', 'گربه'],
            ['dog', 'سگ'],
          ].map(([v, l]) => (
            <label key={v} className="flex items-center gap-2">
              <input type="radio" name="pet" value={v} defaultChecked={(filters.pet ?? '') === v} />
              {l}
            </label>
          ))}
        </fieldset>
      )}
      <fieldset className="space-y-1.5">
        <legend className="font-semibold mb-1">محدوده قیمت (تومان)</legend>
        <div className="flex gap-2">
          <input name="min" inputMode="numeric" defaultValue={filters.min ?? ''} placeholder="از" className="w-1/2 rounded-xl border border-border bg-input px-3 py-2" />
          <input name="max" inputMode="numeric" defaultValue={filters.max ?? ''} placeholder="تا" className="w-1/2 rounded-xl border border-border bg-input px-3 py-2" />
        </div>
      </fieldset>
      <label className="flex items-center gap-2">
        <input type="checkbox" name="stock" value="1" defaultChecked={filters.inStock} />
        فقط کالاهای موجود
      </label>
      {filters.sort !== 'popular' && <input type="hidden" name="sort" value={filters.sort} />}
      <button type="submit" className="w-full rounded-xl bg-gradient-gold text-charcoal-950 font-bold py-2.5">
        اعمال فیلتر
      </button>
    </form>
  );
}
