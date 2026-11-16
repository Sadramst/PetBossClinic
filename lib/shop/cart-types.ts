/** Client cart line: only id + quantity are trusted; everything else is display cache. */
export interface CartLine {
  productId: string;
  quantity: number;
  /** Display snapshot (re-priced on the server at checkout) */
  name: string;
  slug: string;
  price: number;
  image: string;
}

export const MAX_QTY_PER_LINE = 20;
export const MAX_LINES = 50;

/** Merges/clamps raw input from the browser into a safe list of { productId, quantity }. */
export function sanitizeCartInput(raw: unknown): { productId: string; quantity: number }[] {
  if (!Array.isArray(raw)) return [];
  const merged = new Map<string, number>();
  for (const item of raw.slice(0, MAX_LINES * 2)) {
    if (!item || typeof item !== 'object') continue;
    const { productId, quantity } = item as { productId?: unknown; quantity?: unknown };
    if (typeof productId !== 'string' || !/^[a-z0-9]{10,40}$/i.test(productId)) continue;
    const q = Math.floor(Number(quantity));
    if (!Number.isFinite(q) || q < 1) continue;
    merged.set(productId, Math.min(MAX_QTY_PER_LINE, (merged.get(productId) ?? 0) + q));
  }
  return [...merged].slice(0, MAX_LINES).map(([productId, quantity]) => ({ productId, quantity }));
}
