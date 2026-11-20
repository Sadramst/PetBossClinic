import { requireAdmin } from '@/lib/auth/guard'
import { findDuplicates } from '@/lib/crm/dedupe'
import { roleAtLeast } from '@/lib/crm/roles'
import { DuplicatesManager } from '@/components/admin/crm/duplicates-manager'

export const dynamic = 'force-dynamic'

export default async function DuplicateCustomersPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  const session = await requireAdmin('EDITOR', locale)
  const pairs = await findDuplicates({ limit: 100 })
  return <DuplicatesManager initial={pairs} isAdmin={roleAtLeast(session.role, 'ADMIN')} />
}
