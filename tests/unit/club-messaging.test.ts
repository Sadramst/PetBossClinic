import { describe, it, expect, vi } from 'vitest'

vi.mock('server-only', () => ({}))

import { renderTemplate, unknownVariables, usesCoupon, templateVariablesUsed } from '@/lib/club/messaging/render'
import {
  UNSUBSCRIBE_FOOTER,
  consentVerdict,
  countSegments,
  filterByConsent,
  isMarketingKind,
  isQuietHour,
  nextSendTime,
  tehranParts,
  withUnsubscribeFooter,
} from '@/lib/club/messaging/rules'
import { normalizeCouponTemplate } from '@/lib/club/messaging/personalize'
import { buildAnthropicRequest, fallbackDrafts, sanitizeFacts, DRAFT_GOALS } from '@/lib/club/ai'

describe('renderTemplate', () => {
  it('substitutes known variables', () => {
    expect(renderTemplate('سلام {name}، {petName} {petBreed}', { name: 'سارا', petName: 'لونا', petBreed: 'پرشین' })).toBe('سلام سارا، لونا پرشین')
  })
  it('tolerates spaces inside braces and numbers', () => {
    expect(renderTemplate('{ points } امتیاز', { points: 120 })).toBe('120 امتیاز')
  })
  it('drops unknown variables instead of evaluating or printing them', () => {
    const out = renderTemplate('الف {constructor} ب {__proto__} ج {process} {env}', {})
    expect(out).toBe('الف ب ج')
  })
  it('uses friendly fallbacks for a missing name and pet name', () => {
    expect(renderTemplate('سلام {name} عزیز، {petName}', {})).toBe('سلام دوست عزیز، حیوان خانگی‌تان')
  })
  it('removes empty optional variables and tidies spacing', () => {
    expect(renderTemplate('نژاد: {petBreed} .', {})).toBe('نژاد:.')
  })
  it('does not re-expand placeholders found inside values', () => {
    expect(renderTemplate('{name}', { name: '{code}' })).toBe('code')
  })
  it('lists used and unknown variables', () => {
    expect(templateVariablesUsed('{name} {code} {zzz}').sort()).toEqual(['code', 'name', 'zzz'])
    expect(unknownVariables('{name} {zzz}')).toEqual(['zzz'])
    expect(usesCoupon('کد {code}')).toBe(true)
    expect(usesCoupon('سلام {name}')).toBe(false)
  })
})

describe('quiet hours (Asia/Tehran, UTC+03:30)', () => {
  it('converts instants to Tehran wall time', () => {
    expect(tehranParts(new Date('2026-11-18T08:00:00Z'))).toMatchObject({ hour: 11, minute: 30, day: 18 })
  })
  it('is quiet from 21:00 to 09:00', () => {
    expect(isQuietHour(new Date('2026-11-18T17:29:00Z'))).toBe(false) // 20:59
    expect(isQuietHour(new Date('2026-11-18T17:30:00Z'))).toBe(true) // 21:00
    expect(isQuietHour(new Date('2026-11-18T05:29:00Z'))).toBe(true) // 08:59
    expect(isQuietHour(new Date('2026-11-18T05:30:00Z'))).toBe(false) // 09:00
  })
  it('keeps normal hours unchanged', () => {
    const d = new Date('2026-11-18T08:00:00Z')
    expect(nextSendTime(d)).toBe(d)
  })
  it('moves an evening message to 09:30 the next morning', () => {
    expect(nextSendTime(new Date('2026-11-18T18:00:00Z')).toISOString()).toBe('2026-11-19T06:00:00.000Z')
  })
  it('moves an early-morning message to 09:30 the same day', () => {
    expect(nextSendTime(new Date('2026-11-18T01:00:00Z')).toISOString()).toBe('2026-11-18T06:00:00.000Z')
  })
  it('handles the month boundary', () => {
    expect(nextSendTime(new Date('2026-11-30T19:00:00Z')).toISOString()).toBe('2026-12-01T06:00:00.000Z')
  })
})

describe('SMS segment counting', () => {
  it('counts Persian text as UCS-2 (70 / 67)', () => {
    expect(countSegments('س'.repeat(70))).toMatchObject({ segments: 1, unicode: true })
    expect(countSegments('س'.repeat(71)).segments).toBe(2)
    expect(countSegments('س'.repeat(134)).segments).toBe(2)
    expect(countSegments('س'.repeat(135)).segments).toBe(3)
  })
  it('counts latin text as GSM-7 (160 / 153)', () => {
    expect(countSegments('a'.repeat(160))).toMatchObject({ segments: 1, unicode: false })
    expect(countSegments('a'.repeat(161)).segments).toBe(2)
    expect(countSegments('').segments).toBe(0)
  })
  it('appends the unsubscribe footer once', () => {
    const once = withUnsubscribeFooter('سلام')
    expect(once.endsWith(UNSUBSCRIBE_FOOTER)).toBe(true)
    expect(withUnsubscribeFooter(once)).toBe(once)
  })
})

describe('consent filter', () => {
  it('requires consent, no unsubscribe and an unblocked account', () => {
    expect(consentVerdict({ marketingSmsConsent: true })).toEqual({ ok: true })
    expect(consentVerdict({ marketingSmsConsent: false })).toEqual({ ok: false, reason: 'no_consent' })
    expect(consentVerdict({ marketingSmsConsent: true, unsubscribed: true })).toEqual({ ok: false, reason: 'unsubscribed' })
    expect(consentVerdict({ marketingSmsConsent: true, isBlocked: true })).toEqual({ ok: false, reason: 'blocked' })
  })
  it('splits a list and counts the exclusions', () => {
    const { allowed, excluded } = filterByConsent([
      { id: 1, marketingSmsConsent: true },
      { id: 2, marketingSmsConsent: false },
      { id: 3, marketingSmsConsent: true, unsubscribed: true },
      { id: 4, marketingSmsConsent: false },
    ])
    expect(allowed.map((a) => a.id)).toEqual([1])
    expect(excluded).toEqual({ no_consent: 2, unsubscribed: 1 })
  })
  it('treats only system messages as non-marketing', () => {
    expect(isMarketingKind('system')).toBe(false)
    expect(isMarketingKind('campaign')).toBe(true)
    expect(isMarketingKind('automation:vaccine')).toBe(true)
    expect(isMarketingKind('admin')).toBe(true)
  })
})

describe('coupon template normalisation', () => {
  it('clamps values and rejects unusable input', () => {
    expect(normalizeCouponTemplate(null)).toBeNull()
    expect(normalizeCouponTemplate({ type: 'BOGUS' })).toBeNull()
    expect(normalizeCouponTemplate({ type: 'PERCENT', value: 900, validDays: 9999 })).toMatchObject({ value: 100, validDays: 365 })
    expect(normalizeCouponTemplate({ type: 'FREE_SHIPPING', value: 5 })).toMatchObject({ value: 0 })
  })
})

describe('AI helpers', () => {
  it('keeps only whitelisted anonymous facts and scrubs identifiers', () => {
    const facts = sanitizeFacts({
      species: 'سگ',
      breed: 'پودل 09121234567',
      foodBrand: 'رویال کنین a@b.com',
      tier: 'GOLD',
      daysSinceLastOrder: 40.7,
      // @ts-expect-error unknown keys must be dropped
      phone: '09121234567',
      name: 'علی',
    })
    expect(JSON.stringify(facts)).not.toMatch(/0912|a@b|علی|phone/)
    expect(facts).toMatchObject({ species: 'سگ', daysSinceLastOrder: 40, tier: 'GOLD' })
  })
  it('builds a request without personal data', () => {
    const body = buildAnthropicRequest({ goal: 'winback', tone: 'playful', facts: { species: 'گربه', foodBrand: 'پرو پلن', daysSinceLastOrder: 70 } }, 'claude-sonnet-5-5')
    const text = JSON.stringify(body)
    expect(body.model).toBe('claude-sonnet-5-5')
    expect(text).toContain('گربه')
    expect(text).not.toMatch(/09\d{9}|@/)
  })
  it('has three usable fallback options for every goal and tone', () => {
    for (const g of DRAFT_GOALS) {
      const opts = fallbackDrafts(g, 'formal')
      expect(opts).toHaveLength(3)
      for (const o of opts) {
        expect(Array.from(o).length).toBeLessThanOrEqual(300)
        expect(unknownVariables(o)).toEqual([])
      }
    }
  })
})
