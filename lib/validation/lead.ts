import { z } from 'zod';
import { isValidIranianPhone, normalizeIranianPhone } from '../utils/phone';

export const createLeadSchema = z.object({
  name: z
    .string()
    .max(100, { message: 'نام نمی‌تواند بیش از ۱۰۰ کاراکتر باشد' })
    .optional()
    .nullable()
    .transform((v) => (v ? v.trim() : null)),
  phone: z
    .string({ required_error: 'شماره تماس الزامی است' })
    .min(8, { message: 'شماره تماس باید حداقل ۸ رقم باشد' })
    .max(25, { message: 'شماره تماس نامعتبر است' })
    .refine((val) => isValidIranianPhone(val), {
      message: 'شماره تماس وارد شده معتبر نیست (نمونه: ۰۹۱۲۳۴۵۶۷۸۹ یا ۰۲۱۲۶۴۲۹۷۱۵)',
    })
    .transform((val) => normalizeIranianPhone(val)),
  email: z
    .string()
    .email({ message: 'فرمت ایمیل نامعتبر است' })
    .max(150)
    .optional()
    .nullable()
    .or(z.literal(''))
    .transform((v) => (v ? v.trim().toLowerCase() : null)),
  petType: z
    .string()
    .max(50)
    .optional()
    .nullable()
    .or(z.literal(''))
    .transform((v) => (v ? v.trim() : null)),
  serviceInterest: z
    .string()
    .max(100)
    .optional()
    .nullable()
    .or(z.literal(''))
    .transform((v) => (v ? v.trim() : null)),
  message: z
    .string()
    .max(2000, { message: 'پیام نمی‌تواند بیش از ۲۰۰۰ کاراکتر باشد' })
    .optional()
    .nullable()
    .or(z.literal(''))
    .transform((v) => (v ? v.trim() : null)),
  honeypot: z
    .string()
    .optional()
    .nullable()
    .transform((v) => (v ? v.trim() : '')),
  utmSource: z.string().max(100).optional().nullable(),
  utmMedium: z.string().max(100).optional().nullable(),
  utmCamp: z.string().max(100).optional().nullable(),
  utmTerm: z.string().max(100).optional().nullable(),
  utmContent: z.string().max(100).optional().nullable(),
  referrer: z.string().max(500).optional().nullable(),
  landingPage: z.string().max(500).optional().nullable(),
  source: z.string().max(50).default('WEBSITE_CONTACT'),
});

export type CreateLeadInput = z.input<typeof createLeadSchema>;
export type CreateLeadOutput = z.output<typeof createLeadSchema>;
