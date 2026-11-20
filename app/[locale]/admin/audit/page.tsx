import { db } from '@/lib/db'
import { AuditManager } from '@/components/admin/audit-manager'
import { requireAdmin } from '@/lib/auth/guard'
import { buildAuditWhere, parseAuditQuery } from '@/lib/admin/audit-view'

export const dynamic = 'force-dynamic'

export default async function AdminAuditPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const { locale } = await params
  await requireAdmin('ADMIN', locale)
  const query = parseAuditQuery(await searchParams)
  const where = buildAuditWhere(query) as never

  const [logs, total, entityRows, staff] = await Promise.all([
    db.auditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (query.page - 1) * query.size,
      take: query.size,
      include: { user: { select: { id: true, name: true, email: true } } },
    }),
    db.auditLog.count({ where }),
    db.auditLog.groupBy({ by: ['entity'], orderBy: { entity: 'asc' }, take: 100 }),
    db.user.findMany({
      where: { deletedAt: null, role: { not: 'AUTHOR' } },
      select: { id: true, name: true, email: true },
      orderBy: { name: 'asc' },
      take: 100,
    }),
  ])

  return (
    <AuditManager
      logs={logs.map((l) => ({ ...l, createdAt: l.createdAt.toISOString() }))}
      total={total}
      query={query}
      entities={entityRows.map((e) => e.entity)}
      users={staff.map((u) => ({ id: u.id, label: u.name || u.email || u.id }))}
    />
  )
}
