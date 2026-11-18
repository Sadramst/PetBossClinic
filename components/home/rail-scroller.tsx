'use client';

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';

/**
 * Horizontal snap rail with previous/next buttons on desktop.
 * The <li> children are rendered on the server; this only adds the scroll controls.
 * Touch devices keep native swipe (the buttons are hidden below lg).
 */
export function RailScroller({
  children,
  label,
  className = '',
}: {
  children: ReactNode;
  /** Accessible name of the list, e.g. the section title. */
  label: string;
  className?: string;
}) {
  const ref = useRef<HTMLUListElement>(null);
  const [edges, setEdges] = useState({ atStart: true, atEnd: true });

  const measure = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    // scrollLeft is negative in RTL, so compare absolute distances.
    const pos = Math.abs(el.scrollLeft);
    const max = el.scrollWidth - el.clientWidth;
    const next = { atStart: pos < 8, atEnd: pos > max - 8 };
    setEdges((prev) => (prev.atStart === next.atStart && prev.atEnd === next.atEnd ? prev : next));
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    measure();
    el.addEventListener('scroll', measure, { passive: true });
    window.addEventListener('resize', measure);
    return () => {
      el.removeEventListener('scroll', measure);
      window.removeEventListener('resize', measure);
    };
  }, [measure]);

  const move = (forward: boolean) => {
    const el = ref.current;
    if (!el) return;
    const rtl = getComputedStyle(el).direction === 'rtl';
    const step = el.clientWidth * 0.8 * (forward ? 1 : -1) * (rtl ? -1 : 1);
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    el.scrollBy({ left: step, behavior: reduce ? 'auto' : 'smooth' });
  };

  const btn =
    'absolute top-1/2 z-10 hidden h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-border-gold bg-surface-card text-primary shadow-gold transition-opacity hover:bg-surface-elevated disabled:pointer-events-none disabled:opacity-0 lg:flex';

  return (
    <div className="relative">
      <ul ref={ref} aria-label={label} className={className}>
        {children}
      </ul>
      <button
        type="button"
        aria-label={`قبلی: ${label}`}
        disabled={edges.atStart}
        onClick={() => move(false)}
        className={`${btn} -start-4`}
      >
        <svg className="h-5 w-5 ltr:rotate-180" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="m9 6 6 6-6 6" />
        </svg>
      </button>
      <button
        type="button"
        aria-label={`بعدی: ${label}`}
        disabled={edges.atEnd}
        onClick={() => move(true)}
        className={`${btn} -end-4`}
      >
        <svg className="h-5 w-5 ltr:rotate-180" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="m15 6-6 6 6 6" />
        </svg>
      </button>
    </div>
  );
}
