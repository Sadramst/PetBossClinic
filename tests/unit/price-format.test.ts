import { describe, it, expect } from 'vitest';
import { formatPrice, formatServicePrice } from '@/lib/format/price';

describe('formatPrice', () => {
  it('returns "تماس بگیرید" for null, undefined, 0, or negative price in Farsi', () => {
    expect(formatPrice(null, 'fa')).toBe('تماس بگیرید');
    expect(formatPrice(undefined, 'fa')).toBe('تماس بگیرید');
    expect(formatPrice(0, 'fa')).toBe('تماس بگیرید');
    expect(formatPrice(-500, 'fa')).toBe('تماس بگیرید');
  });

  it('returns "Call for price" for null, undefined, 0, or negative price in English', () => {
    expect(formatPrice(null, 'en')).toBe('Call for price');
    expect(formatPrice(undefined, 'en')).toBe('Call for price');
    expect(formatPrice(0, 'en')).toBe('Call for price');
    expect(formatPrice(-100, 'en')).toBe('Call for price');
  });

  it('formats positive prices with Persian digits and تومان in Farsi', () => {
    const formatted = formatPrice(125000, 'fa');
    expect(formatted).toContain('تومان');
    // Check that it does not contain Latin digits
    expect(formatted).not.toMatch(/[0-9]/);
  });

  it('formats positive prices with Latin digits and Tomans in English', () => {
    const formatted = formatPrice(125000, 'en');
    expect(formatted).toBe('125,000 Tomans');
  });
});

describe('formatServicePrice', () => {
  it('handles ON_REQUEST mode', () => {
    expect(formatServicePrice('ON_REQUEST', 50000, 100000, 'fa')).toBe('تماس بگیرید');
    expect(formatServicePrice('ON_REQUEST', 50000, 100000, 'en')).toBe('Call for price');
  });

  it('handles FROM mode', () => {
    expect(formatServicePrice('FROM', 250000, null, 'en')).toBe('From 250,000 Tomans');
    const faFrom = formatServicePrice('FROM', 250000, null, 'fa');
    expect(faFrom).toContain('از');
    expect(faFrom).toContain('تومان');
  });

  it('handles RANGE mode', () => {
    expect(formatServicePrice('RANGE', 100000, 200000, 'en')).toBe('100,000 – 200,000 Tomans');
    const faRange = formatServicePrice('RANGE', 100000, 200000, 'fa');
    expect(faRange).toContain('الی');
    expect(faRange).toContain('تومان');
  });

  it('falls back to "تماس بگیرید" when priceFrom is zero or null in RANGE/FROM mode', () => {
    expect(formatServicePrice('RANGE', 0, 0, 'fa')).toBe('تماس بگیرید');
    expect(formatServicePrice('FROM', null, null, 'en')).toBe('Call for price');
  });
});
