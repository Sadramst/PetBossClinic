/**
 * Pure helpers for the marketing admin: zod schemas, Tehran date handling, CSV and status badges.
 * No server-only imports, so the unit tests can run them directly.
 */
import { z } from 'zod'
import { normalizeCode } from '@/lib/marketing/coupon-rules'

/* ---------- Tehran time (UTC+3:30, no DST) ---------- */

const TEHRAN_OFFSET_MIN = 210

/** "2026-11-21T14:30" typed by staff means Tehran time. Returns null when empty or invalid. */
export function parseTehranLocal(value: string | null | undefined): Date | null {
  const v = (value ?? '').trim()
  if (!v) return null
  const m = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})$/.exec(v)
  if (!m) return null
  const [, y, mo, d, h, mi] = m.map(Number) as unknown as number[]
  const utc = Date.UTC(y, mo - 1, d, h, mi) - TEHRAN_OFFSET_MIN * 60000
  const date = new Date(utc)
  return Number.isNaN(date.getTime()) ? null : date
}

/** The inverse, for <input type="datetime-local">. */
export function toTehranLocalInput(date: Date | string | null | undefined): string {
  if (!date) return ''
  const d = date instanceof Date ? date : new Date(date)
  if (Number.isNaN(d.getTime())) return ''
  const t = new Date(d.getTime() + TEHRAN_OFFSET_MIN * 60000)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${t.getUTCFullYear()}-${p(t.getUTCMonth() + 1)}-${p(t.getUTCDate())}T${p(t.getUTCHours())}:${p(t.getUTCMinutes())}`
}

/* ---------- coupon input ---------- */

const intField = (label: string, min: number, max = 1_000_000_000) =>
  z.coerce
    .number({ invalid_type_error: `${label} باید عدد باشد.` })
    .int(`${label} باید عدد صحیح باشد.`)
    .min(min, `${label} نمی‌تواند کمتر از ${min.toLocaleString('fa-IR')} باشد.`)
    .max(max, `${label} بیش از حد مجاز است.`)

const optionalInt = (label: string, min: number) =>
  z.preprocess((v) => (v === '' || v === null || v === undefined ? null : v), intField(label, min).nullable())

const idList = z.array(z.string().min(1).max(40)).max(200, 'تعداد موارد انتخاب‌شده بیش از حد است.').default([])

const baseCoupon = z.object({
  code: z.string().max(40, 'کد حداکثر ۴۰ نویسه باشد.').optional().default(''),
  title: z.string().trim().min(2, 'عنوان را وارد کنید (حداقل ۲ حرف).').max(80, 'عنوان حداکثر ۸۰ حرف باشد.'),
  description: z.string().trim().max(300, 'توضیح حداکثر ۳۰۰ حرف باشد.').optional().default(''),
  type: z.enum(['PERCENT', 'FIXED', 'FREE_SHIPPING'], { errorMap: () => ({ message: 'نوع تخفیف نامعتبر است.' }) }),
  value: intField('مقدار تخفیف', 0).default(0),
  maxDiscount: optionalInt('سقف تخفیف', 1).default(null),
  minSubtotal: intField('حداقل خرید', 0).default(0),
  startsAt: z.string().optional().default(''),
  endsAt: z.string().optional().default(''),
  isActive: z.boolean().default(true),
  autoApply: z.boolean().default(false),
  usageLimit: optionalInt('سقف کل استفاده', 1).default(null),
  perCustomerLimit: optionalInt('سقف استفاده هر مشتری', 1).default(null),
  firstOrderOnly: z.boolean().default(false),
  customerPhone: z.string().max(30).optional().default(''),
  groupId: z.string().max(40).nullable().optional().default(null),
  categoryIds: idList,
  brandIds: idList,
  productIds: idList,
})

function refineCoupon(c: z.infer<typeof baseCoupon>, add: (path: string, message: string) => void) {
  if (c.type === 'PERCENT' && (c.value < 1 || c.value > 100)) {
    add('value', 'درصد تخفیف باید بین ۱ تا ۱۰۰ باشد.')
  }
  if (c.type === 'FIXED' && c.value < 1) {
    add('value', 'مبلغ تخفیف را به تومان وارد کنید.')
  }
  if (c.type !== 'PERCENT' && c.maxDiscount != null) {
    add('maxDiscount', 'سقف تخفیف فقط برای تخفیف درصدی است.')
  }
  if (c.startsAt.trim() && !parseTehranLocal(c.startsAt)) {
    add('startsAt', 'تاریخ شروع معتبر نیست.')
  }
  if (c.endsAt.trim() && !parseTehranLocal(c.endsAt)) {
    add('endsAt', 'تاریخ پایان معتبر نیست.')
  }
  const s = parseTehranLocal(c.startsAt)
  const e = parseTehranLocal(c.endsAt)
  if (s && e && e <= s) {
    add('endsAt', 'پایان بازه باید بعد از شروع آن باشد.')
  }
  if (c.autoApply && c.customerPhone.trim()) {
    add('autoApply', 'کد شخصی نمی‌تواند خودکار اعمال شود.')
  }
}

const issue = (ctx: z.RefinementCtx, prefix: string[] = []) => (path: string, message: string) =>
  ctx.addIssue({ code: 'custom', path: [...prefix, path], message })

export const couponInputSchema = baseCoupon.superRefine((c, ctx) => refineCoupon(c, issue(ctx)))
export type CouponInput = z.infer<typeof couponInputSchema>
export type CouponInputRaw = z.input<typeof baseCoupon>

export const bulkInputSchema = z
  .object({
    count: intField('تعداد کد', 1, 1000),
    prefix: z
      .string()
      .trim()
      .max(10, 'پیشوند حداکثر ۱۰ نویسه باشد.')
      .optional()
      .default('PB')
      .transform((p) => normalizeCode(p) ?? 'PB'),
    template: baseCoupon.omit({ code: true, usageLimit: true, perCustomerLimit: true, customerPhone: true, autoApply: true }),
  })
  .superRefine((b, ctx) => {
    refineCoupon(
      { ...b.template, code: '', usageLimit: null, perCustomerLimit: 1, customerPhone: '', autoApply: false },
      issue(ctx, ['template'])
    )
  })
export type BulkInput = z.infer<typeof bulkInputSchema>

export const groupInputSchema = z.object({
  name: z.string().trim().min(2, 'نام گروه را وارد کنید.').max(60, 'نام گروه حداکثر ۶۰ حرف باشد.'),
  description: z.string().trim().max(200, 'توضیح حداکثر ۲۰۰ حرف باشد.').optional().default(''),
})

const optText = (max: number, label: string) => z.string().trim().max(max, `${label} حداکثر ${max.toLocaleString('fa-IR')} حرف باشد.`)

export const configInputSchema = z
  .object({
    popupEnabled: z.boolean(),
    popupTitle: optText(80, 'عنوان پنجره').min(2, 'عنوان پنجره را وارد کنید.'),
    popupText: optText(240, 'متن پنجره').min(2, 'متن پنجره را وارد کنید.'),
    popupDelaySeconds: intField('تأخیر نمایش', 0, 300),
    welcomeEnabled: z.boolean(),
    welcomeType: z.enum(['PERCENT', 'FIXED', 'FREE_SHIPPING']),
    welcomeValue: intField('مقدار تخفیف خوش‌آمد', 0),
    welcomeMaxDiscount: optionalInt('سقف تخفیف خوش‌آمد', 1),
    welcomeMinSubtotal: intField('حداقل خرید', 0),
    welcomeValidDays: intField('اعتبار کد (روز)', 1, 365),
    bannerEnabled: z.boolean(),
    bannerText: optText(160, 'متن بنر').optional().default(''),
    bannerLink: z
      .string()
      .trim()
      .max(300)
      .optional()
      .default('')
      .refine((v) => v === '' || v.startsWith('/') || /^https?:\/\//i.test(v), 'پیوند باید با / یا https:// شروع شود.')
      .refine((v) => !v.startsWith('//'), 'پیوند نامعتبر است.'),
    bannerEndsAt: z.string().optional().default(''),
    bannerCouponCode: z.string().max(40).optional().default(''),
  })
  .superRefine((c, ctx) => {
    if (c.welcomeEnabled && c.welcomeType === 'PERCENT' && (c.welcomeValue < 1 || c.welcomeValue > 100)) {
      ctx.addIssue({ code: 'custom', path: ['welcomeValue'], message: 'درصد تخفیف باید بین ۱ تا ۱۰۰ باشد.' })
    }
    if (c.welcomeEnabled && c.welcomeType === 'FIXED' && c.welcomeValue < 1) {
      ctx.addIssue({ code: 'custom', path: ['welcomeValue'], message: 'مبلغ تخفیف را به تومان وارد کنید.' })
    }
    if (c.bannerEndsAt.trim() && !parseTehranLocal(c.bannerEndsAt)) {
      ctx.addIssue({ code: 'custom', path: ['bannerEndsAt'], message: 'تاریخ پایان بنر معتبر نیست.' })
    }
    if (c.bannerEnabled && !c.bannerText.trim()) {
      ctx.addIssue({ code: 'custom', path: ['bannerText'], message: 'برای نمایش بنر، متن آن را بنویسید.' })
    }
  })
export type ConfigInput = z.infer<typeof configInputSchema>

/* ---------- status ---------- */

export type CouponStatus = 'active' | 'inactive' | 'scheduled' | 'expired' | 'used_up'

export const COUPON_STATUS_LABEL: Record<CouponStatus, string> = {
  active: 'فعال',
  inactive: 'غیرفعال',
  scheduled: 'زمان‌بندی‌شده',
  expired: 'منقضی',
  used_up: 'تمام‌شده',
}

export function couponStatus(
  c: { isActive: boolean; startsAt: Date | null; endsAt: Date | null; usageLimit: number | null; usedCount: number },
  now: Date = new Date()
): CouponStatus {
  if (!c.isActive) return 'inactive'
  if (c.usageLimit != null && c.usedCount >= c.usageLimit) return 'used_up'
  if (c.endsAt && c.endsAt <= now) return 'expired'
  if (c.startsAt && c.startsAt > now) return 'scheduled'
  return 'active'
}

/* ---------- CSV ---------- */

/** Prefixes a quote to values a spreadsheet would run as a formula (CSV injection). */
function csvCell(v: unknown): string {
  let s = v === null || v === undefined ? '' : String(v)
  if (/^[=+\-@\t\r]/.test(s) && !/^-?\d+(\.\d+)?$/.test(s)) s = `'${s}`
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

/** UTF-8 CSV with BOM so Excel shows Persian text correctly. */
export function toCsv(headers: string[], rows: unknown[][]): string {
  return '﻿' + [headers, ...rows].map((r) => r.map(csvCell).join(',')).join('\r\n') + '\r\n'
}
