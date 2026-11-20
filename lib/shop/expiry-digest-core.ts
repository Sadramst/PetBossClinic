import { daysUntil, expiryState, type ExpiryConfigValues, type ExpiryState } from '@/lib/shop/expiry';

export type DigestBatch = { productName: string; quantity: number; expiryDate: Date | null };
export type Digest = {
  counts: Record<'expired' | 'critical' | 'soon' | 'undated', number>;
  top: { productName: string; quantity: number; daysLeft: number; state: ExpiryState }[];
  shouldNotify: boolean;
};

/** Counts per state over batches that still hold stock, plus the 10 most urgent dated ones. */
export function buildDigest(batches: DigestBatch[], cfg: Partial<ExpiryConfigValues>, now: Date = new Date()): Digest {
  const counts = { expired: 0, critical: 0, soon: 0, undated: 0 };
  const urgent: Digest['top'] = [];
  for (const b of batches) {
    if (b.quantity <= 0) continue;
    const state = expiryState(b.expiryDate, cfg, now);
    if (state === 'none') counts.undated++;
    else if (state !== 'ok') {
      counts[state]++;
      urgent.push({ productName: b.productName, quantity: b.quantity, daysLeft: daysUntil(b.expiryDate as Date, now), state });
    }
  }
  urgent.sort((a, b) => a.daysLeft - b.daysLeft);
  return { counts, top: urgent.slice(0, 10), shouldNotify: counts.expired + counts.critical > 0 };
}

export function digestText(d: Digest): { title: string; body: string } {
  const fa = (n: number) => n.toLocaleString('fa-IR');
  const { expired, critical, soon } = d.counts;
  return {
    title: `هشدار انقضا: ${fa(expired)} منقضی، ${fa(critical)} نزدیک انقضا`,
    body:
      `منقضی‌شده ${fa(expired)}، کمتر از آستانه بحرانی ${fa(critical)}، در آستانه هشدار ${fa(soon)}. ` +
      d.top.slice(0, 3).map((t) => t.productName).join('، '),
  };
}
