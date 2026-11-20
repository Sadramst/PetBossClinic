'use client'

import type { ReactNode } from 'react'
import { Sheet } from '@/components/ui/sheet'

export interface DrawerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description?: string
  footer?: ReactNode
  /** `start` is the right edge in RTL. */
  side?: 'start' | 'end'
  children: ReactNode
}

/** Side panel for create and edit forms. Wraps the native-dialog Sheet. */
export function Drawer({ open, onOpenChange, title, description, footer, side = 'start', children }: DrawerProps) {
  return (
    <Sheet open={open} onClose={() => onOpenChange(false)} title={title} side={side} footer={footer}>
      {description && <p className="mb-4 text-sm leading-7 text-muted-foreground">{description}</p>}
      {children}
    </Sheet>
  )
}
