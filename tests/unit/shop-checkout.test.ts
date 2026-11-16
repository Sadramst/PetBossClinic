import { describe, it, expect, vi, afterEach } from 'vitest'

vi.mock('server-only', () => ({}))
vi.mock('next/headers', () => ({ cookies: vi.fn() }))
vi.mock('next/navigation', () => ({ redirect: vi.fn() }))
vi.mock('@/lib/db', () => ({ db: {} }))

import { normalizeMobile, normalizePostalCode, maskMobile, isIranProvince } from '@/lib/text/iran'
import { sanitizeCartInput, MAX_QTY_PER_LINE } from '@/lib/shop/cart-types'
import { shippingFor, codAllowed, SHIPPING } from '@/lib/shop/shipping'
import { signCustomerToken, verifyCustomerToken, safeNext } from '@/lib/customer/session'

describe('Iranian mobile and postal code', () => {
  it('normalises every common mobile format', () => {
    for (const v of ['09121234567', '۰۹۱۲۱۲۳۴۵۶۷', '+989121234567', '00989121234567', '989121234567', '9121234567', '0912 123 4567']) {
      expect(normalizeMobile(v)).toBe('09121234567')
    }
    expect(normalizeMobile('02126429715')).toBeNull() // landline
    expect(normalizeMobile('0912123456')).toBeNull()
    expect(maskMobile('09121234567')).toBe('0912***4567')
  })

  it('validates 10-digit postal codes', () => {
    expect(normalizePostalCode('۱۹۳۸۹-۷۳۱۱۱')).toBe('1938973111')
    expect(normalizePostalCode('1234567890')).toBeNull() // contains 2 in first five digits
    expect(normalizePostalCode('193897311')).toBeNull()
  })

  it('knows the provinces', () => {
    expect(isIranProvince('تهران')).toBe(true)
    expect(isIranProvince('Tehran')).toBe(false)
  })
})

describe('cart input from the browser', () => {
  it('drops junk, merges duplicates and clamps quantities', () => {
    const id = 'cm1abcdefghijklmno'
    const out = sanitizeCartInput([
      { productId: id, quantity: 2 },
      { productId: id, quantity: 30 },
      { productId: '../etc/passwd', quantity: 1 },
      { productId: 'cm2abcdefghijklmno', quantity: -4 },
      'nope',
      { productId: 'cm3abcdefghijklmno', quantity: '3' },
    ])
    expect(out).toEqual([
      { productId: id, quantity: MAX_QTY_PER_LINE },
      { productId: 'cm3abcdefghijklmno', quantity: 3 },
    ])
    expect(sanitizeCartInput({})).toEqual([])
  })
})

describe('shipping', () => {
  it('charges courier in Tehran, post elsewhere, free over the threshold', () => {
    expect(shippingFor('تهران', 100_000).fee).toBe(SHIPPING.tehranFee)
    expect(shippingFor('اصفهان', 100_000).fee).toBe(SHIPPING.postFee)
    expect(shippingFor('اصفهان', SHIPPING.freeOver).fee).toBe(0)
    expect(codAllowed('تهران')).toBe(true)
    expect(codAllowed('البرز')).toBe(false)
  })
})

describe('customer session token', () => {
  it('round-trips and rejects tampering and expiry', () => {
    const now = Date.now()
    const token = signCustomerToken('cust_1', now)
    expect(verifyCustomerToken(token, now)).toBe('cust_1')

    const [body, sig] = token.split('.')
    const forged = Buffer.from(JSON.stringify({ cid: 'cust_2', exp: 9999999999 })).toString('base64url')
    expect(verifyCustomerToken(`${forged}.${sig}`, now)).toBeNull()
    expect(verifyCustomerToken(`${body}.x${sig.slice(1)}`, now)).toBeNull()
    expect(verifyCustomerToken(token, now + 31 * 86400_000)).toBeNull()
    expect(verifyCustomerToken(undefined)).toBeNull()
  })

  it('only allows same-site redirect targets', () => {
    expect(safeNext('/checkout')).toBe('/checkout')
    expect(safeNext('//evil.com')).toBe('/account')
    expect(safeNext('https://evil.com')).toBe('/account')
    expect(safeNext('/\\evil.com')).toBe('/account')
    expect(safeNext(undefined)).toBe('/account')
  })
})

describe('ZarinPal client', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.unstubAllEnvs()
  })

  it('requests a payment and builds the StartPay URL', async () => {
    vi.stubEnv('ZARINPAL_MERCHANT_ID', 'test-merchant')
    vi.stubEnv('ZARINPAL_SANDBOX', '1')
    const fetchMock = vi.fn().mockResolvedValue({ json: async () => ({ data: { code: 100, authority: 'A0000123' }, errors: [] }) })
    vi.stubGlobal('fetch', fetchMock)
    const { requestPayment, startPayUrl } = await import('@/lib/payments/zarinpal')

    const res = await requestPayment({ amountRial: 1_250_000, callbackUrl: 'https://x/cb', description: 'test' })
    expect(res.ok && res.authority).toBe('A0000123')
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('https://sandbox.zarinpal.com/pg/v4/payment/request.json')
    expect(JSON.parse(init.body)).toMatchObject({ merchant_id: 'test-merchant', amount: 1_250_000 })
    expect(startPayUrl('A0000123')).toBe('https://sandbox.zarinpal.com/pg/StartPay/A0000123')
  })

  it('treats code 100 and 101 as verified, anything else as failed', async () => {
    vi.stubEnv('ZARINPAL_MERCHANT_ID', 'test-merchant')
    const { verifyPayment } = await import('@/lib/payments/zarinpal')

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ json: async () => ({ data: { code: 101, ref_id: 42, card_pan: '6037**1234' } }) }))
    expect(await verifyPayment('A1', 1000)).toMatchObject({ ok: true, refId: '42', cardPan: '6037**1234' })

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ json: async () => ({ data: [], errors: { code: -51, message: 'failed' } }) }))
    expect((await verifyPayment('A1', 1000)).ok).toBe(false)

    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network')))
    expect((await verifyPayment('A1', 1000)).ok).toBe(false)
  })

  it('refuses to start a payment without a merchant id', async () => {
    vi.stubEnv('ZARINPAL_MERCHANT_ID', '')
    const { requestPayment } = await import('@/lib/payments/zarinpal')
    const res = await requestPayment({ amountRial: 1000, callbackUrl: 'x', description: 'x' })
    expect(res.ok).toBe(false)
  })
})
