import { db } from '@/lib/db'
import { recomputeAllHealth } from '@/lib/crm/health'
import { recomputeAllLifecycles } from '@/lib/crm/lifecycle'
import { generateCrmTasks } from '@/lib/crm/task-gen'
import { notifyStaff } from '@/lib/crm/notify'
import { dayBounds } from '@/lib/crm/tasks'

async function step<T>(label: string, fallback: T, fn: () => Promise<T>): Promise<T> {
  try {
    return await fn()
  } catch (err) {
    // One failing step must not stop the others; log the error type only (no personal data).
    console.error(`crm daily ${label} failed`, (err as Error)?.name, (err as Error)?.message?.slice(0, 120))
    return fallback
  }
}

/**
 * Nightly CRM maintenance, called from the existing club cron (Vercel Hobby allows no extra cron entries).
 * Order matters: health feeds lifecycle, lifecycle feeds the win-back tasks. Idempotent and safe to run twice.
 */
export async function runCrmDaily(now: Date = new Date()): Promise<{ lifecycle: number; health: number; tasks: number; digest: boolean }> {
  const health = await step('health', { updated: 0 }, () => recomputeAllHealth(now))
  const lifecycle = await step('lifecycle', { updated: 0 }, () => recomputeAllLifecycles(now))
  const tasks = await step('tasks', 0, () => generateCrmTasks(now))
  const digest = await step('digest', false, async () => {
    const day = now.toISOString().slice(0, 10)
    const { end, start } = dayBounds(now)
    let posted = false
    const due = await db.crmTask.count({ where: { status: { in: ['OPEN', 'IN_PROGRESS'] }, dueAt: { lte: end } } })
    if (due > 0) {
      await notifyStaff({ kind: 'TASK_DUE', title: `${due} کار برای امروز یا عقب‌افتاده دارید`, href: '/admin/tasks', minRole: 'EDITOR', dedupeKey: `task-due:${day}` })
      posted = true
    }
    const failed = await db.messageOutbox.count({ where: { status: 'FAILED', createdAt: { gte: new Date(start.getTime() - 86_400_000) } } })
    if (failed > 0) {
      await notifyStaff({ kind: 'OUTBOX_FAILURES', title: `${failed} پیامک ارسال نشد`, href: '/admin/outbox', minRole: 'ADMIN', dedupeKey: `outbox-failed:${day}` })
      posted = true
    }
    return posted
  })
  return { lifecycle: lifecycle.updated, health: health.updated, tasks, digest }
}
