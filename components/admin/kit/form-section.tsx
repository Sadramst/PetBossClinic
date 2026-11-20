import type { ReactNode } from 'react'

export interface FormSectionProps {
  title: string
  description?: string
  children: ReactNode
}

/** A titled block inside an editor page. */
export function FormSection({ title, description, children }: FormSectionProps) {
  return (
    <section className="rounded-2xl border border-border bg-surface-card">
      <header className="border-b border-border px-4 py-3">
        <h2 className="text-sm font-extrabold">{title}</h2>
        {description && <p className="mt-0.5 text-xs leading-6 text-muted-foreground">{description}</p>}
      </header>
      <div className="space-y-4 p-4">{children}</div>
    </section>
  )
}
