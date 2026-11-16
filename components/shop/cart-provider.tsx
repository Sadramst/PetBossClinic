'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { MAX_LINES, MAX_QTY_PER_LINE, type CartLine } from '@/lib/shop/cart-types';

const STORAGE_KEY = 'pb_cart_v1';

interface CartContextValue {
  lines: CartLine[];
  count: number;
  subtotal: number;
  ready: boolean;
  add: (line: Omit<CartLine, 'quantity'>, quantity?: number) => void;
  setQuantity: (productId: string, quantity: number) => void;
  remove: (productId: string) => void;
  clear: () => void;
}

const CartContext = createContext<CartContextValue | null>(null);

function load(): CartLine[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? (JSON.parse(raw) as CartLine[]) : [];
    return Array.isArray(parsed) ? parsed.filter((l) => l && typeof l.productId === 'string' && l.quantity > 0) : [];
  } catch {
    return [];
  }
}

/**
 * Shopping cart kept in the browser so guests can shop before logging in.
 * Only product ids and quantities are trusted: the server re-prices everything at checkout.
 */
export function CartProvider({ children }: { children: React.ReactNode }) {
  const [lines, setLines] = useState<CartLine[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setLines(load());
    setReady(true);
    // Keep several open tabs in sync.
    const onStorage = (e: StorageEvent) => e.key === STORAGE_KEY && setLines(load());
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const persist = useCallback((next: CartLine[]) => {
    setLines(next);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      /* storage unavailable (private mode): cart lives for this page only */
    }
  }, []);

  const value = useMemo<CartContextValue>(() => {
    const clamp = (q: number) => Math.max(1, Math.min(MAX_QTY_PER_LINE, Math.floor(q)));
    return {
      lines,
      ready,
      count: lines.reduce((n, l) => n + l.quantity, 0),
      subtotal: lines.reduce((n, l) => n + l.price * l.quantity, 0),
      add: (line, quantity = 1) => {
        const existing = lines.find((l) => l.productId === line.productId);
        if (existing) {
          persist(lines.map((l) => (l.productId === line.productId ? { ...l, ...line, quantity: clamp(l.quantity + quantity) } : l)));
        } else if (lines.length < MAX_LINES) {
          persist([...lines, { ...line, quantity: clamp(quantity) }]);
        }
      },
      setQuantity: (productId, quantity) =>
        persist(lines.map((l) => (l.productId === productId ? { ...l, quantity: clamp(quantity) } : l))),
      remove: (productId) => persist(lines.filter((l) => l.productId !== productId)),
      clear: () => persist([]),
    };
  }, [lines, ready, persist]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used inside <CartProvider>');
  return ctx;
}
