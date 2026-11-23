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
        <li
          key={e.id}
          className="grid grid-cols-[1fr_auto] items-center gap-x-4 gap-y-2 px-5 py-3.5 sm:grid-cols-[6.5rem_1fr_12rem_7rem] sm:px-6"
        >
          <time dateTime={e.entered_at} className="order-3 col-span-2 text-xs text-gray-500 tabular-nums sm:order-none sm:col-span-1 sm:text-sm">
            {formatTime(e.entered_at)}
          </time>
          <div className="min-w-0">
            <EntryPerson entry={e} />
          </div>
          <div className="hidden min-w-0 text-sm sm:block">
            <p className="truncate font-medium text-navy-900">{e.lab_name}</p>
            <p className="truncate text-xs text-gray-500">{e.camera_name ?? 'Manual entry'}</p>
          </div>
          <div className="justify-self-end">
            <EntryStatusBadge status={e.status} />
          </div>
        </li>
      ))}
    </ul>
  )
}
