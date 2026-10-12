import { db } from '@/lib/db'
import { AuditManager } from '@/components/admin/audit-manager'
import { requireAdmin } from '@/lib/auth/guard'

export const dynamic = 'force-dynamic'

export default async function AdminAuditPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  await requireAdmin('VIEWER', locale)
  const isEn = locale === 'en'

  const logs = await db.auditLog.findMany({
    orderBy: { createdAt: 'desc' },
    take: 200,
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
    },
  })

  // Format date for serialization
  const serializedLogs = logs.map((log) => ({
    ...log,
    createdAt: log.createdAt.toISOString(),
  }))

  return <AuditManager logs={serializedLogs} isEn={isEn} />
}
