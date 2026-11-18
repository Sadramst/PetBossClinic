'use client';

import { useCallback, useRef, useState } from 'react';
import Image from 'next/image';
import { Dialog } from '@/components/ui/dialog';

const fa = (n: number) => n.toLocaleString('fa-IR');

function Chevron({ className = '' }: { className?: string }) {
  // Points to the right; mirrored where needed.
  return (
    <svg className={`h-5 w-5 ${className}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="m9 6 6 6-6 6" />
    </svg>
  );
}

const arrowBtn =
  'absolute top-1/2 z-10 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-border bg-surface/90 text-foreground shadow-lg backdrop-blur transition-colors hover:border-primary hover:text-primary disabled:pointer-events-none disabled:opacity-0';

/**
 * Product gallery: a swipeable (CSS scroll-snap) strip of all images, with
 * thumbnail buttons, arrows, a counter and a larger view in a dialog.
 * The first image is server-rendered with `priority` and the product name as alt.
 */
export function ProductGallery({ images, name }: { images: string[]; name: string }) {
  const strip = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);
  const [zoomed, setZoomed] = useState(false);
  const count = images.length;
  const many = count > 1;
  const altFor = (i: number) => (i === 0 ? name : `${name} - تصویر ${fa(i + 1)}`);

  const goTo = useCallback(
    (index: number) => {
      const i = Math.max(0, Math.min(count - 1, index));
      setActive(i);
      const el = strip.current;
      if (!el) return;
      const rtl = getComputedStyle(el).direction === 'rtl';
      const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      el.scrollTo({ left: (rtl ? -1 : 1) * i * el.clientWidth, behavior: reduce ? 'auto' : 'smooth' });
    },
    [count]
  );

  const onScroll = () => {
    const el = strip.current;
    if (!el || el.clientWidth === 0) return;
    const i = Math.round(Math.abs(el.scrollLeft) / el.clientWidth);
    if (i !== active && i >= 0 && i < count) setActive(i);
  };

  /** Arrow keys follow the reading direction: in RTL the next image is on the left. */
  const onKeyDown = (e: React.KeyboardEvent<HTMLElement>) => {
    if (!many) return;
    const rtl = getComputedStyle(e.currentTarget).direction === 'rtl';
    let next = active;
    if (e.key === 'ArrowLeft') next = active + (rtl ? 1 : -1);
    else if (e.key === 'ArrowRight') next = active + (rtl ? -1 : 1);
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = count - 1;
    else return;
    e.preventDefault();
    goTo(next);
  };

  return (
    <div className="space-y-3">
      <div className="relative">
        <div
          ref={strip}
          onScroll={onScroll}
          onKeyDown={onKeyDown}
          role="group"
          aria-roledescription="گالری"
          aria-label={`تصاویر ${name}`}
          className="scrollbar-none flex aspect-square snap-x snap-mandatory overflow-x-auto overscroll-x-contain rounded-3xl border border-border bg-white"
        >
          {images.map((src, i) => (
            <button
              key={src}
              type="button"
              onClick={() => setZoomed(true)}
              tabIndex={i === active ? 0 : -1}
              className="relative h-full w-full flex-none cursor-zoom-in snap-center focus-visible:-outline-offset-4"
            >
              <Image
                src={src}
                alt={altFor(i)}
                fill
                priority={i === 0}
                sizes="(max-width: 1024px) 100vw, 560px"
                className="object-contain p-2"
              />
              <span className="sr-only">، بزرگ‌نمایی تصویر</span>
            </button>
          ))}
        </div>

        {many && (
          <>
            <button
              type="button"
              onClick={() => goTo(active - 1)}
              disabled={active === 0}
              aria-label="تصویر قبلی"
              className={`${arrowBtn} start-2 hidden sm:flex`}
            >
              <Chevron className="ltr:rotate-180" />
            </button>
            <button
              type="button"
              onClick={() => goTo(active + 1)}
              disabled={active === count - 1}
              aria-label="تصویر بعدی"
              className={`${arrowBtn} end-2 hidden sm:flex`}
            >
              <Chevron className="rtl:rotate-180" />
            </button>
            <span className="pointer-events-none absolute bottom-3 start-3 rounded-full bg-charcoal-950/75 px-2.5 py-0.5 text-xs font-bold text-white" aria-hidden>
              {fa(active + 1)} / {fa(count)}
            </span>
          </>
        )}
        <span className="pointer-events-none absolute bottom-3 end-3 flex h-9 w-9 items-center justify-center rounded-full bg-charcoal-950/75 text-white" aria-hidden>
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" />
          </svg>
        </span>
      </div>

      {many && (
        <>
          {/* Phones: dots (swipe is the main gesture) */}
          <div className="flex justify-center gap-1.5 sm:hidden" aria-hidden>
            {images.map((src, i) => (
              <span
                key={src}
                className={`h-1.5 rounded-full transition-all ${i === active ? 'w-5 bg-primary' : 'w-1.5 bg-border'}`}
              />
            ))}
          </div>
          {/* Larger screens: thumbnails */}
          <div className="scrollbar-thin hidden gap-2 overflow-x-auto p-1 sm:flex">
            {images.map((src, i) => (
              <button
                key={src}
                type="button"
                onClick={() => goTo(i)}
                aria-label={`نمایش تصویر ${fa(i + 1)}`}
                aria-current={i === active ? 'true' : undefined}
                className={`relative h-[4.5rem] w-[4.5rem] flex-none overflow-hidden rounded-xl border-2 bg-white transition-colors ${
                  i === active ? 'border-primary shadow-gold' : 'border-border opacity-80 hover:border-primary/60 hover:opacity-100'
                }`}
              >
                <Image src={src} alt="" fill sizes="(max-width: 1024px) 22vw, 120px" className="object-contain p-0.5" />
              </button>
            ))}
          </div>
        </>
      )}

      <Dialog open={zoomed} onClose={() => setZoomed(false)} title={name} size="lg">
        <div className="relative" onKeyDown={onKeyDown}>
          <div className="relative aspect-square overflow-hidden rounded-xl bg-white">
            <Image
              key={images[active]}
              src={images[active]}
              alt={altFor(active)}
              fill
              sizes="(max-width: 720px) 100vw, 672px"
              className="object-contain"
            />
          </div>
          {many && (
            <>
              <button
                type="button"
                onClick={() => goTo(active - 1)}
                disabled={active === 0}
                aria-label="تصویر قبلی"
                className={`${arrowBtn} start-2`}
              >
                <Chevron className="ltr:rotate-180" />
              </button>
              <button
                type="button"
                data-autofocus
                onClick={() => goTo(active + 1)}
                disabled={active === count - 1}
                aria-label="تصویر بعدی"
                className={`${arrowBtn} end-2`}
              >
                <Chevron className="rtl:rotate-180" />
              </button>
              <p className="mt-3 text-center text-xs font-bold text-muted-foreground" aria-live="polite">
                تصویر {fa(active + 1)} از {fa(count)}
              </p>
            </>
          )}
        </div>
      </Dialog>
    </div>
  );
}
