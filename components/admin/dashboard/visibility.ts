import type { Role } from '@prisma/client'

export type WidgetId =
  | 'tasks'
  | 'leads'
  | 'messages'
  | 'ordersAction'
  | 'expiry'
  | 'lowStock'
  | 'carts'
  | 'outbox'
  | 'sales'
  | 'churn'
  | 'recentOrders'

const OWNER: Role[] = ['SUPER_ADMIN', 'ADMIN']

/**
 * Who sees which dashboard widget (ADMIN-IA section 4). Owner = SUPER_ADMIN and ADMIN.
 * EDITOR covers reception and shop operator; the other roles have no tile of their own yet.
 */
export const WIDGETS: Record<WidgetId, { roles: Role[] }> = {
  tasks: { roles: [...OWNER, 'EDITOR'] },
  leads: { roles: [...OWNER, 'EDITOR', 'VIEWER'] },
  messages: { roles: [...OWNER, 'EDITOR', 'VIEWER'] },
  ordersAction: { roles: [...OWNER, 'EDITOR', 'VIEWER'] },
  expiry: { roles: [...OWNER, 'EDITOR', 'VIEWER'] },
  lowStock: { roles: [...OWNER, 'EDITOR', 'VIEWER'] },
  carts: { roles: [...OWNER, 'EDITOR'] },
  outbox: { roles: OWNER },
  sales: { roles: [...OWNER, 'VIEWER'] },
  churn: { roles: [...OWNER, 'EDITOR'] },
  recentOrders: { roles: [...OWNER, 'EDITOR', 'VIEWER'] },
}

export function canSeeWidget(role: Role, id: WidgetId): boolean {
  return WIDGETS[id].roles.includes(role)
}

export function visibleWidgets(role: Role): WidgetId[] {
  return (Object.keys(WIDGETS) as WidgetId[]).filter((id) => canSeeWidget(role, id))
}
