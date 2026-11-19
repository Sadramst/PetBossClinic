/** Safe template rendering for SMS bodies. Pure: plain text substitution only, nothing is evaluated. */

export const TEMPLATE_VARS = ['name', 'petName', 'petBreed', 'points', 'tier', 'code', 'expiry', 'link', 'item'] as const
export type TemplateVar = (typeof TEMPLATE_VARS)[number]

export const TEMPLATE_VAR_HELP: Record<TemplateVar, string> = {
  name: 'نام مشتری',
  petName: 'نام حیوان خانگی',
  petBreed: 'نژاد حیوان',
  points: 'موجودی امتیاز',
  tier: 'سطح باشگاه',
  code: 'کد تخفیف شخصی',
  expiry: 'تاریخ انقضای کد',
  link: 'لینک فروشگاه',
  item: 'نام محصول یا یادآوری مرتبط',
}

/** Shown when a value is missing so the sentence still reads well. */
export const VAR_FALLBACK: Partial<Record<TemplateVar, string>> = {
  name: 'دوست',
  petName: 'حیوان خانگی‌تان',
}

export type TemplateVars = Partial<Record<TemplateVar, string | number | null | undefined>>

const PLACEHOLDER = /\{\s*([A-Za-z_]+)\s*\}/g

/**
 * Replaces {variables}. Unknown names are removed, never evaluated; values are inserted as plain text
 * (substitution runs once, so a value can never introduce a new placeholder).
 */
export function renderTemplate(body: string, vars: TemplateVars): string {
  const out = body.replace(PLACEHOLDER, (_m, rawName: string) => {
    if (!(TEMPLATE_VARS as readonly string[]).includes(rawName)) return ''
    const name = rawName as TemplateVar
    const v = vars[name]
    const text = v === null || v === undefined || String(v).trim() === '' ? (VAR_FALLBACK[name] ?? '') : String(v)
    return text.replace(/[{}]/g, '')
  })
  return out
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/ +([،.!؟])/g, '$1')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

/** Variables a template uses (for validation and the admin variable chips). */
export function templateVariablesUsed(body: string): string[] {
  const found = new Set<string>()
  for (const m of body.matchAll(PLACEHOLDER)) found.add(m[1])
  return [...found]
}

export function unknownVariables(body: string): string[] {
  return templateVariablesUsed(body).filter((n) => !(TEMPLATE_VARS as readonly string[]).includes(n))
}

/** True when the template needs a coupon code to make sense. */
export function usesCoupon(body: string): boolean {
  const used = templateVariablesUsed(body)
  return used.includes('code') || used.includes('expiry')
}
