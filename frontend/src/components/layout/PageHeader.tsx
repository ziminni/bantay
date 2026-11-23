import { ArrowLeft } from 'lucide-react'
import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'

interface PageHeaderProps {
  title: string
  description?: ReactNode
  /** Primary actions, shown on the right. */
  actions?: ReactNode
  /** A "back" link above the title, for detail pages. */
  back?: { to: string; label: string }
  /** Something shown before the title, such as an avatar on a person's page. */
  leading?: ReactNode
}

/** Every page starts with this: a title, one sentence on what the page is for, and its main actions. */
export function PageHeader({ title, description, actions, back, leading }: PageHeaderProps) {
  useDocumentTitle(title)
  return (
    <div className="mb-8 animate-fade-in">
      {back && (
        <Link
          to={back.to}
          className="group mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-gray-500 transition-colors hover:text-navy-900"
        >
          <ArrowLeft className="size-4 transition-transform group-hover:-translate-x-0.5" />
          {back.label}
        </Link>
      )}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex min-w-0 items-center gap-4">
          {leading}
          <div className="min-w-0">
            <h1 className="font-display text-[1.75rem] leading-tight font-semibold tracking-tight text-navy-900 sm:text-3xl">
              {title}
            </h1>
            {description && <p className="mt-1.5 max-w-2xl text-sm text-gray-500 sm:text-[15px]">{description}</p>}
          </div>
        </div>
        {actions && <div className="flex shrink-0 flex-wrap items-center gap-3">{actions}</div>}
      </div>
    </div>
  )
}
