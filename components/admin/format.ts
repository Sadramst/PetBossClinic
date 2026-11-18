/** Small formatting helpers shared by admin pages and managers (no server-only imports). */

export const faNum = (n: number): string => n.toLocaleString('fa-IR')

/** Toman amount that also prints zero (formatPrice shows «تماس بگیرید» for 0). */
export const toman = (n: number): string => `${n.toLocaleString('fa-IR')} تومان`

/** Jalali date with time, e.g. «۱۲ اسفند ۱۴۰۶، ۱۴:۳۰» (Tehran time). */
export function formatJalaliDateTime(date: Date | string): string {
  const d = date instanceof Date ? date : new Date(date)
  if (Number.isNaN(d.getTime())) return ''
  return new Intl.DateTimeFormat('fa-IR-u-ca-persian', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'Asia/Tehran',
  }).format(d)
}

/** «۵ دقیقه پیش», «۳ ساعت پیش», «۲ روز پیش». */
export function relativeAgeFa(date: Date | string, now: Date = new Date()): string {
  const d = date instanceof Date ? date : new Date(date)
  const minutes = Math.max(0, Math.floor((now.getTime() - d.getTime()) / 60000))
  if (minutes < 1) return 'همین حالا'
  if (minutes < 60) return `${faNum(minutes)} دقیقه پیش`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${faNum(hours)} ساعت پیش`
  return `${faNum(Math.floor(hours / 24))} روز پیش`
}

/** Start of the current day in Tehran (UTC+03:30, no daylight saving). */
export function tehranDayStart(now: Date = new Date()): Date {
  const offset = 3.5 * 60 * 60 * 1000
  const day = 24 * 60 * 60 * 1000
  return new Date(Math.floor((now.getTime() + offset) / day) * day - offset)
}

export const LEAD_STATUS_FA: Record<string, string> = {
  NEW: 'جدید',
  CONTACTED: 'تماس گرفته شد',
  CONVERTED: 'نوبت نهایی شد',
  CLOSED: 'بایگانی',
}

const ROLE_RANK: Record<string, number> = { SUPER_ADMIN: 5, ADMIN: 4, EDITOR: 3, AUTHOR: 2, VIEWER: 1 }

/** Client-safe role check, mirrors hasRoleAccess in lib/auth. */
export function roleAtLeast(role: string, min: string): boolean {
  return (ROLE_RANK[role] ?? 0) >= (ROLE_RANK[min] ?? 0)
}
