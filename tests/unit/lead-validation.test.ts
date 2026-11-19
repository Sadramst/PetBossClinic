import { describe, it, expect } from 'vitest';
import { parseLead, validateLead } from '@/components/marketing/storage';

describe('lead input', () => {
  it('accepts mobiles in several formats', () => {
    for (const v of ['09123456789', '+989123456789', '۰۹۱۲۳۴۵۶۷۸۹', '9123456789']) expect(validateLead(v)).toBeNull();
  });
  it('accepts a valid email and rejects broken ones', () => {
    expect(validateLead('a@b.co')).toBeNull();
    expect(validateLead('a@b')).not.toBeNull();
    expect(validateLead('0912')).not.toBeNull();
    expect(validateLead('  ')).not.toBeNull();
  });
  it('routes to email or phone', () => {
    expect(parseLead(' a@b.co ')).toEqual({ email: 'a@b.co' });
    expect(parseLead('0912')).toEqual({ phone: '0912' });
  });
});
