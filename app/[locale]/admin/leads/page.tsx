import type { LeadStage } from '@prisma/client'
import { db } from '@/lib/db'
import { requireAdmin } from '@/lib/auth/guard'
import { listLeads, leadStageCounts, LEAD_STAGES } from '@/lib/crm/leads'
import { listStaffOptions } from '@/lib/crm/staff'
import { roleAtLeast } from '@/lib/crm/roles'
import { normalizeFa } from '@/lib/text/persian'
import { LeadsWorkspace } from '@/components/admin/crm/leads-workspace'

export const dynamic = 'force-dynamic'

type SP = { q?: string; stage?: string; owner?: string; source?: string; view?: string; page?: string; new?: string }

export default async function AdminLeadsPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<SP> }) {
  const { locale } = await params
  const session = await requireAdmin('VIEWER', locale)
  const sp = await searchParams
  const board = sp.view !== 'list'
  const stage = (LEAD_STAGES as readonly string[]).includes(sp.stage ?? '') ? (sp.stage as LeadStage) : undefined
  const [list, counts, staff, sources] = await Promise.all([
    listLeads({
      q: normalizeFa(sp.q ?? '').slice(0, 60),
      stage,
      owner: sp.owner?.slice(0, 40) || undefined,
      source: sp.source?.slice(0, 40) || undefined,
      page: board ? 1 : Math.max(1, Number.parseInt(sp.page ?? '1', 10) || 1),
      size: board ? 100 : 25,
      sort: 'newest',
    }),
    leadStageCounts(),
    listStaffOptions(),
    db.lead.groupBy({ by: ['source'], where: { source: { not: null } }, _count: { source: true }, orderBy: { _count: { source: 'desc' } }, take: 12 }),
  ])
  const canEdit = roleAtLeast(session.role, 'EDITOR')
  return (
    <LeadsWorkspace
      leads={list.rows.map((l) => ({
        id: l.id,
        name: l.name,
        phone: l.phone,
        email: l.email,
        petType: l.petType,
        serviceInterest: l.serviceInterest,
        message: l.message,
        source: l.source,
        stage: l.stage,
        lostReason: l.lostReason,
        ownerId: l.ownerId,
        customerId: l.customerId,
        followUpDate: l.followUpDate ? l.followUpDate.toISOString() : null,
        createdAt: l.createdAt.toISOString(),
      }))}
      total={list.total}
      page={list.page}
      size={list.size}
      counts={counts}
      staff={staff}
      sources={sources.map((s) => s.source as string)}
      isAdmin={roleAtLeast(session.role, 'ADMIN')}
      canEdit={canEdit}
      openNew={sp.new === '1' && canEdit}
    />
  )
}
