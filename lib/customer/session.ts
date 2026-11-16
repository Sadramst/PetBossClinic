import 'server-only';
import crypto from 'crypto';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { db } from '@/lib/db';

/**
 * Customer (shop) sessions: a signed, httpOnly cookie, independent of the admin
 * session. The key is derived from AUTH_SECRET so an admin token can never be
 * replayed as a customer token or vice versa.
 */
const COOKIE = 'pb_customer';
const MAX_AGE_SECONDS = 60 * 60 * 24 * 30; // 30 days

interface CustomerToken {
  cid: string;
  exp: number;
}

function key(): string {
  const secret = process.env.NEXTAUTH_SECRET || process.env.AUTH_SECRET;
  if (!secret && process.env.NODE_ENV === 'production') {
    throw new Error('AUTH_SECRET is not set. Refusing to sign customer sessions.');
  }
  return crypto
    .createHmac('sha256', secret || 'petboss-local-development-secret-not-for-production')
    .update('customer-session-v1')
    .digest('hex');
}

export function signCustomerToken(customerId: string, now = Date.now()): string {
  const payload: CustomerToken = { cid: customerId, exp: Math.floor(now / 1000) + MAX_AGE_SECONDS };
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = crypto.createHmac('sha256', key()).update(body).digest('base64url');
  return `${body}.${sig}`;
}

export function verifyCustomerToken(token: string | undefined, now = Date.now()): string | null {
  if (!token) return null;
  const [body, sig] = token.split('.');
  if (!body || !sig) return null;
  const expected = crypto.createHmac('sha256', key()).update(body).digest('base64url');
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString()) as CustomerToken;
    if (!payload.cid || payload.exp * 1000 < now) return null;
    return payload.cid;
  } catch {
    return null;
  }
}

export async function setCustomerCookie(customerId: string): Promise<void> {
  (await cookies()).set(COOKIE, signCustomerToken(customerId), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: MAX_AGE_SECONDS,
  });
}

export async function clearCustomerCookie(): Promise<void> {
  (await cookies()).delete(COOKIE);
}

/** The signed-in, non-blocked customer, or null. */
export async function getCustomer() {
  const id = verifyCustomerToken((await cookies()).get(COOKIE)?.value);
  if (!id) return null;
  const customer = await db.customer.findUnique({ where: { id } });
  return customer && !customer.isBlocked ? customer : null;
}

/**
 * Only allow same-site relative paths as post-login targets (no open redirects).
 * Control characters and backslashes are rejected anywhere: browsers strip tabs and
 * newlines while parsing, so "/\t/evil.com" would otherwise become "//evil.com".
 */
export function safeNext(next: string | null | undefined, fallback = '/account'): string {
  if (!next || next.length > 500) return fallback;
  if (!/^\/(?!\/)[^\x00-\x20\\]*$/.test(next)) return fallback;
  return next;
}

export async function requireCustomer(next: string) {
  const customer = await getCustomer();
  if (!customer) redirect(`/account/login?next=${encodeURIComponent(safeNext(next))}`);
  return customer;
}
