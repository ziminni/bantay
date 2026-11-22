import type { EntryLogRead } from '@/api/types'
import { EntryPerson, EntryStatusBadge } from '@/components/common/badges'
import { EmptyState } from '@/components/ui/EmptyState'
import { formatTime } from '@/lib/format'

export function LatestEntriesList({ entries }: { entries: EntryLogRead[] }) {
  if (entries.length === 0) {
    return <EmptyState title="No entries yet today" description="Entries appear here as people walk into a lab." />
  }

  return (
    <ul className="divide-y divide-gray-100">
      {entries.map((e) => (
        <li key={e.id} className="flex flex-wrap items-center gap-x-6 gap-y-2 px-5 py-3">
          <time dateTime={e.entered_at} className="w-24 shrink-0 text-sm text-gray-500 tabular-nums">
            {formatTime(e.entered_at)}
          </time>
          <div className="min-w-0 flex-1">
            <EntryPerson entry={e} />
          </div>
          <div className="text-sm text-gray-700 sm:w-48">
            {e.lab_name}
            <p className="text-xs text-gray-500">{e.camera_name ?? 'Manual entry'}</p>
          </div>
          <EntryStatusBadge status={e.status} />
        </li>
      ))}
    </ul>
  )
}
