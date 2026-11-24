import { Link } from 'react-router-dom'
import type { CameraStatus, EntryLogRead, EntryStatus } from '@/api/types'
import { Avatar } from '@/components/ui/Avatar'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { CAMERA_STATUS_LABELS, ENTRY_STATUS_LABELS, PERSON_TYPE_LABELS } from '@/lib/constants'

export function EntryStatusBadge({ status }: { status: EntryStatus }) {
  return <StatusBadge tone={status === 'MATCHED' ? 'success' : 'warning'}>{ENTRY_STATUS_LABELS[status]}</StatusBadge>
}

export function CameraStatusBadge({ status }: { status: CameraStatus }) {
  const tone = status === 'ONLINE' ? 'success' : status === 'OFFLINE' ? 'danger' : 'neutral'
  return (
    <StatusBadge tone={tone} pulse={status === 'ONLINE'}>
      {CAMERA_STATUS_LABELS[status]}
    </StatusBadge>
  )
}

export function ActiveBadge({ active, on = 'Active', off = 'Inactive' }: { active: boolean; on?: string; off?: string }) {
  return <StatusBadge tone={active ? 'success' : 'neutral'}>{active ? on : off}</StatusBadge>
}

/**
 * Who an entry belongs to. Unknown faces have no person; a recognized entry
 * whose person was later deleted (right to erasure) also has none.
 */
export function EntryPerson({ entry, link = true }: { entry: EntryLogRead; link?: boolean }) {
  if (entry.person) {
    const name = link ? (
      <Link
        to={`/users/${entry.person.id}`}
        onClick={(e) => e.stopPropagation()}
        className="font-medium text-navy-900 hover:text-navy-600 hover:underline"
      >
        {entry.person.full_name}
      </Link>
    ) : (
      <span className="font-medium text-navy-900">{entry.person.full_name}</span>
    )
    return (
      <div className="flex min-w-0 items-center gap-3">
        <Avatar name={entry.person.full_name} />
        <div className="min-w-0">
          <div className="truncate">{name}</div>
          <p className="truncate text-xs text-gray-500">
            {entry.person.id_number} · {PERSON_TYPE_LABELS[entry.person.person_type]}
          </p>
        </div>
      </div>
    )
  }
  const unknown = entry.status === 'UNKNOWN'
  return (
    <div className="flex min-w-0 items-center gap-3">
      <Avatar unknown />
      <div className="min-w-0">
        <span className="font-medium text-gray-600">{unknown ? 'Unknown person' : 'Deleted person'}</span>
        <p className="text-xs text-gray-500">{unknown ? 'Not enrolled' : 'Record withdrawn'}</p>
      </div>
    </div>
  )
}
