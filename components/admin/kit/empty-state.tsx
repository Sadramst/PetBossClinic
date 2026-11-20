import type { ReactNode } from 'react'
import { EmptyState as BaseEmptyState } from '@/components/ui/empty-state'

export interface AdminEmptyStateProps {
  title: string
  description?: string
  action?: ReactNode
  icon?: ReactNode
}

export function EmptyState({ title, description, action, icon }: AdminEmptyStateProps) {
  return (
    <div data-testid="empty-state">
      <BaseEmptyState variant="card" size="sm" icon={icon} title={title} description={description} action={action} />
    </div>
  )
}
