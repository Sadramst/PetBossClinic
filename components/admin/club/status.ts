export type Tone = 'success' | 'warning' | 'danger' | 'neutral' | 'info' | 'gold'

export const CAMPAIGN_STATUS: Record<string, { label: string; tone: Tone }> = {
  DRAFT: { label: 'پیش‌نویس', tone: 'neutral' },
  SCHEDULED: { label: 'زمان‌بندی‌شده', tone: 'info' },
  RUNNING: { label: 'در حال ارسال', tone: 'warning' },
  DONE: { label: 'انجام شد', tone: 'success' },
  CANCELLED: { label: 'لغو شد', tone: 'neutral' },
}

export const MESSAGE_STATUS: Record<string, { label: string; tone: Tone }> = {
  QUEUED: { label: 'در صف', tone: 'warning' },
  SENDING: { label: 'در حال ارسال', tone: 'info' },
  SENT: { label: 'ارسال شد', tone: 'success' },
  FAILED: { label: 'ناموفق', tone: 'danger' },
  SKIPPED: { label: 'رد شد', tone: 'neutral' },
  CANCELLED: { label: 'لغو شد', tone: 'neutral' },
}

export const MESSAGE_KIND: Record<string, string> = {
  campaign: 'کمپین',
  admin: 'دستی',
  system: 'سیستمی',
  'automation:vaccine': 'یادآوری واکسن',
  'automation:birthday': 'تولد',
  'automation:petBirthday': 'تولد حیوان',
  'automation:ownerBirthday': 'تولد مشتری',
  'automation:repeatPurchase': 'خرید مجدد',
  'automation:winback': 'بازگشت مشتری',
  'automation:abandonedCart': 'سبد رهاشده',
}
