import type { ReactNode } from 'react'
import type { EntryLogRead } from '@/api/types'
import { EntryPerson, EntryStatusBadge } from '@/components/common/badges'
import { DataTable, type Column } from '@/components/ui/DataTable'
import { EmptyState } from '@/components/ui/EmptyState'
import { formatDate, formatSimilarity, formatTime } from '@/lib/format'

interface EntriesTableProps {
  rows: EntryLogRead[] | undefined
  loading: boolean
  onOpen: (entry: EntryLogRead) => void
  /** Hide the person column, e.g. on a person's own page. */
  hidePerson?: boolean
  empty?: ReactNode
}

export function EntriesTable({ rows, loading, onOpen, hidePerson, empty }: EntriesTableProps) {
  const columns: Column<EntryLogRead>[] = [
    {
      key: 'time',
      header: 'Time',
      cell: (e) => (
        <time dateTime={e.entered_at} className="whitespace-nowrap tabular-nums">
          {formatTime(e.entered_at)}
          <span className="block text-xs text-gray-500">{formatDate(e.entered_at)}</span>
          {/* On phones the Lab column is hidden, so the lab shows here. */}
          <span className="block text-xs text-gray-500 sm:hidden">{e.lab_name}</span>
        </time>
      ),
    },
    ...(hidePerson ? [] : [{ key: 'person', header: 'Person', cell: (e: EntryLogRead) => <EntryPerson entry={e} /> }]),
    {
      key: 'lab',
      header: 'Lab',
      hideBelow: 'sm',
      cell: (e) => (
        <>
          {e.lab_name}
          <span className="block text-xs text-gray-500">{e.camera_name ?? 'Manual entry'}</span>
        </>
      ),
    },
    {
      key: 'similarity',
      header: 'Match',
      align: 'right',
      hideBelow: 'md',
      cell: (e) => <span className="tabular-nums">{formatSimilarity(e.similarity)}</span>,
    },
    { key: 'status', header: 'Status', cell: (e) => <EntryStatusBadge status={e.status} /> },
  ]

  return (
    <DataTable
      columns={columns}
      rows={rows}
      rowKey={(e) => e.id}
      loading={loading}
      onRowClick={onOpen}
      rowLabel={(e) => `Entry at ${formatTime(e.entered_at)}, ${e.person?.full_name ?? 'unknown person'}`}
      caption="Entry logs"
      empty={empty ?? <EmptyState title="No entries found" description="Try a different search or clear the filters." />}
    />
  )
}
