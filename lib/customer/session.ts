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
  /** Customer.sessionVersion when the token was issued (absent = 0, for older tokens). */
  v?: number;
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

export function signCustomerToken(customerId: string, now = Date.now(), version = 0): string {
  const payload: CustomerToken = { cid: customerId, exp: Math.floor(now / 1000) + MAX_AGE_SECONDS, v: version };
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = crypto.createHmac('sha256', key()).update(body).digest('base64url');
  return `${body}.${sig}`;
}

/** Verifies signature and expiry; returns the customer id and session version, or null. */
export function parseCustomerToken(token: string | undefined, now = Date.now()): { id: string; version: number } | null {
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
    return { id: payload.cid, version: payload.v ?? 0 };
  } catch {
    return null;
  }
}

export function verifyCustomerToken(token: string | undefined, now = Date.now()): string | null {
  return parseCustomerToken(token, now)?.id ?? null;
}

/** Starts a session. `version` must be the customer's current sessionVersion. */
export async function setCustomerCookie(customerId: string, version = 0): Promise<void> {
  (await cookies()).set(COOKIE, signCustomerToken(customerId, Date.now(), version), {
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

/**
 * The signed-in, non-blocked customer, or null. A token only works while its version
 * matches the customer's current sessionVersion, so logging out (or changing the
 * password) ends every session that was issued before.
 */
export async function getCustomer() {
  const token = parseCustomerToken((await cookies()).get(COOKIE)?.value);
  if (!token) return null;
  const customer = await db.customer.findUnique({ where: { id: token.id } });
  if (!customer || customer.isBlocked || customer.sessionVersion !== token.version) return null;
  return customer;
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
