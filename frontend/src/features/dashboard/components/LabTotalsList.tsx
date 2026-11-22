import { Link } from 'react-router-dom'
import type { LabTotal } from '@/api/types'

/** Entries today per lab, with a simple proportional bar. Each row opens that lab's logs. */
export function LabTotalsList({ totals }: { totals: LabTotal[] }) {
  const max = Math.max(1, ...totals.map((t) => t.count))

  if (totals.length === 0) return <p className="text-sm text-gray-500">No laboratories yet.</p>

  return (
    <ul className="space-y-4">
      {totals.map((t) => (
        <li key={t.lab_id}>
          <Link to={`/logs?lab_id=${t.lab_id}&range=today`} className="group block">
            <div className="flex items-baseline justify-between gap-3 text-sm">
              <span className="truncate text-gray-900 group-hover:underline">{t.lab_name}</span>
              <span className="font-medium tabular-nums">{t.count}</span>
            </div>
            <div className="mt-1.5 h-2 rounded-full bg-gray-100">
              <div className="h-2 rounded-full bg-gray-700" style={{ width: `${(t.count / max) * 100}%` }} />
            </div>
          </Link>
        </li>
      ))}
    </ul>
  )
}
