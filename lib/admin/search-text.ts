import { toLatinDigits } from '@/lib/date/jalali'
import { normalizeMobile } from '@/lib/text/iran'

/** Persian and Arabic forms of ی/ک both occur in stored text; search both. */
export function textVariants(q: string): string[] {
  const latin = toLatinDigits(q.trim())
  const arabic = latin.replace(/ی/g, 'ي').replace(/ک/g, 'ك')
  const persian = latin.replace(/ي/g, 'ی').replace(/ك/g, 'ک')
  return [...new Set([latin, arabic, persian])]
}

/** Digits to match inside stored phones: canonical 09... when it is a full number, else the typed digits. */
export function phoneNeedle(q: string): string | null {
  const full = normalizeMobile(q)
  if (full) return full
  const digits = toLatinDigits(q).replace(/[\s\-()+]/g, '')
  if (!/^\d{3,}$/.test(digits)) return null
  return digits.replace(/^(0098|98)/, '0').replace(/^9(?=\d{9}$)/, '09')
}

