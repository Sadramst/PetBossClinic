/** Pure bulk price arithmetic for the admin product list. */
export type PriceAdjust = { mode: 'percent' | 'amount'; value: number; round?: number }

export const MAX_PRICE = 1_000_000_000

/** New price for one product, or null when the result is not a valid positive price. */
export function adjustPrice(price: number, a: PriceAdjust): number | null {
  if (!Number.isFinite(price) || !Number.isFinite(a.value)) return null
  const raw = a.mode === 'percent' ? price * (1 + a.value / 100) : price + a.value
  const step = a.round && a.round > 1 ? a.round : 1
  const next = Math.round(raw / step) * step
  if (!Number.isInteger(next) || next < 1 || next > MAX_PRICE) return null
  return next
}

export type PricePreviewRow = { id: string; name: string; before: number; after: number | null }

export function previewPriceAdjust(rows: { id: string; name: string; price: number }[], a: PriceAdjust): PricePreviewRow[] {
  return rows.map((r) => ({ id: r.id, name: r.name, before: r.price, after: adjustPrice(r.price, a) }))
}

/** Persian error for an invalid adjustment, or null. */
export function validatePriceAdjust(a: PriceAdjust): string | null {
  if (!Number.isFinite(a.value) || a.value === 0) return 'مقدار تغییر را وارد کنید.'
  if (a.mode === 'percent' && (a.value < -90 || a.value > 300)) return 'درصد تغییر باید بین ۹۰- و ۳۰۰ باشد.'
  if (a.mode === 'amount' && Math.abs(a.value) > MAX_PRICE) return 'مبلغ تغییر بیش از حد مجاز است.'
  return null
}
