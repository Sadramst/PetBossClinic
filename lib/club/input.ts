import { z } from 'zod'
import { jalaliToDate, isValidJalali, toLatinDigits } from '@/lib/date/jalali'
import { normalizeFa } from '@/lib/text/persian'

/**
 * Accepts a Date, "2026-11-22" (Gregorian) or "1405/09/01" (Jalali). Stored at 12:00 UTC so the
 * calendar day never shifts with the viewer's time zone. Returns null for empty input and
 * undefined for text that is not a date.
 */
export function parseDateInput(value: unknown): Date | null | undefined {
  if (value == null || value === '') return null
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? undefined : value
  if (typeof value !== 'string') return undefined
  const m = toLatinDigits(value.trim()).match(/^(\d{4})[/\-.](\d{1,2})[/\-.](\d{1,2})/)
  if (!m) return undefined
  const y = Number(m[1])
  const mo = Number(m[2])
  const d = Number(m[3])
  if (y < 1700) {
    if (!isValidJalali(y, mo, d)) return undefined
    return jalaliToDate(y, mo, d)
  }
  const dt = new Date(Date.UTC(y, mo - 1, d, 12))
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== mo - 1 || dt.getUTCDate() !== d) return undefined
  return dt
}

export const text = (max: number) =>
  z
    .union([z.string(), z.null()])
    .transform((s) => normalizeFa(s ?? '').trim())
    .pipe(z.string().max(max, `حداکثر ${max} نویسه`))
    .transform((s) => (s === '' ? null : s))

export const dateField = (opts: { allowFuture?: boolean; maxYearsAgo?: number } = {}) =>
  z
    .union([z.string(), z.date(), z.null(), z.undefined()])
    .transform((v, ctx) => {
      const d = parseDateInput(v)
      if (d === undefined) {
        ctx.addIssue({ code: 'custom', message: 'تاریخ معتبر نیست.' })
        return z.NEVER
      }
      if (d) {
        if (!opts.allowFuture && d.getTime() > Date.now() + 86_400_000) {
          ctx.addIssue({ code: 'custom', message: 'تاریخ نمی‌تواند در آینده باشد.' })
          return z.NEVER
        }
        const oldest = Date.now() - (opts.maxYearsAgo ?? 60) * 366 * 86_400_000
        if (d.getTime() < oldest) {
          ctx.addIssue({ code: 'custom', message: 'تاریخ بسیار قدیمی است.' })
          return z.NEVER
        }
      }
      return d
    })

export const firstError = (err: z.ZodError): string => err.issues[0]?.message || 'اطلاعات واردشده معتبر نیست.'
