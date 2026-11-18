'use client';

import { useEffect, useRef } from 'react';
import { useCart } from '@/components/shop/cart-provider';

function alreadyCleared(key: string): boolean {
  try {
    return sessionStorage.getItem(key) === '1';
  } catch {
    return false;
  }
}

function markCleared(key: string) {
  try {
    sessionStorage.setItem(key, '1');
  } catch {
    /* storage unavailable: the in-memory flag below still stops repeats on this page */
  }
}

/**
 * Removes the just-ordered products from the browser cart once an order is confirmed.
 * Runs once per order and per tab, and only touches lines that were part of the order,
 * so coming back to this URL later never empties a newer cart.
 */
export function ClearCartOnSuccess({ orderNumber, productIds }: { orderNumber: string; productIds: string[] }) {
  const { lines, ready, clear, remove } = useCart();
  const done = useRef(false);
  const storageKey = `pb_cleared_${orderNumber}`;

  useEffect(() => {
    if (!ready || done.current) return;
    if (alreadyCleared(storageKey)) {
      done.current = true;
      return;
    }
    const ordered = new Set(productIds);
    const mine = lines.filter((l) => ordered.has(l.productId));
    if (mine.length === 0) {
      done.current = true;
      markCleared(storageKey);
    } else if (mine.length === lines.length) {
      done.current = true;
      markCleared(storageKey);
      clear();
    } else {
      // The cart also holds newer items: drop the ordered lines one per render
      // (the cart API removes a single line at a time).
      remove(mine[0].productId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, lines]);

  return null;
}
