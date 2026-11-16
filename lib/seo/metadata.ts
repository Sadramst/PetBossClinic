import type { Metadata } from 'next';
import { SITE_NAME_LONG_FA, SITE_OG_IMAGE, absoluteUrl } from './site';

/**
 * Shared, deterministic metadata builder for every public page.
 *
 * Why this exists: Next.js merges the locale layout's `alternates.canonical`
 * into any page that does not set one, which made 404s and account pages claim
 * to be the homepage, and the title template appended the brand to titles that
 * already contained it (92–100 character titles with the brand twice). Every
 * public page now goes through this helper instead.
 */

/** Google truncates descriptions around 155–160 characters. */
export const MAX_DESCRIPTION = 160;
/** Google truncates titles around 600px; ~70 Persian characters is a safe cap. */
export const MAX_TITLE = 70;

/** Collapse whitespace and cut at a natural word/punctuation boundary. */
export function clampText(input: string, max: number): string {
  const clean = input.replace(/\s+/g, ' ').trim();
  if (clean.length <= max) return clean;

  const slice = clean.slice(0, max - 1);
  const boundary = Math.max(
    slice.lastIndexOf(' '),
    slice.lastIndexOf('،'),
    slice.lastIndexOf('؛'),
    slice.lastIndexOf('.'),
    slice.lastIndexOf(':'),
    slice.lastIndexOf('|')
  );
  const cut = boundary > max * 0.5 ? slice.slice(0, boundary) : slice;
  return `${cut.replace(/[\s،؛.,:|!?…-]+$/u, '')}…`;
}

export function clampDescription(input: string, max = MAX_DESCRIPTION): string {
  return clampText(input, max);
}

export function clampTitle(input: string, max = MAX_TITLE): string {
  return clampText(input, max);
}

/** `خرید <name> | قیمت و مشخصات | پت‌باس` — the product name is truncated, never the brand. */
export function productSeoTitle(name: string): string {
  const prefix = 'خرید ';
  const suffix = ' | قیمت و مشخصات | پت‌باس';
  const room = Math.max(16, MAX_TITLE - prefix.length - suffix.length);
  return `${prefix}${clampText(name, room)}${suffix}`;
}

export function categorySeoTitle(name: string): string {
  const prefix = 'خرید ';
  const suffix = ' | قیمت و بهترین برندها | پت‌باس';
  const room = Math.max(16, MAX_TITLE - prefix.length - suffix.length);
  return `${prefix}${clampText(name, room)}${suffix}`;
}

export function brandSeoTitle(name: string): string {
  const prefix = 'خرید محصولات ';
  const suffix = ' | قیمت و اصالت | پت‌باس';
  const room = Math.max(16, MAX_TITLE - prefix.length - suffix.length);
  return `${prefix}${clampText(name, room)}${suffix}`;
}

export function postSeoTitle(title: string): string {
  const suffix = ' | مجله پت‌باس';
  return `${clampText(title, MAX_TITLE - suffix.length)}${suffix}`;
}

export interface PageMetadataOptions {
  title: string;
  description: string;
  /** Site-relative path used for the canonical URL, e.g. `/shop` or `/`. */
  path: string;
  image?: string | null;
  imageAlt?: string;
  type?: 'website' | 'article';
  noindex?: boolean;
  /** Only matters when noindex is true; filtered listings stay `follow`. */
  follow?: boolean;
  /** Absolute or site-relative override (product/category/blog custom canonicals). */
  canonical?: string | null;
  publishedTime?: string;
  modifiedTime?: string;
  keywords?: string[];
}

export function pageMetadata(opts: PageMetadataOptions): Metadata {
  const canonical = absoluteUrl(opts.canonical || opts.path);
  const title = clampTitle(opts.title);
  const description = clampDescription(opts.description);
  const image =
    opts.image && !opts.image.startsWith('data:') ? absoluteUrl(opts.image) : absoluteUrl(SITE_OG_IMAGE);

  const shared = {
    locale: 'fa_IR' as const,
    siteName: SITE_NAME_LONG_FA,
    url: canonical,
    title,
    description,
    images: [{ url: image, width: 1200, height: 630, alt: opts.imageAlt ?? title }],
  };

  const openGraph: Metadata['openGraph'] =
    opts.type === 'article'
      ? {
          type: 'article',
          ...shared,
          ...(opts.publishedTime && { publishedTime: opts.publishedTime }),
          ...(opts.modifiedTime && { modifiedTime: opts.modifiedTime }),
        }
      : { type: 'website', ...shared };

  return {
    title: { absolute: title },
    ...(opts.keywords?.length && { keywords: opts.keywords }),
    description,
    alternates: { canonical },
    robots: opts.noindex ? { index: false, follow: opts.follow ?? true } : undefined,
    openGraph,
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [image],
    },
  };
}
