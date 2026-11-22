import type { CameraStatus, EntryLogRead, EntryStatus } from '@/api/types'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { CAMERA_STATUS_LABELS, ENTRY_STATUS_LABELS, PERSON_TYPE_LABELS } from '@/lib/constants'
import { Link } from 'react-router-dom'

export function EntryStatusBadge({ status }: { status: EntryStatus }) {
  return <StatusBadge on={status === 'MATCHED'}>{ENTRY_STATUS_LABELS[status]}</StatusBadge>
}

export function CameraStatusBadge({ status }: { status: CameraStatus }) {
  return (
    <StatusBadge on={status === 'ONLINE'} muted={status === 'DISABLED'}>
      {CAMERA_STATUS_LABELS[status]}
    </StatusBadge>
  )
}

export function ActiveBadge({ active, on = 'Active', off = 'Inactive' }: { active: boolean; on?: string; off?: string }) {
  return (
    <StatusBadge on={active} muted={!active}>
      {active ? on : off}
    </StatusBadge>
  )
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
        className="font-medium text-gray-900 hover:underline"
      >
        {entry.person.full_name}
      </Link>
    ) : (
      <span className="font-medium text-gray-900">{entry.person.full_name}</span>
    )
    return (
      <div className="min-w-0">
        {name}
        <p className="text-xs text-gray-500">
          {entry.person.id_number} · {PERSON_TYPE_LABELS[entry.person.person_type]}
        </p>
      </div>
    )
  }
  return (
    <div>
      <span className="font-medium text-gray-500 italic">
        {entry.status === 'UNKNOWN' ? 'Unknown person' : 'Deleted person'}
      </span>
      <p className="text-xs text-gray-500">{entry.status === 'UNKNOWN' ? 'Not enrolled' : 'Record withdrawn'}</p>
    </div>
  )
}
