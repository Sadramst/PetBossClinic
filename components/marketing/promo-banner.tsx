'use client';

import { useEffect, useState } from 'react';
import { Link, usePathname } from '@/i18n/routing';
import { CopyButton } from '@/components/marketing/copy-button';
import { BANNER_KEY, readStore, writeStore } from '@/components/marketing/storage';

export interface BannerConfig {
  text: string;
  link: string | null;
  endsAt: string | null;
  couponCode: string | null;
}

const fa = (n: number) => n.toLocaleString('fa-IR');
const two = (n: number) => fa(n).padStart(2, '۰');

function countdown(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (d > 0) return `${fa(d)} روز و ${fa(h)} ساعت`;
  return `${two(h)}:${two(m)}:${two(s % 60)}`;
}

/** Rendered from server data so it is part of the first paint (no layout shift). */
export function PromoBanner({ banner }: { banner: BannerConfig }) {
  const pathname = usePathname();
  // Key includes the text: a new campaign shows again even after an older one was dismissed.
  const id = `${banner.text}|${banner.endsAt ?? ''}`;
  const [hidden, setHidden] = useState(false);
  const [left, setLeft] = useState<number | null>(null);

  useEffect(() => {
    if (readStore(BANNER_KEY, true) === id) setHidden(true);
  }, [id]);

  useEffect(() => {
    if (!banner.endsAt) return;
    const end = new Date(banner.endsAt).getTime();
    const tick = () => setLeft(end - Date.now());
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [banner.endsAt]);

  if (hidden || pathname.startsWith('/admin') || (left !== null && left <= 0)) return null;

  const content = <span className="text-sm font-bold leading-6">{banner.text}</span>;
  const isExternal = !!banner.link && /^https?:\/\//.test(banner.link);

  return (
    <div data-testid="promo-banner" role="region" aria-label="اطلاعیه فروش" className="relative z-[60] bg-gradient-gold text-charcoal-950 print:hidden">
      <div className="container mx-auto flex min-h-11 max-w-7xl flex-wrap items-center justify-center gap-x-4 gap-y-1 px-12 py-1.5 text-center">
        {banner.link ? (
          isExternal ? (
            <a href={banner.link} target="_blank" rel="noopener noreferrer" className="hover:underline">
              {content}
            </a>
          ) : (
            <Link href={banner.link} className="hover:underline">
              {content}
            </Link>
          )
        ) : (
          content
        )}
        {left !== null && left > 0 && (
          <span className="rounded-lg bg-charcoal-950/15 px-2 py-0.5 text-xs font-black tabular-nums" dir="ltr" aria-label="زمان باقی‌مانده">
            {countdown(left)}
          </span>
        )}
        {banner.couponCode && (
          <span className="flex items-center gap-2">
            <span dir="ltr" className="rounded-lg border border-dashed border-charcoal-950/50 px-2 py-0.5 text-xs font-black tracking-widest">
              {banner.couponCode}
            </span>
            <CopyButton text={banner.couponCode} label="کپی" className="!h-7 !min-h-0 !border-charcoal-950/40 !px-2 !text-charcoal-950" />
          </span>
        )}
      </div>
      <button
        type="button"
        aria-label="بستن اطلاعیه"
        onClick={() => {
          setHidden(true);
          writeStore(BANNER_KEY, id, true);
        }}
        className="absolute end-1 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-lg hover:bg-charcoal-950/10"
      >
        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden>
          <path d="M6 6l12 12M18 6 6 18" />
        </svg>
      </button>
    </div>
  );
}
