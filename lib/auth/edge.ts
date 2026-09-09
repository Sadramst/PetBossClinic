/**
 * @file edge.ts
 * @description Edge-compatible Web Crypto HMAC-SHA256 session token verification.
 * Runs in Next.js middleware without Node.js crypto or Buffer dependencies.
 */

export type Role = 'SUPER_ADMIN' | 'ADMIN' | 'EDITOR' | 'AUTHOR' | 'VIEWER';

export interface EdgeSessionPayload {
  userId: string;
  email: string;
  name: string;
  role: Role;
  expiresAt: number;
}

const DEFAULT_SECRET = 'petboss-super-secure-secret-key-2026-v1';

function base64UrlToUint8Array(base64Url: string): Uint8Array {
  const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
  const padLen = (4 - (base64.length % 4)) % 4;
  const padded = base64 + '='.repeat(padLen);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/**
 * Verifies HMAC-SHA256 signature of a session token on Next.js Edge runtime.
 * Token format: <encodedPayload>.<signature>
 */
export async function verifySessionTokenEdge(
  token: string,
  secret: string = process.env.NEXTAUTH_SECRET || process.env.AUTH_SECRET || DEFAULT_SECRET
): Promise<EdgeSessionPayload | null> {
  try {
    if (!token || typeof token !== 'string') return null;

    const parts = token.split('.');
    if (parts.length !== 2) return null;

    const [encodedPayload, signature] = parts;
    if (!encodedPayload || !signature) return null;

    const encoder = new TextEncoder();
    const keyData = encoder.encode(secret);

    const cryptoKey = await crypto.subtle.importKey(
      'raw',
      keyData,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify']
    );

    const signatureBytes = base64UrlToUint8Array(signature);
    const dataBytes = encoder.encode(encodedPayload);

    // Pass TypedArrays directly; avoid .buffer property which can fail cross-realm instanceof in Edge runtime
    const signatureBuffer = new Uint8Array(signatureBytes);
    const dataBuffer = new Uint8Array(dataBytes);

    const isValid = await crypto.subtle.verify(
      'HMAC',
      cryptoKey,
      signatureBuffer,
      dataBuffer
    );

    if (!isValid) return null;

    const payloadBytes = base64UrlToUint8Array(encodedPayload);
    const payloadJson = new TextDecoder().decode(payloadBytes);
    const payload: EdgeSessionPayload = JSON.parse(payloadJson);

    // Check expiry
    const nowInSeconds = Math.floor(Date.now() / 1000);
    if (payload.expiresAt && payload.expiresAt < nowInSeconds) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}
