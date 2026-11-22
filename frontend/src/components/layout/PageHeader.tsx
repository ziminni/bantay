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
}

/** Every page starts with this: a title, one sentence on what the page is for, and its main actions. */
export function PageHeader({ title, description, actions, back }: PageHeaderProps) {
  useDocumentTitle(title)
  return (
    <div className="mb-8">
      {back && (
        <Link to={back.to} className="mb-3 inline-block text-sm text-gray-500 hover:text-gray-900">
          ← {back.label}
        </Link>
      )}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight text-gray-900">{title}</h1>
          {description && <p className="mt-1 text-sm text-gray-500">{description}</p>}
        </div>
        {actions && <div className="flex shrink-0 flex-wrap items-center gap-3">{actions}</div>}
      </div>
    </div>
  )
}
