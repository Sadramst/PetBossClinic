import 'server-only';

/**
 * SMS delivery for login codes. Provider is chosen with SMS_PROVIDER:
 *  - "kavenegar": Kavenegar Verify Lookup (KAVENEGAR_API_KEY, KAVENEGAR_OTP_TEMPLATE)
 *  - "smsir":     SMS.ir Verify (SMSIR_API_KEY, SMSIR_OTP_TEMPLATE_ID; template param name "CODE")
 *  - unset:       development only, the code is printed to the server log.
 * Iranian operators require pre-approved templates for OTP messages, which is why
 * both providers use their "verify/lookup" template APIs instead of free text.
 */
export interface SmsResult {
  ok: boolean;
  error?: string;
}

async function kavenegar(phone: string, code: string): Promise<SmsResult> {
  const apiKey = process.env.KAVENEGAR_API_KEY;
  const template = process.env.KAVENEGAR_OTP_TEMPLATE;
  if (!apiKey || !template) return { ok: false, error: 'Kavenegar is not configured' };
  const url = new URL(`https://api.kavenegar.com/v1/${encodeURIComponent(apiKey)}/verify/lookup.json`);
  url.searchParams.set('receptor', phone);
  url.searchParams.set('token', code);
  url.searchParams.set('template', template);
  const res = await fetch(url, { method: 'POST', signal: AbortSignal.timeout(10000) });
  const body = (await res.json().catch(() => null)) as { return?: { status?: number; message?: string } } | null;
  return body?.return?.status === 200 ? { ok: true } : { ok: false, error: body?.return?.message || `HTTP ${res.status}` };
}

async function smsir(phone: string, code: string): Promise<SmsResult> {
  const apiKey = process.env.SMSIR_API_KEY;
  const templateId = Number(process.env.SMSIR_OTP_TEMPLATE_ID);
  if (!apiKey || !templateId) return { ok: false, error: 'SMS.ir is not configured' };
  const res = await fetch('https://api.sms.ir/v1/send/verify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey },
    body: JSON.stringify({ mobile: phone, templateId, parameters: [{ name: 'CODE', value: code }] }),
    signal: AbortSignal.timeout(10000),
  });
  const body = (await res.json().catch(() => null)) as { status?: number; message?: string } | null;
  return body?.status === 1 ? { ok: true } : { ok: false, error: body?.message || `HTTP ${res.status}` };
}

export async function sendOtpSms(phone: string, code: string): Promise<SmsResult> {
  const provider = process.env.SMS_PROVIDER;
  try {
    if (provider === 'kavenegar') return await kavenegar(phone, code);
    if (provider === 'smsir') return await smsir(phone, code);
  } catch (err) {
    console.error('SMS send failed', err);
    return { ok: false, error: 'SMS provider unreachable' };
  }
  if (process.env.NODE_ENV !== 'production') {
    console.warn(`[dev-sms] login code for ${phone}: ${code}`);
    return { ok: true };
  }
  return { ok: false, error: 'No SMS provider configured' };
}
