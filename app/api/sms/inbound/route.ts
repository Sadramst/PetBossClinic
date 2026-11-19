import { timingSafeEqual } from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'
import { unsubscribePhone } from '@/lib/club/messaging/outbox'
import { toLatinDigits } from '@/lib/date/jalali'

export const dynamic = 'force-dynamic'

function authorised(req: NextRequest): boolean {
  const secret = process.env.SMS_INBOUND_SECRET
  if (!secret) return false
  const given = Buffer.from(req.headers.get('x-webhook-secret') ?? req.nextUrl.searchParams.get('secret') ?? '')
  const want = Buffer.from(secret)
  return given.length === want.length && timingSafeEqual(given, want)
}

/**
 * Inbound SMS webhook (configure it at the SMS provider with ?secret=SMS_INBOUND_SECRET).
 * A reply of "1" / "۱" to a marketing message opts the sender out, as the footer promises.
 * Accepts form, JSON or query parameters: from/sender + message/text.
 */
async function handle(req: NextRequest) {
  if (!authorised(req)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const q = req.nextUrl.searchParams
  let from = q.get('from') ?? q.get('sender') ?? ''
  let text = q.get('message') ?? q.get('text') ?? q.get('body') ?? ''
  if (req.method === 'POST') {
    try {
      const ct = req.headers.get('content-type') ?? ''
      if (ct.includes('json')) {
        const j = (await req.json()) as Record<string, unknown>
        from = String(j.from ?? j.sender ?? from)
        text = String(j.message ?? j.text ?? j.body ?? text)
      } else {
        const f = await req.formData()
        from = String(f.get('from') ?? f.get('sender') ?? from)
        text = String(f.get('message') ?? f.get('text') ?? f.get('body') ?? text)
      }
    } catch {
      /* fall back to query values */
    }
  }
  const reply = toLatinDigits(text).trim()
  if (reply === '1') await unsubscribePhone(from)
  return NextResponse.json({ ok: true })
}

export const GET = handle
export const POST = handle
