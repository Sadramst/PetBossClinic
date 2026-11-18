import 'server-only';
import crypto from 'crypto';
import { promisify } from 'util';

const scrypt = promisify(crypto.scrypt) as (password: string, salt: Buffer, keylen: number, options: crypto.ScryptOptions) => Promise<Buffer>;

/**
 * Customer passwords: scrypt with a random salt per password. The stored format is
 * `scrypt$<N>$<saltHex>$<hashHex>`, so the cost can be raised later without breaking
 * existing hashes. Comparison is constant-time.
 */
const N = 16384;
const KEYLEN = 64;

export const PASSWORD_MIN = 8;
export const PASSWORD_MAX = 72;

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.randomBytes(16);
  const hash = await scrypt(password, salt, KEYLEN, { N, r: 8, p: 1, maxmem: 64 * 1024 * 1024 });
  return `scrypt$${N}$${salt.toString('hex')}$${hash.toString('hex')}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [scheme, n, saltHex, hashHex] = stored.split('$');
  if (scheme !== 'scrypt' || !n || !saltHex || !hashHex) return false;
  const cost = Number(n);
  if (!Number.isInteger(cost) || cost < 1024 || cost > 1 << 20) return false;
  // Strict hex of the exact length we write: an empty or truncated hash must never match.
  if (!/^[0-9a-f]+$/.test(saltHex) || !/^[0-9a-f]+$/.test(hashHex) || saltHex.length < 16 || hashHex.length !== KEYLEN * 2) return false;
  try {
    const expected = Buffer.from(hashHex, 'hex');
    const actual = await scrypt(password, Buffer.from(saltHex, 'hex'), expected.length, { N: cost, r: 8, p: 1, maxmem: 128 * 1024 * 1024 });
    return actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}

let dummyHash: Promise<string> | null = null;

/**
 * Spends the same time as a real check. Used when the phone has no password, so the
 * response time does not reveal which numbers have accounts.
 */
export async function burnPasswordCheck(password: string): Promise<void> {
  dummyHash ??= hashPassword('not-a-real-password');
  await verifyPassword(password, await dummyHash);
}

/** A Persian error message, or null when the password is acceptable. */
export function validatePassword(password: string, phone?: string): string | null {
  if (password.length < PASSWORD_MIN) return `رمز عبور باید حداقل ${PASSWORD_MIN.toLocaleString('fa-IR')} نویسه باشد.`;
  if (password.length > PASSWORD_MAX) return `رمز عبور نباید بیشتر از ${PASSWORD_MAX.toLocaleString('fa-IR')} نویسه باشد.`;
  if (/^[\d۰-۹٠-٩]+$/.test(password)) return 'رمز عبور نباید فقط از عدد تشکیل شده باشد؛ چند حرف هم اضافه کنید.';
  if (/^(.)\1+$/u.test(password)) return 'رمز عبور بیش از حد ساده است.';
  if (phone && password.includes(phone.slice(-8))) return 'رمز عبور نباید شامل شماره موبایل شما باشد.';
  return null;
}
