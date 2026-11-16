'use client';

import { useEffect } from 'react';
import { useCart } from '@/components/shop/cart-provider';

/** Empties the browser cart once an order is confirmed. */
export function ClearCartOnSuccess() {
  const { clear, ready } = useCart();
  useEffect(() => {
    if (ready) clear();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);
  return null;
}
