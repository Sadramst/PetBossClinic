import 'server-only';
import crypto from 'crypto';
import { db } from '@/lib/db';

export const OTP_TTL_SECONDS = 120;
export const OTP_RESEND_SECONDS = 60;
export const OTP_MAX_PER_HOUR = 5;
export const OTP_MAX_ATTEMPTS = 5;

function hashCode(phone: string, code: string): string {
  const secret = process.env.NEXTAUTH_SECRET || process.env.AUTH_SECRET || 'petboss-local-development-secret-not-for-production';
  return crypto.createHmac('sha256', secret).update(`otp:${phone}:${code}`).digest('hex');
}

export function generateCode(): string {
  return String(crypto.randomInt(10000, 100000)); // 5 digits
}

export type IssueResult = { ok: true; code: string } | { ok: false; error: string; retryAfter?: number };

/** Creates a new code unless the phone is rate limited. Previous codes are invalidated. */
export async function issueOtp(phone: string, ip: string | null, now = new Date()): Promise<IssueResult> {
  const hourAgo = new Date(now.getTime() - 3600_000);
  const recent = await db.otpCode.findMany({
    where: { phone, createdAt: { gt: hourAgo } },
    orderBy: { createdAt: 'desc' },
    select: { createdAt: true },
  });
  if (recent.length >= OTP_MAX_PER_HOUR) {
    return { ok: false, error: 'تعداد درخواست کد بیش از حد مجاز است. یک ساعت دیگر تلاش کنید.' };
  }
  const last = recent[0];
  if (last) {
    const wait = OTP_RESEND_SECONDS - Math.floor((now.getTime() - last.createdAt.getTime()) / 1000);
    if (wait > 0) return { ok: false, error: `لطفاً ${wait.toLocaleString('fa-IR')} ثانیه دیگر دوباره تلاش کنید.`, retryAfter: wait };
  }

  const code = generateCode();
  await db.$transaction([
    db.otpCode.updateMany({ where: { phone, consumedAt: null }, data: { consumedAt: now } }),
    db.otpCode.create({
      data: { phone, ip, codeHash: hashCode(phone, code), expiresAt: new Date(now.getTime() + OTP_TTL_SECONDS * 1000) },
    }),
  ]);
  return { ok: true, code };
}

/** Checks a code; each wrong guess counts, and the code dies after OTP_MAX_ATTEMPTS. */
export async function verifyOtp(phone: string, code: string, now = new Date()): Promise<boolean> {
  const otp = await db.otpCode.findFirst({
    where: { phone, consumedAt: null, expiresAt: { gt: now } },
    orderBy: { createdAt: 'desc' },
  });
  if (!otp || otp.attempts >= OTP_MAX_ATTEMPTS) return false;

  const a = Buffer.from(otp.codeHash, 'hex');
  const b = Buffer.from(hashCode(phone, code), 'hex');
  const match = a.length === b.length && crypto.timingSafeEqual(a, b);

  await db.otpCode.update({
    where: { id: otp.id },
    data: match ? { consumedAt: now } : { attempts: { increment: 1 } },
  });
  return match;
}
