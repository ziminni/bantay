import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'

interface SectionProps {
  title?: ReactNode
  description?: ReactNode
  /** A small icon shown before the title. */
  icon?: ReactNode
  /** Buttons or links shown at the right of the title. */
  actions?: ReactNode
  /** Remove the inner padding, for tables that run edge to edge. */
  flush?: boolean
  className?: string
  children: ReactNode
}

/** A white card that groups related content on a page. */
export function Section({ title, description, icon, actions, flush, className, children }: SectionProps) {
  return (
    <section className={cn('overflow-hidden rounded-2xl border border-gray-200/80 bg-white shadow-card', className)}>
      {(title || actions) && (
        <header className="flex flex-wrap items-start justify-between gap-3 border-b border-gray-100 px-5 py-4 sm:px-6">
          <div className={cn('flex min-w-0 gap-3', description ? 'items-start' : 'items-center')}>
            {icon && (
              <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-navy-50 text-navy-700 [&_svg]:size-4">
                {icon}
              </span>
            )}
            <div className="min-w-0">
              {title && <h2 className="text-base font-semibold text-navy-900">{title}</h2>}
              {description && <p className="mt-0.5 text-sm text-gray-500">{description}</p>}
            </div>
          </div>
          {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
        </header>
      )}
      <div className={cn(!flush && 'p-5 sm:p-6')}>{children}</div>
    </section>
  )
}
