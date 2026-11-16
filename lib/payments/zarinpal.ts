import 'server-only';

/**
 * ZarinPal payment gateway (REST v4). Amounts are in Rial.
 * ZARINPAL_MERCHANT_ID is required; ZARINPAL_SANDBOX=1 uses the sandbox host.
 * Docs: https://www.zarinpal.com/docs/paymentGateway/
 */
const host = () => (process.env.ZARINPAL_SANDBOX === '1' ? 'https://sandbox.zarinpal.com' : 'https://payment.zarinpal.com');

export function zarinpalConfigured(): boolean {
  return !!process.env.ZARINPAL_MERCHANT_ID;
}

export function startPayUrl(authority: string): string {
  return `${host()}/pg/StartPay/${encodeURIComponent(authority)}`;
}

interface ZpResponse {
  data?: { code?: number; authority?: string; ref_id?: number; card_pan?: string; message?: string } | [];
  errors?: { code?: number; message?: string } | [];
}

async function post(path: string, body: Record<string, unknown>): Promise<ZpResponse> {
  const res = await fetch(`${host()}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ merchant_id: process.env.ZARINPAL_MERCHANT_ID, ...body }),
    signal: AbortSignal.timeout(15000),
    cache: 'no-store',
  });
  return (await res.json().catch(() => ({}))) as ZpResponse;
}

const dataOf = (r: ZpResponse) => (Array.isArray(r.data) ? undefined : r.data);
const errorOf = (r: ZpResponse) => (Array.isArray(r.errors) ? undefined : r.errors);

export async function requestPayment(opts: {
  amountRial: number;
  callbackUrl: string;
  description: string;
  mobile?: string;
}): Promise<{ ok: true; authority: string; raw: ZpResponse } | { ok: false; error: string; raw?: ZpResponse }> {
  if (!zarinpalConfigured()) return { ok: false, error: 'درگاه پرداخت هنوز تنظیم نشده است.' };
  try {
    const raw = await post('/pg/v4/payment/request.json', {
      amount: opts.amountRial,
      callback_url: opts.callbackUrl,
      description: opts.description,
      metadata: opts.mobile ? { mobile: opts.mobile } : undefined,
    });
    const d = dataOf(raw);
    if (d?.code === 100 && d.authority) return { ok: true, authority: d.authority, raw };
    return { ok: false, error: errorOf(raw)?.message || 'خطا در اتصال به درگاه پرداخت.', raw };
  } catch {
    return { ok: false, error: 'درگاه پرداخت در دسترس نیست. کمی بعد تلاش کنید.' };
  }
}

/** Verifies a payment. Code 100 = verified now, 101 = already verified earlier. */
export async function verifyPayment(authority: string, amountRial: number) {
  try {
    const raw = await post('/pg/v4/payment/verify.json', { amount: amountRial, authority });
    const d = dataOf(raw);
    if (d && (d.code === 100 || d.code === 101)) {
      return { ok: true as const, refId: d.ref_id ? String(d.ref_id) : null, cardPan: d.card_pan ?? null, raw };
    }
    return { ok: false as const, raw };
  } catch {
    return { ok: false as const, raw: null };
  }
}
