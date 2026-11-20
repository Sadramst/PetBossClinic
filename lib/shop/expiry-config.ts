import 'server-only';
import { db } from '@/lib/db';
import type { ExpiryConfigValues } from '@/lib/shop/expiry';
import { sanitizeExpiryConfig } from '@/lib/shop/expiry-config-core';

export { sanitizeExpiryConfig };

const TTL_MS = 60_000;
let cache: { at: number; value: ExpiryConfigValues } | null = null;

/** Thresholds from the `ExpiryConfig` singleton (60 s cache); defaults when the row or table is missing. */
export async function getExpiryConfig(): Promise<ExpiryConfigValues> {
  if (cache && Date.now() - cache.at < TTL_MS) return cache.value;
  let value: ExpiryConfigValues;
  try {
    const row = await db.expiryConfig.findUnique({ where: { id: 'default' } });
    value = sanitizeExpiryConfig(row);
  } catch {
    value = sanitizeExpiryConfig(null);
  }
  cache = { at: Date.now(), value };
  return value;
}

export function clearExpiryConfigCache() {
  cache = null;
}
