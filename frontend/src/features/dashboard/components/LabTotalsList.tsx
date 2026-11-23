import { ChevronRight } from 'lucide-react'
import { Link } from 'react-router-dom'
import type { LabTotal } from '@/api/types'
import { cn } from '@/lib/cn'

/** Entries today per lab, busiest first, with a proportional bar. Each row opens that lab's logs. */
export function LabTotalsList({ totals }: { totals: LabTotal[] }) {
  const max = Math.max(1, ...totals.map((t) => t.count))
  const sorted = [...totals].sort((a, b) => b.count - a.count || a.lab_name.localeCompare(b.lab_name))

  if (totals.length === 0) return <p className="text-sm text-gray-500">No laboratories yet.</p>

  return (
    <ul className="-mx-2 space-y-1">
      {sorted.map((t, i) => (
        <li key={t.lab_id}>
          <Link
            to={`/logs?lab_id=${t.lab_id}&range=today`}
            className="group block rounded-xl px-2 py-2.5 transition-colors hover:bg-gray-50"
          >
            <div className="flex items-center justify-between gap-3 text-sm">
              <span className="truncate font-medium text-navy-900">{t.lab_name}</span>
              <span className="flex items-center gap-1 font-display font-semibold text-navy-900 tabular-nums">
                {t.count.toLocaleString()}
                <ChevronRight className="size-4 text-gray-300 transition-colors group-hover:text-navy-500" />
              </span>
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-gray-100">
              <div
                className={cn('h-full rounded-full transition-[width] duration-500', i === 0 && t.count > 0 ? 'bg-marigold-400' : 'bg-navy-800')}
                style={{ width: `${(t.count / max) * 100}%` }}
              />
            </div>
          </Link>
        </li>
      ))}
    </ul>
  )
}
