import { describe, it, expect } from 'vitest'
import { createLeadSchema } from '@/lib/validation/lead'

describe('Lead Submission Validation Schema (lib/validation/lead.ts)', () => {
  it('successfully validates and normalizes a standard lead submission', () => {
    const input = {
      name: 'سارا کریمی',
      phone: '۰۹۱۲۳۴۵۶۷۸۹',
      email: 'sara@example.com',
      petType: 'گربه پرشین',
      serviceInterest: 'vaccination',
      message: 'درخواست واکسیناسیون سالانه',
      utmSource: 'google',
      utmMedium: 'cpc',
      utmCamp: 'tehran_vaccine',
      utmTerm: 'واکسن سگ تهران',
      referrer: 'https://google.com',
      landingPage: '/contact',
    }

    const result = createLeadSchema.safeParse(input)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.name).toBe('سارا کریمی')
      expect(result.data.phone).toBe('+989123456789') // Normalized to E.164
      expect(result.data.email).toBe('sara@example.com')
      expect(result.data.petType).toBe('گربه پرشین')
      expect(result.data.utmSource).toBe('google')
      expect(result.data.utmCamp).toBe('tehran_vaccine')
    }
  })

  it('accepts valid Tehran clinic landline as lead phone', () => {
    const input = {
      phone: '۰۲۱-۲۶۴۲۹۷۱۵',
    }
    const result = createLeadSchema.safeParse(input)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.phone).toBe('+982126429715')
    }
  })

  it('rejects an invalid phone format', () => {
    const input = {
      phone: '12345',
    }
    const result = createLeadSchema.safeParse(input)
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues[0].message).toContain('شماره تماس')
    }
  })

  it('rejects an invalid email format when provided', () => {
    const input = {
      phone: '09121234567',
      email: 'not-an-email',
    }
    const result = createLeadSchema.safeParse(input)
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues[0].message).toContain('ایمیل')
    }
  })

  it('permits empty or omitted optional fields', () => {
    const input = {
      phone: '09121234567',
      email: '',
      name: '',
      message: '',
    }
    const result = createLeadSchema.safeParse(input)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.email).toBeNull()
      expect(result.data.name).toBeNull()
      expect(result.data.phone).toBe('+989121234567')
    }
  })
})
