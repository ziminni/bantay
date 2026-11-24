import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'
import { EmptyState } from './EmptyState'
import { LoadingState } from './LoadingState'

export interface Column<T> {
  key: string
  header: ReactNode
  cell: (row: T) => ReactNode
  align?: 'left' | 'right'
  /** Hide on narrow screens to keep the table readable. */
  hideBelow?: 'sm' | 'md' | 'lg'
  className?: string
}

interface DataTableProps<T> {
  columns: Column<T>[]
  rows: T[] | undefined
  rowKey: (row: T) => string | number
  loading?: boolean
  /** Makes each row clickable (e.g. to open details). */
  onRowClick?: (row: T) => void
  rowLabel?: (row: T) => string
  empty?: ReactNode
  caption?: string
}

const hide = { sm: 'hidden sm:table-cell', md: 'hidden md:table-cell', lg: 'hidden lg:table-cell' }

export function DataTable<T>({
  columns,
  rows,
  rowKey,
  loading,
  onRowClick,
  rowLabel,
  empty,
  caption,
}: DataTableProps<T>) {
  if (loading && !rows) return <LoadingState />
  if (rows && rows.length === 0) return <>{empty ?? <EmptyState title="Nothing to show" />}</>

  return (
    <div className={cn('overflow-x-auto transition-opacity', loading && 'opacity-60')}>
      <table className="w-full text-left text-sm">
        {caption && <caption className="sr-only">{caption}</caption>}
        <thead className="border-b border-gray-100 bg-gray-50/70 text-[11px] font-semibold tracking-wider text-gray-500 uppercase">
          <tr>
            {columns.map((c) => (
              <th
                key={c.key}
                scope="col"
                className={cn(
                  'px-4 py-3 whitespace-nowrap first:pl-5 last:pr-5 sm:first:pl-6 sm:last:pr-6',
                  c.align === 'right' && 'text-right',
                  c.hideBelow && hide[c.hideBelow],
                  c.className,
                )}
              >
                {c.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {rows?.map((row) => (
            <tr
              key={rowKey(row)}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
              onKeyDown={
                onRowClick
                  ? (e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault()
                        onRowClick(row)
                      }
                    }
                  : undefined
              }
              tabIndex={onRowClick ? 0 : undefined}
              role={onRowClick ? 'button' : undefined}
              aria-label={onRowClick && rowLabel ? rowLabel(row) : undefined}
              className={cn('transition-colors', onRowClick && 'cursor-pointer hover:bg-marigold-50/40 focus-visible:bg-marigold-50/60')}
            >
              {columns.map((c) => (
                <td
                  key={c.key}
                  className={cn(
                    'px-4 py-3.5 align-middle first:pl-5 last:pr-5 sm:first:pl-6 sm:last:pr-6',
                    c.align === 'right' && 'text-right',
                    c.hideBelow && hide[c.hideBelow],
                    c.className,
                  )}
                >
                  {c.cell(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
