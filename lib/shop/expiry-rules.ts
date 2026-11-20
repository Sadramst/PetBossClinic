/** Pure rules for expiry settings and batch entry. No server imports, so client forms share them. */
import { parseJalaliInput } from '@/lib/date/jalali'
import { DEFAULT_EXPIRY_CONFIG, type ExpiryConfigValues } from '@/lib/shop/expiry'

export type { ExpiryConfigValues }
export const EXPIRY_CONFIG_DEFAULTS: ExpiryConfigValues = DEFAULT_EXPIRY_CONFIG

/** Returns a Persian error, or null when the values are consistent. */
export function validateExpiryConfig(v: ExpiryConfigValues): string | null {
  const ints = [v.soonDays, v.criticalDays, v.minShelfLifeDays, v.discountStartDays, v.discountPercent]
  if (!ints.every((n) => Number.isInteger(n))) return 'همه مقدارها باید عدد صحیح باشند.'
  if (v.criticalDays < 1 || v.soonDays > 730) return 'بازه‌ها معتبر نیستند.'
  if (v.criticalDays >= v.soonDays) return 'آستانه «بحرانی» باید کمتر از آستانه «نزدیک به انقضا» باشد.'
  if (v.minShelfLifeDays < 0 || v.minShelfLifeDays > v.criticalDays) return 'حداقل ماندگاری برای فروش نباید از آستانه بحرانی بیشتر باشد.'
  if (v.discountStartDays <= v.minShelfLifeDays || v.discountStartDays > v.soonDays) return 'شروع تخفیف باید بعد از حداقل ماندگاری و حداکثر تا آستانه «نزدیک به انقضا» باشد.'
  if (v.discountPercent < 1 || v.discountPercent > 90) return 'درصد تخفیف باید بین ۱ تا ۹۰ باشد.'
  return null
}

export type BatchLineInput = {
  productId: string
  quantity: number
  /** ISO or Jalali text. */
  manufactureDate?: string | null
  expiryDate?: string | null
  batchNumber?: string | null
  location?: string | null
  costPrice?: number | null
  supplier?: string | null
}

export type ParsedBatchLine = {
  productId: string
  quantity: number
  manufactureDate: Date | null
  expiryDate: Date | null
  batchNumber: string | null
  location: string | null
  costPrice: number | null
  supplier: string | null
}

export function parseDateLoose(raw: string | null | undefined): Date | null | 'invalid' {
  const t = raw?.toString().trim()
  if (!t) return null
  if (/^\d{4}-\d{2}-\d{2}T/.test(t)) {
    const d = new Date(t)
    return Number.isNaN(d.getTime()) ? 'invalid' : d
  }
  return parseJalaliInput(t) ?? 'invalid'
}

/** Validates one line against its product. Messages carry the 1-based row number. */
export function parseBatchLine(
  line: BatchLineInput,
  index: number,
  product: { tracksExpiry: boolean } | undefined
): { ok: true; line: ParsedBatchLine } | { ok: false; error: string } {
  const row = `ردیف ${(index + 1).toLocaleString('fa-IR')}`
  if (!product) return { ok: false, error: `${row}: محصول انتخاب نشده یا پیدا نشد.` }
  if (!Number.isInteger(line.quantity) || line.quantity < 1 || line.quantity > 100000) return { ok: false, error: `${row}: تعداد باید عدد صحیح بین ۱ و ۱۰۰٬۰۰۰ باشد.` }
  const exp = parseDateLoose(line.expiryDate)
  if (exp === 'invalid') return { ok: false, error: `${row}: تاریخ انقضا نامعتبر است.` }
  const man = parseDateLoose(line.manufactureDate)
  if (man === 'invalid') return { ok: false, error: `${row}: تاریخ تولید نامعتبر است.` }
  if (product.tracksExpiry && !exp) return { ok: false, error: `${row}: این کالا تاریخ انقضا دارد؛ تاریخ انقضا را وارد کنید.` }
  if (exp && man && man.getTime() >= exp.getTime()) return { ok: false, error: `${row}: تاریخ تولید باید پیش از تاریخ انقضا باشد.` }
  const cost = line.costPrice ?? null
  if (cost != null && (!Number.isInteger(cost) || cost < 0 || cost > 1_000_000_000)) return { ok: false, error: `${row}: قیمت تمام‌شده نامعتبر است.` }
  const clean = (s?: string | null, max = 80) => s?.toString().trim().slice(0, max) || null
  return {
    ok: true,
    line: {
      productId: line.productId,
      quantity: line.quantity,
      manufactureDate: man,
      expiryDate: exp,
      batchNumber: clean(line.batchNumber),
      location: clean(line.location),
      costPrice: cost,
      supplier: clean(line.supplier),
    },
  }
}

/** Parses pasted rows «SKU, تعداد, تاریخ انقضا» (comma, tab or semicolon). */
export function parseBatchPaste(text: string): { sku: string; quantity: number; expiryDate: string }[] {
  return text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => l.split(/[,\t;،]/).map((c) => c.trim()))
    .filter((c) => c.length >= 2 && c[0])
    .map((c) => ({ sku: c[0], quantity: Number(c[1].replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)))), expiryDate: c[2] ?? '' }))
    .filter((r) => Number.isFinite(r.quantity))
}

export const ADJUST_REASONS_FA = {
  COUNT: 'شمارش مجدد',
  DAMAGE: 'آسیب‌دیدگی',
  RETURN: 'مرجوعی',
  OTHER: 'سایر',
} as const
