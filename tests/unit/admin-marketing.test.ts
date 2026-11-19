import { describe, it, expect } from 'vitest'
import {
  bulkInputSchema,
  configInputSchema,
  couponInputSchema,
  couponStatus,
  groupInputSchema,
  parseTehranLocal,
  toCsv,
  toTehranLocalInput,
} from '@/lib/marketing/admin-validators'

const base = { title: 'جشنواره', type: 'PERCENT' as const, value: 10 }

describe('Tehran local time', () => {
  it('treats typed values as Tehran time (UTC+3:30)', () => {
    expect(parseTehranLocal('2026-11-21T12:00')?.toISOString()).toBe('2026-11-21T08:30:00.000Z')
  })
  it('round-trips for datetime-local inputs', () => {
    const d = parseTehranLocal('2026-03-01T00:15')!
    expect(toTehranLocalInput(d)).toBe('2026-03-01T00:15')
  })
  it('rejects garbage and empties', () => {
    expect(parseTehranLocal('')).toBeNull()
    expect(parseTehranLocal('tomorrow')).toBeNull()
    expect(toTehranLocalInput(null)).toBe('')
  })
})

describe('couponInputSchema', () => {
  it('accepts a minimal percent coupon and fills defaults', () => {
    const r = couponInputSchema.safeParse(base)
    expect(r.success).toBe(true)
    if (r.success) {
      expect(r.data.minSubtotal).toBe(0)
      expect(r.data.categoryIds).toEqual([])
      expect(r.data.usageLimit).toBeNull()
    }
  })
  it.each([
    [{ ...base, value: 0 }, 'درصد'],
    [{ ...base, value: 101 }, 'درصد'],
    [{ ...base, type: 'FIXED' as const, value: 0 }, 'مبلغ'],
    [{ ...base, title: 'ا' }, 'عنوان'],
    [{ ...base, type: 'FIXED' as const, value: 5000, maxDiscount: 1000 }, 'سقف'],
    [{ ...base, startsAt: '2026-11-21T10:00', endsAt: '2026-11-21T09:00' }, 'بعد از شروع'],
    [{ ...base, endsAt: 'invalid' }, 'تاریخ پایان'],
    [{ ...base, minSubtotal: -5 }, 'حداقل'],
    [{ ...base, usageLimit: 0 }, 'سقف کل'],
    [{ ...base, autoApply: true, customerPhone: '09121234567' }, 'شخصی'],
  ])('rejects invalid input %#', (input, fragment) => {
    const r = couponInputSchema.safeParse(input)
    expect(r.success).toBe(false)
    if (!r.success) expect(r.error.issues[0].message).toContain(fragment)
  })
  it('lets free shipping carry no value and treats blank limits as unlimited', () => {
    const r = couponInputSchema.safeParse({ type: 'FREE_SHIPPING', title: 'ارسال رایگان', value: 0, usageLimit: '', perCustomerLimit: '' })
    expect(r.success).toBe(true)
    if (r.success) {
      expect(r.data.usageLimit).toBeNull()
      expect(r.data.perCustomerLimit).toBeNull()
    }
  })
})

describe('bulkInputSchema', () => {
  it('caps the count and normalises the prefix', () => {
    expect(bulkInputSchema.safeParse({ count: 1001, template: base }).success).toBe(false)
    expect(bulkInputSchema.safeParse({ count: 0, template: base }).success).toBe(false)
    const ok = bulkInputSchema.safeParse({ count: 20, prefix: 'gift', template: base })
    expect(ok.success && ok.data.prefix).toBe('GIFT')
  })
  it('validates the template too', () => {
    const r = bulkInputSchema.safeParse({ count: 5, template: { ...base, value: 500 } })
    expect(r.success).toBe(false)
  })
})

describe('groupInputSchema and configInputSchema', () => {
  it('requires a group name', () => {
    expect(groupInputSchema.safeParse({ name: ' ' }).success).toBe(false)
    expect(groupInputSchema.safeParse({ name: 'ویژه' }).success).toBe(true)
  })
  const cfg = {
    popupEnabled: true,
    popupTitle: 'تخفیف',
    popupText: 'متن پنجره',
    popupDelaySeconds: 8,
    welcomeEnabled: true,
    welcomeType: 'PERCENT' as const,
    welcomeValue: 10,
    welcomeMaxDiscount: null,
    welcomeMinSubtotal: 0,
    welcomeValidDays: 14,
    bannerEnabled: false,
  }
  it('accepts a valid config', () => expect(configInputSchema.safeParse(cfg).success).toBe(true))
  it('rejects unsafe banner links and bad numbers', () => {
    expect(configInputSchema.safeParse({ ...cfg, bannerLink: 'javascript:alert(1)' }).success).toBe(false)
    expect(configInputSchema.safeParse({ ...cfg, bannerLink: '//evil.example' }).success).toBe(false)
    expect(configInputSchema.safeParse({ ...cfg, bannerLink: '/shop' }).success).toBe(true)
    expect(configInputSchema.safeParse({ ...cfg, welcomeValue: 150 }).success).toBe(false)
    expect(configInputSchema.safeParse({ ...cfg, popupDelaySeconds: 999 }).success).toBe(false)
    expect(configInputSchema.safeParse({ ...cfg, welcomeValidDays: 0 }).success).toBe(false)
  })
  it('needs banner text when the banner is on', () => {
    expect(configInputSchema.safeParse({ ...cfg, bannerEnabled: true, bannerText: '' }).success).toBe(false)
  })
})

describe('couponStatus', () => {
  const now = new Date('2026-11-21T10:00:00Z')
  const c = { isActive: true, startsAt: null, endsAt: null, usageLimit: null, usedCount: 0 }
  it('covers every state', () => {
    expect(couponStatus(c, now)).toBe('active')
    expect(couponStatus({ ...c, isActive: false }, now)).toBe('inactive')
    expect(couponStatus({ ...c, endsAt: new Date('2026-11-20T00:00:00Z') }, now)).toBe('expired')
    expect(couponStatus({ ...c, startsAt: new Date('2026-11-22T00:00:00Z') }, now)).toBe('scheduled')
    expect(couponStatus({ ...c, usageLimit: 3, usedCount: 3 }, now)).toBe('used_up')
    expect(couponStatus({ ...c, usageLimit: 3, usedCount: 2 }, now)).toBe('active')
  })
})

describe('toCsv', () => {
  it('adds a BOM, escapes quotes, commas and newlines', () => {
    const csv = toCsv(['a', 'b'], [['x,y', 'say "hi"'], ['l1\nl2', 'ok']])
    expect(csv.startsWith('﻿')).toBe(true)
    expect(csv).toContain('"x,y","say ""hi"""')
    expect(csv).toContain('"l1\nl2",ok')
  })
  it('neutralises spreadsheet formulas but keeps negative numbers', () => {
    const csv = toCsv(['v'], [['=HYPERLINK("x")'], ['+98123'], ['-5'], ['@sum']])
    expect(csv).toContain(`"'=HYPERLINK(""x"")"`)
    expect(csv).toContain("'+98123")
    expect(csv).toContain('\r\n-5\r\n')
    expect(csv).toContain("'@sum")
  })
  it('prints null and undefined as empty cells', () => {
    expect(toCsv(['a', 'b'], [[null, undefined]])).toContain('\r\n,\r\n')
  })
})
