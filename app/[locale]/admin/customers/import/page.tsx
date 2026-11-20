import { requireAdmin } from '@/lib/auth/guard'
import { ImportWizard } from '@/components/admin/crm/import-wizard'

export const dynamic = 'force-dynamic'

export default async function ImportCustomersPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  await requireAdmin('ADMIN', locale)
  return <ImportWizard />
}
