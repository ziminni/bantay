import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'

interface SectionProps {
  title?: ReactNode
  description?: ReactNode
  /** Buttons or links shown at the right of the title. */
  actions?: ReactNode
  /** Remove the inner padding, for tables that run edge to edge. */
  flush?: boolean
  className?: string
  children: ReactNode
}

/** A bordered white box that groups related content on a page. */
export function Section({ title, description, actions, flush, className, children }: SectionProps) {
  return (
    <section className={cn('rounded-lg border border-gray-200 bg-white', className)}>
      {(title || actions) && (
        <header className="flex flex-wrap items-start justify-between gap-3 border-b border-gray-200 px-5 py-4">
          <div className="min-w-0">
            {title && <h2 className="text-base font-semibold text-gray-900">{title}</h2>}
            {description && <p className="mt-1 text-sm text-gray-500">{description}</p>}
          </div>
          {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
        </header>
      )}
      <div className={cn(!flush && 'p-5')}>{children}</div>
    </section>
  )
}
