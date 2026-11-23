import { ChevronLeft, ChevronRight } from 'lucide-react'
import { PAGE_SIZE_OPTIONS } from '@/lib/constants'
import { Button } from './Button'

interface PaginationProps {
  page: number
  pages: number
  total: number
  size: number
  onPageChange: (page: number) => void
  onSizeChange?: (size: number) => void
  /** e.g. "entries", "people" */
  noun?: string
}

export function Pagination({ page, pages, total, size, onPageChange, onSizeChange, noun = 'results' }: PaginationProps) {
  const from = total === 0 ? 0 : (page - 1) * size + 1
  const to = Math.min(page * size, total)

  return (
    <nav
      aria-label="Pagination"
      className="flex flex-col gap-3 border-t border-gray-100 px-5 py-3.5 text-sm text-gray-500 sm:flex-row sm:items-center sm:justify-between sm:px-6"
    >
      <p>
        Showing <span className="font-medium text-gray-900">{from.toLocaleString()}</span>–
        <span className="font-medium text-gray-900">{to.toLocaleString()}</span> of{' '}
        <span className="font-medium text-gray-900">{total.toLocaleString()}</span> {noun}
      </p>

      <div className="flex items-center gap-3">
        {onSizeChange && (
          <label className="flex items-center gap-2">
            <span className="hidden sm:inline">Rows per page</span>
            <select
              value={size}
              onChange={(e) => onSizeChange(Number(e.target.value))}
              className="h-8 cursor-pointer rounded-lg border border-gray-200 bg-white px-2 text-sm text-navy-900 shadow-card"
            >
              {PAGE_SIZE_OPTIONS.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </label>
        )}
        <Button size="sm" onClick={() => onPageChange(page - 1)} disabled={page <= 1} aria-label="Previous page" icon={<ChevronLeft />}>
          <span className="hidden sm:inline">Previous</span>
        </Button>
        <span className="whitespace-nowrap tabular-nums">
          Page <span className="font-medium text-navy-900">{page}</span> of {pages}
        </span>
        <Button size="sm" onClick={() => onPageChange(page + 1)} disabled={page >= pages} aria-label="Next page">
          <span className="hidden sm:inline">Next</span>
          <ChevronRight />
        </Button>
      </div>
    </nav>
  )
}
