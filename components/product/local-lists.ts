'use client';

import { useMemo, useSyncExternalStore } from 'react';

/** Display snapshot of a product kept in the browser (recently viewed / favourites). */
export interface LocalProduct {
  productId: string;
  slug: string;
  name: string;
  image: string;
  price: number;
}

export type LocalListName = 'recent' | 'favorites';

const KEYS: Record<LocalListName, string> = {
  recent: 'pb_recent_v1',
  favorites: 'pb_favorites_v1',
};
const LIMITS: Record<LocalListName, number> = { recent: 12, favorites: 48 };
const EVENT = 'pb-local-list';

function isValid(p: unknown): p is LocalProduct {
  if (!p || typeof p !== 'object') return false;
  const v = p as Record<string, unknown>;
  return (
    typeof v.productId === 'string' &&
    typeof v.slug === 'string' &&
    v.slug.length > 0 &&
    typeof v.name === 'string' &&
    typeof v.image === 'string' &&
    // Only site-relative images: anything else could break next/image.
    v.image.startsWith('/') &&
    !v.image.startsWith('//') &&
    typeof v.price === 'number' &&
    Number.isFinite(v.price)
  );
}

function parse(raw: string): LocalProduct[] {
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter(isValid) : [];
  } catch {
    return [];
  }
}

function readRaw(name: LocalListName): string {
  try {
    return localStorage.getItem(KEYS[name]) ?? '';
  } catch {
    return '';
  }
}

function write(name: LocalListName, items: LocalProduct[]) {
  try {
    localStorage.setItem(KEYS[name], JSON.stringify(items.slice(0, LIMITS[name])));
  } catch {
    /* storage unavailable (private mode): nothing is remembered */
  }
  window.dispatchEvent(new Event(EVENT));
}

function snapshot(p: LocalProduct): LocalProduct {
  return { productId: p.productId, slug: p.slug, name: p.name, image: p.image, price: p.price };
}

/** Puts the product first in the list (used for "recently viewed"). */
export function pushLocalProduct(name: LocalListName, product: LocalProduct) {
  const rest = parse(readRaw(name)).filter((p) => p.productId !== product.productId);
  write(name, [snapshot(product), ...rest]);
}

/** Adds or removes the product; returns true when it is in the list afterwards. */
export function toggleLocalProduct(name: LocalListName, product: LocalProduct): boolean {
  const current = parse(readRaw(name));
  const exists = current.some((p) => p.productId === product.productId);
  write(name, exists ? current.filter((p) => p.productId !== product.productId) : [snapshot(product), ...current]);
  return !exists;
}

function subscribe(onChange: () => void) {
  window.addEventListener('storage', onChange);
  window.addEventListener(EVENT, onChange);
  return () => {
    window.removeEventListener('storage', onChange);
    window.removeEventListener(EVENT, onChange);
  };
}

/** Live list from localStorage. Empty during server render and hydration. */
export function useLocalProducts(name: LocalListName): LocalProduct[] {
  const raw = useSyncExternalStore(
    subscribe,
    () => readRaw(name),
    () => ''
  );
  return useMemo(() => parse(raw), [raw]);
}
