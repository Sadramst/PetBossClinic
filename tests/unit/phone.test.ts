import { describe, it, expect } from 'vitest'
import {
  toAsciiDigits,
  toPersianDigits,
  normalizeIranianPhone,
  isValidIranianPhone,
  isValidIranianMobile,
  formatPhoneDisplay,
  getTelLink,
  getWhatsAppLink,
} from '@/lib/utils/phone'

describe('Iranian Phone Utility & Normalization (lib/utils/phone.ts)', () => {
  it('converts Persian and Arabic digits to ASCII digits', () => {
    expect(toAsciiDigits('۰۹۱۲۳۴۵۶۷۸۹')).toBe('09123456789')
    expect(toAsciiDigits('٠١٢٣٤٥٦٧٨٩')).toBe('09123456789'.replace('09123456789', '0123456789'))
    expect(toAsciiDigits('تلفن: ۰۲۱-۲۶۴۲۹۷۱۵')).toBe('تلفن: 021-26429715')
  })

  it('converts ASCII digits to Persian digits', () => {
    expect(toPersianDigits('02126429715')).toBe('۰۲۱۲۶۴۲۹۷۱۵')
    expect(toPersianDigits('09123456789')).toBe('۰۹۱۲۳۴۵۶۷۸۹')
  })

  it('normalizes various Iranian mobile formats to E.164 (+989XXXXXXXXX)', () => {
    // Standard with leading zero
    expect(normalizeIranianPhone('09123456789')).toBe('+989123456789')
    // Persian numerals
    expect(normalizeIranianPhone('۰۹۱۲۳۴۵۶۷۸۹')).toBe('+989123456789')
    // Without leading zero
    expect(normalizeIranianPhone('9123456789')).toBe('+989123456789')
    // With country code 98
    expect(normalizeIranianPhone('989123456789')).toBe('+989123456789')
    // With plus country code
    expect(normalizeIranianPhone('+989123456789')).toBe('+989123456789')
    // With 0098 prefix
    expect(normalizeIranianPhone('00989123456789')).toBe('+989123456789')
    // With spaces, hyphens, parentheses
    expect(normalizeIranianPhone('0912-345-6789')).toBe('+989123456789')
    expect(normalizeIranianPhone('+98 (912) 345 6789')).toBe('+989123456789')
    expect(normalizeIranianPhone('۰۹۱۲-۳۴۵-۶۷۸۹')).toBe('+989123456789')
  })

  it('normalizes Tehran clinic landlines to E.164 (+9821XXXXXXXX)', () => {
    // Official clinic number: 021-26429715
    expect(normalizeIranianPhone('02126429715')).toBe('+982126429715')
    expect(normalizeIranianPhone('۰۲۱-۲۶۴۲۹۷۱۵')).toBe('+982126429715')
    expect(normalizeIranianPhone('+982126429715')).toBe('+982126429715')
    // 8-digit local Tehran number
    expect(normalizeIranianPhone('26429715')).toBe('+982126429715')
    expect(normalizeIranianPhone('۲۶۴۲۹۷۱۵')).toBe('+982126429715')
  })

  it('validates Iranian mobiles and landlines correctly', () => {
    expect(isValidIranianMobile('09123456789')).toBe(true)
    expect(isValidIranianMobile('۰۹۱۲۳۴۵۶۷۸۹')).toBe(true)
    expect(isValidIranianMobile('02126429715')).toBe(false) // Landline is not mobile
    expect(isValidIranianMobile('12345')).toBe(false)

    expect(isValidIranianPhone('09123456789')).toBe(true)
    expect(isValidIranianPhone('02126429715')).toBe(true)
    expect(isValidIranianPhone('۰۲۱-۲۶۴۲۹۷۱۵')).toBe(true)
    expect(isValidIranianPhone('invalid-phone')).toBe(false)
  })

  it('formats phone numbers for bilingual display', () => {
    // Tehran landline
    expect(formatPhoneDisplay('+982126429715', 'fa')).toBe('۰۲۱-۲۶۴۲۹۷۱۵')
    expect(formatPhoneDisplay('+982126429715', 'en')).toBe('+98 21 2642 9715')

    // Mobile
    expect(formatPhoneDisplay('+989123456789', 'fa')).toBe('۰۹۱۲-۳۴۵-۶۷۸۹')
    expect(formatPhoneDisplay('+989123456789', 'en')).toBe('+98 912 345 6789')
  })

  it('generates correct tel: and wa.me links', () => {
    expect(getTelLink('02126429715')).toBe('tel:+982126429715')
    expect(getWhatsAppLink('09122642971')).toBe('https://wa.me/989122642971')
    expect(getWhatsAppLink('09122642971', 'سلام نوبت')).toBe('https://wa.me/989122642971?text=%D8%B3%D9%84%D8%A7%D9%85%20%D9%86%D9%88%D8%A8%D8%AA')
  })
})
