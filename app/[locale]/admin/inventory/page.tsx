import { db } from '@/lib/db'
import { requireAdmin } from '@/lib/auth/guard'
import { hasRoleAccess } from '@/lib/auth'
import { InventoryBoard } from '@/components/admin/inventory/inventory-board'
import { listBatches, expirySummary } from '@/lib/shop/inventory-admin'
import { getExpiryConfig } from '@/lib/shop/expiry-config'
import type { ExpiryState } from '@/lib/shop/expiry'

export const dynamic = 'force-dynamic'

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? ''
const STATES: ExpiryState[] = ['expired', 'critical', 'soon', 'ok', 'none']

export default async function AdminInventoryPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const { locale } = await params
  const session = await requireAdmin('VIEWER', locale)
  const sp = await searchParams

  const state = STATES.find((s) => s === one(sp.state))
  const size = [25, 50, 100].includes(Number(one(sp.size))) ? Number(one(sp.size)) : 25
  const page = Math.max(1, Math.floor(Number(one(sp.page))) || 1)

  const [list, summary, config, digest] = await Promise.all([
    listBatches({ state, q: one(sp.q).slice(0, 80), location: one(sp.location).slice(0, 80), page, size }),
    expirySummary(),
    getExpiryConfig(),
    db.expiryConfig.findUnique({ where: { id: 'default' }, select: { digestPhones: true } }).catch(() => null),
  ])

  return (
    <InventoryBoard
      rows={list.rows}
      total={list.total}
      page={list.page}
      size={list.size}
      summary={summary}
      config={config}
      digestPhones={digest?.digestPhones ?? []}
      canAdmin={hasRoleAccess(session.role, 'ADMIN')}
      openNew={one(sp.new) === '1'}
    />
  )
}
