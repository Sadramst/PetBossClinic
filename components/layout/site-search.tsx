'use client';

import { useEffect, useRef, useState } from 'react';
import { Link, usePathname, useRouter } from '@/i18n/routing';
import { formatPrice } from '@/lib/format/price';

/**
 * Contract of GET /api/search/suggest?q=… (every field optional, so the box
 * keeps working as a plain form when the endpoint is missing or fails).
 */
interface SuggestResponse {
  products?: { name: string; href: string; price?: number | null; image?: string | null }[];
  categories?: { name: string; href: string }[];
  brands?: { name: string; href: string }[];
}

interface Option {
  key: string;
  href: string;
  label: string;
  kind: 'product' | 'category' | 'brand' | 'all';
  price?: number | null;
  image?: string | null;
}

const MIN_CHARS = 2;
const MAX_CHARS = 80;
const DEBOUNCE_MS = 250;
const KIND_LABEL: Record<Option['kind'], string> = { product: '', category: 'دسته‌بندی', brand: 'برند', all: '' };

/** Set once the endpoint answers 404, so a shop without it never asks again. */
let suggestUnavailable = false;

function isInternalPath(href: unknown): href is string {
  return typeof href === 'string' && href.startsWith('/') && !href.startsWith('//');
}

function toOptions(data: SuggestResponse, q: string): Option[] {
  const out: Option[] = [];
  for (const p of Array.isArray(data.products) ? data.products.slice(0, 6) : []) {
    if (p && typeof p.name === 'string' && isInternalPath(p.href)) {
      out.push({
        key: `p:${p.href}`,
        href: p.href,
        label: p.name,
        kind: 'product',
        price: typeof p.price === 'number' ? p.price : null,
        image: typeof p.image === 'string' ? p.image : null,
      });
    }
  }
  for (const c of Array.isArray(data.categories) ? data.categories.slice(0, 3) : []) {
    if (c && typeof c.name === 'string' && isInternalPath(c.href)) {
      out.push({ key: `c:${c.href}`, href: c.href, label: c.name, kind: 'category' });
    }
  }
  for (const b of Array.isArray(data.brands) ? data.brands.slice(0, 3) : []) {
    if (b && typeof b.name === 'string' && isInternalPath(b.href)) {
      out.push({ key: `b:${b.href}`, href: b.href, label: b.name, kind: 'brand' });
    }
  }
  if (out.length > 0) {
    out.push({ key: 'all', href: `/shop?q=${encodeURIComponent(q)}`, label: `مشاهده همه نتایج «${q}»`, kind: 'all' });
  }
  return out;
}

/**
 * Product search box. A plain GET form to /shop, so it works before hydration;
 * after hydration it adds a clear button and live suggestions.
 */
export function SiteSearch({ id, className = '' }: { id: string; className?: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState('');
  const [options, setOptions] = useState<Option[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const listId = `${id}-listbox`;
  const trimmed = query.trim().slice(0, MAX_CHARS);

  // Any navigation closes the list.
  useEffect(() => setOpen(false), [pathname]);

  useEffect(() => {
    if (suggestUnavailable || trimmed.length < MIN_CHARS) {
      setOptions([]);
      setActive(-1);
      return;
    }
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      try {
        const res = await fetch(`/api/search/suggest?q=${encodeURIComponent(trimmed)}`, {
          signal: controller.signal,
          headers: { accept: 'application/json' },
        });
        if (res.status === 404) suggestUnavailable = true;
        if (!res.ok) return;
        const data = (await res.json()) as SuggestResponse;
        setOptions(toOptions(data ?? {}, trimmed));
        setActive(-1);
        setOpen(true);
      } catch {
        // Aborted or offline: the form still submits normally.
      }
    }, DEBOUNCE_MS);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [trimmed]);

  const expanded = open && options.length > 0;

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      if (expanded) {
        e.preventDefault();
        setOpen(false);
      }
      return;
    }
    if (options.length === 0) return;
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      if (!expanded) {
        setOpen(true);
        return;
      }
      const step = e.key === 'ArrowDown' ? 1 : -1;
      // -1 means "back in the text field".
      setActive((i) => ((i + 1 + step + options.length + 1) % (options.length + 1)) - 1);
    } else if (e.key === 'Enter' && expanded && active >= 0) {
      e.preventDefault();
      setOpen(false);
      router.push(options[active].href);
    }
  };

  const clear = () => {
    if (inputRef.current) inputRef.current.value = '';
    setQuery('');
    setOpen(false);
    inputRef.current?.focus();
  };

  return (
    <form
      action="/shop"
      method="get"
      role="search"
      className={`relative ${className}`}
      onSubmit={() => setOpen(false)}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setOpen(false);
      }}
    >
      <label htmlFor={id} className="sr-only">
        جستجوی محصولات
      </label>
      <input
        ref={inputRef}
        id={id}
        type="search"
        name="q"
        maxLength={MAX_CHARS}
        enterKeyHint="search"
        autoComplete="off"
        placeholder="جستجوی محصول، برند یا دسته…"
        role="combobox"
        aria-expanded={expanded}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={expanded && active >= 0 ? `${listId}-${active}` : undefined}
        onInput={(e) => setQuery(e.currentTarget.value)}
        onFocus={() => options.length > 0 && setOpen(true)}
        onKeyDown={onKeyDown}
        className="h-11 w-full rounded-2xl border border-border bg-input ps-11 pe-11 text-sm transition-colors placeholder:text-muted-foreground hover:border-border-gold lg:h-12 [&::-webkit-search-cancel-button]:hidden"
      />
      <button
        type="submit"
        aria-label="جستجو"
        className="absolute inset-y-0 start-0 flex w-11 items-center justify-center rounded-2xl text-muted-foreground hover:text-primary"
      >
        <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-3.5-3.5" />
        </svg>
      </button>
      {query !== '' && (
        <button
          type="button"
          onClick={clear}
          aria-label="پاک کردن جستجو"
          className="absolute inset-y-0 end-0 flex w-11 items-center justify-center rounded-2xl text-muted-foreground hover:text-foreground"
        >
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden>
            <path d="M6 6l12 12M18 6 6 18" />
          </svg>
        </button>
      )}

      <div
        id={listId}
        role="listbox"
        aria-label="پیشنهادهای جستجو"
        hidden={!expanded}
        // Keep focus in the field so a tap on an option is not swallowed by blur.
        onMouseDown={(e) => e.preventDefault()}
        className="animate-fade-in absolute inset-x-0 top-full z-10 mt-2 max-h-[min(26rem,60dvh)] overflow-y-auto overscroll-contain rounded-2xl border border-border bg-surface-card p-1.5 text-start shadow-2xl"
      >
        {expanded &&
          options.map((o, i) => (
            <Link
              key={o.key}
              id={`${listId}-${i}`}
              href={o.href}
              role="option"
              aria-selected={i === active}
              tabIndex={-1}
              onClick={() => setOpen(false)}
              onMouseEnter={() => setActive(i)}
              className={`flex min-h-12 items-center gap-3 rounded-xl px-2.5 py-1.5 text-sm ${
                i === active ? 'bg-surface-hover' : ''
              } ${o.kind === 'all' ? 'mt-1 justify-center border-t border-border font-bold text-primary' : ''}`}
            >
              {o.kind === 'product' && (
                <span className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-white">
                  {o.image && (
                    // eslint-disable-next-line @next/next/no-img-element -- tiny thumbnails already sized by the suggest endpoint
                    <img src={o.image} alt="" width={40} height={40} loading="lazy" className="h-full w-full object-contain" />
                  )}
                </span>
              )}
              {(o.kind === 'category' || o.kind === 'brand') && (
                <span className="shrink-0 rounded-md border border-border-gold px-1.5 py-0.5 text-[11px] text-primary">
                  {KIND_LABEL[o.kind]}
                </span>
              )}
              <span className={o.kind === 'all' ? '' : 'clamp-2 min-w-0 flex-1 leading-6'}>{o.label}</span>
              {o.kind === 'product' && (
                <span className="shrink-0 text-xs font-bold text-primary">{formatPrice(o.price)}</span>
              )}
            </Link>
          ))}
      </div>
    </form>
  );
}
