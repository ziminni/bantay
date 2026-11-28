import { ScanFace, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { deleteFace } from '@/api/persons'
import type { FaceEmbeddingRead } from '@/api/types'
import { Button } from '@/components/ui/Button'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { EmptyState } from '@/components/ui/EmptyState'
import { useToast } from '@/components/ui/useToast'
import { formatDate, formatSimilarity } from '@/lib/format'

/**
 * The face data on file for one person. Photos are never stored: each row is
 * the embedding made from one uploaded photo.
 */
export function FaceList({
  personId,
  faces,
  onChanged,
}: {
  personId: number
  faces: FaceEmbeddingRead[]
  onChanged: () => void
}) {
  const [removing, setRemoving] = useState<FaceEmbeddingRead | null>(null)
  const toast = useToast()

  if (faces.length === 0) {
    return <EmptyState title="No face photos yet" description="Add 3 to 12 photos so this person can be recognized." />
  }

  return (
    <>
      <ul className="divide-y divide-gray-100">
        {faces.map((f, i) => (
          <li key={f.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5 sm:px-6">
            <div className="flex min-w-0 items-center gap-3">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-navy-50 text-navy-700">
                <ScanFace className="size-[18px]" aria-hidden />
              </span>
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-navy-900">
                  Face {i + 1}
                  {f.source_filename && <span className="font-normal text-gray-500"> · {f.source_filename}</span>}
                </p>
                <p className="text-xs text-gray-500">
                  Quality {formatSimilarity(f.det_score)} · Added {formatDate(f.created_at)}
                </p>
              </div>
            </div>
            <Button size="sm" variant="ghost" onClick={() => setRemoving(f)} icon={<Trash2 />}>
              Remove
            </Button>
          </li>
        ))}
      </ul>

      <ConfirmDialog
        open={removing !== null}
        onClose={() => setRemoving(null)}
        title="Remove this face?"
        confirmLabel="Remove"
        destructive
        onConfirm={async () => {
          if (!removing) return
          await deleteFace(personId, removing.id)
          toast.success('Face removed.')
          onChanged()
        }}
      >
        <p>
          Bantay will stop using this face to recognize the person.
          {faces.length - 1 < 3 && ' They will have fewer than 3 faces on file, which makes recognition less reliable.'}
        </p>
      </ConfirmDialog>
    </>
  )
}
