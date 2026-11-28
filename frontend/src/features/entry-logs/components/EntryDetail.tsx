import { Cctv, History, ScanFace, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { deleteEntry, snapshotUrl } from '@/api/entries'
import type { EntryLogRead } from '@/api/types'
import { EntryPerson, EntryStatusBadge } from '@/components/common/badges'
import { Button, ButtonLink } from '@/components/ui/Button'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { DescriptionList } from '@/components/ui/DescriptionList'
import { Drawer } from '@/components/ui/Drawer'
import { useToast } from '@/components/ui/useToast'
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
            <Button variant="danger" onClick={() => setConfirming(true)} icon={<Trash2 />}>
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
                <ButtonLink to={`/logs?person_id=${entry.person.id}`} size="sm" onClick={onClose} icon={<History />}>
                  All entries by this person
                </ButtonLink>
              )}
              {entry.camera_id && (
                <ButtonLink to={`/live`} size="sm" icon={<Cctv />}>
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
      <div className="overflow-hidden rounded-xl bg-navy-950 ring-1 ring-gray-200">
        <img src={snapshotUrl(path)} alt="Snapshot of the unknown face" className="w-full" />
      </div>
      <figcaption className="mt-2 flex items-center gap-1.5 text-xs text-gray-500">
        <ScanFace className="size-3.5 text-marigold-500" aria-hidden />
        Captured when the face did not match anyone enrolled.
      </figcaption>
    </figure>
  )
}
