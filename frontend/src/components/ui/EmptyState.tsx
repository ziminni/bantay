import type { ReactNode } from 'react'
import { BrandMark } from '@/components/brand/BrandMark'

export function EmptyState({
  title,
  description,
  action,
  icon,
}: {
  title: ReactNode
  description?: ReactNode
  action?: ReactNode
  /** Defaults to the Bantay eye, faded. */
  icon?: ReactNode
}) {
  return (
    <div className="flex animate-fade-in flex-col items-center justify-center gap-2 px-6 py-14 text-center">
      <div className="mb-2 flex size-14 items-center justify-center rounded-2xl bg-gray-50 text-gray-300 ring-1 ring-gray-100 [&_svg]:size-7">
        {icon ?? <BrandMark tone="muted" className="size-8" />}
      </div>
      <p className="font-display text-base font-semibold text-navy-900">{title}</p>
      {description && <p className="max-w-sm text-sm text-gray-500">{description}</p>}
      {action && <div className="mt-3">{action}</div>}
    </div>
  )
}
