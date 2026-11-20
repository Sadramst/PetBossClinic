import { timingSafeEqual } from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'
import { generateAutomationMessages } from '@/lib/club/automations'
import { processOutbox } from '@/lib/club/messaging/outbox'
import { runCrmDaily } from '@/lib/crm/daily'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

function authorised(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return false
  const given = Buffer.from(req.headers.get('authorization') ?? '')
  const want = Buffer.from(`Bearer ${secret}`)
  return given.length === want.length && timingSafeEqual(given, want)
}

/**
 * Hourly job (Vercel Cron, see vercel.json): queues the automatic reminders (vaccines, birthdays,
 * repeat purchase, win-back, abandoned carts) and sends whatever in the SMS queue is due.
 * Protected by CRON_SECRET, like /api/cron/expiry. Safe to run twice at once: queuing is
 * de-duplicated and every message is claimed atomically before it is sent.
 */
async function run(req: NextRequest) {
  if (!authorised(req)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const automations = await generateAutomationMessages()
  const outbox = await processOutbox({ limit: 200 })
  // CRM v2 nightly work (health, lifecycle, tasks, digest). Never lets a CRM failure hide the SMS result.
  const crm = await runCrmDaily().catch(() => ({ lifecycle: 0, health: 0, tasks: 0, digest: false, failed: true }))
  return NextResponse.json({
    crm,
    automations: automations.map((a) => ({ kind: a.kind, enabled: a.enabled, candidates: a.candidates, queued: a.queued, skipped: a.skipped })),
    outbox,
  })
}

export const GET = run
export const POST = run
