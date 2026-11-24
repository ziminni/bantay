import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'

export interface DescriptionItem {
  label: ReactNode
  value: ReactNode
}

/** Label/value pairs for detail views. */
export function DescriptionList({ items, columns = 1 }: { items: DescriptionItem[]; columns?: 1 | 2 }) {
  return (
    <dl className={cn('grid gap-x-8 gap-y-5', columns === 2 && 'sm:grid-cols-2')}>
      {items.map((item, i) => (
        <div key={i} className="min-w-0">
          <dt className="text-xs font-medium tracking-wide text-gray-500 uppercase">{item.label}</dt>
          <dd className="mt-1 text-sm break-words text-navy-900">{item.value}</dd>
        </div>
      ))}
    </dl>
  )
}
