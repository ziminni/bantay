import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/Button'

interface FlagQueuePaginationProps {
  page: number
  pages: number
  total: number
  size: number
  onPageChange: (page: number) => void
  onSizeChange: (size: number) => void
}

export function FlagQueuePagination({
  page,
  pages,
  total,
  size,
  onPageChange,
  onSizeChange,
}: FlagQueuePaginationProps) {
  if (total === 0) return null

  const from = (page - 1) * size + 1
  const to = Math.min(page * size, total)

  return (
    <nav
      aria-label="Flag queue pagination"
      className="flex flex-col gap-2 rounded-xl border border-gray-200/80 bg-white p-2.5 shadow-card"
    >
      <div className="flex items-center justify-between text-xs text-gray-500">
        <span>
          <span className="font-semibold text-navy-900">{from}</span>–
          <span className="font-semibold text-navy-900">{to}</span> of{' '}
          <span className="font-semibold text-navy-900">{total}</span> flags
        </span>
        <label className="flex items-center gap-1.5 text-[11px]">
          <span className="text-gray-400">Per page:</span>
          <select
            value={size}
            aria-label="Flags per page"
            onChange={(e) => onSizeChange(Number(e.target.value))}
            className="h-6 cursor-pointer rounded border border-gray-200 bg-white px-1.5 text-xs font-medium text-navy-900 shadow-card hover:border-gray-300"
          >
            <option value={10}>10</option>
            <option value={20}>20</option>
            <option value={50}>50</option>
          </select>
        </label>
      </div>

      <div className="flex items-center justify-between border-t border-gray-100 pt-1.5">
        <Button
          size="sm"
          variant="ghost"
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
          aria-label="Previous page"
          className="h-7 px-2 text-xs"
          icon={<ChevronLeft className="size-3.5" />}
        >
          <span>Prev</span>
        </Button>

        <span className="font-mono text-xs tabular-nums text-gray-600">
          Page <span className="font-semibold text-navy-900">{page}</span> of{' '}
          <span className="font-semibold text-navy-900">{pages}</span>
        </span>

        <Button
          size="sm"
          variant="ghost"
          onClick={() => onPageChange(page + 1)}
          disabled={page >= pages}
          aria-label="Next page"
          className="h-7 px-2 text-xs"
        >
          <span>Next</span>
          <ChevronRight className="size-3.5" />
        </Button>
      </div>
    </nav>
  )
}
