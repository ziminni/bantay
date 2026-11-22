import { useState } from 'react'
import { deleteEntry, snapshotUrl } from '@/api/entries'
import type { EntryLogRead } from '@/api/types'
import { EntryPerson, EntryStatusBadge } from '@/components/common/badges'
import { Button, ButtonLink } from '@/components/ui/Button'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { DescriptionList } from '@/components/ui/DescriptionList'
import { Drawer } from '@/components/ui/Drawer'
import { useToast } from '@/components/ui/useToast'
import { MOCK_MODE } from '@/config'
import { formatDateTime, formatSimilarity } from '@/lib/format'

interface EntryDetailProps {
  entry: EntryLogRead | null
  onClose: () => void
  onDeleted: () => void
}

/** Side panel with everything about one entry, including the snapshot of an unknown face. */
export function EntryDetail({ entry, onClose, onDeleted }: EntryDetailProps) {
  const [confirming, setConfirming] = useState(false)
  const toast = useToast()

  return (
    <>
      <Drawer
        open={entry !== null}
        onClose={onClose}
        title="Entry details"
        footer={
          entry && (
            <Button variant="danger" onClick={() => setConfirming(true)}>
              Delete entry
            </Button>
          )
        }
      >
        {entry && (
          <div className="space-y-6">
            {entry.snapshot_path && <Snapshot path={entry.snapshot_path} />}

            <DescriptionList
              items={[
                { label: 'Person', value: <EntryPerson entry={entry} /> },
                { label: 'Time', value: formatDateTime(entry.entered_at) },
                { label: 'Laboratory', value: entry.lab_name },
                { label: 'Camera', value: entry.camera_name ?? 'None — recorded by hand' },
                { label: 'Status', value: <EntryStatusBadge status={entry.status} /> },
                {
                  label: 'Match',
                  value:
                    entry.similarity == null
                      ? '—'
                      : `${formatSimilarity(entry.similarity)} similar to the closest enrolled face`,
                },
                { label: 'Entry ID', value: `#${entry.id}` },
              ]}
            />

            <div className="flex flex-wrap gap-3">
              {entry.person && (
                <ButtonLink to={`/logs?person_id=${entry.person.id}`} size="sm" onClick={onClose}>
                  All entries by this person
                </ButtonLink>
              )}
              {entry.camera_id && (
                <ButtonLink to={`/live`} size="sm">
                  Live view
                </ButtonLink>
              )}
            </div>
          </div>
        )}
      </Drawer>

      <ConfirmDialog
        open={confirming}
        onClose={() => setConfirming(false)}
        title="Delete this entry?"
        confirmLabel="Delete entry"
        destructive
        onConfirm={async () => {
          if (!entry) return
          await deleteEntry(entry.id)
          toast.success('Entry deleted.')
          onDeleted()
        }}
      >
        <p>The entry will be removed from the log permanently. This cannot be undone.</p>
      </ConfirmDialog>
    </>
  )
}

function Snapshot({ path }: { path: string }) {
  return (
    <figure>
      {MOCK_MODE ? (
        <div className="flex aspect-video items-center justify-center rounded-md bg-gray-200 p-4 text-center text-xs text-gray-500">
          Snapshot of the unknown face appears here once the backend is connected
        </div>
      ) : (
        <img src={snapshotUrl(path)} alt="Snapshot of the unknown face" className="w-full rounded-md border border-gray-200" />
      )}
      <figcaption className="mt-2 text-xs text-gray-500">Captured when the face did not match anyone enrolled.</figcaption>
    </figure>
  )
}
