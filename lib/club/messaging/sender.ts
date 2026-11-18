import 'server-only'
import { marketingSmsStatus, sendMarketingSms, type MarketingSmsResult, type MarketingSmsStatus } from '@/lib/sms'

/** One SMS to one phone. Tests and tools can pass their own implementation to processOutbox. */
export type SendFn = (phone: string, text: string) => Promise<MarketingSmsResult>

export const defaultSender: SendFn = (phone, text) => sendMarketingSms(phone, text)

export interface SenderStatus extends MarketingSmsStatus {
  /** Persian explanation for the admin banner; null when everything is fine. */
  message: string | null
}

export function senderStatus(): SenderStatus {
  const s = marketingSmsStatus()
  if (s.configured) return { ...s, message: s.provider === 'console' ? 'پیامک‌ها فقط در لاگ سرور ثبت می‌شوند (حالت آزمایشی).' : null }
  return {
    ...s,
    message: `در انتظار اتصال سرویس پیامک: پیام‌ها در صف می‌مانند و از بین نمی‌روند. متغیرهای محیطی لازم: ${s.missing.join('، ')}`,
  }
}
