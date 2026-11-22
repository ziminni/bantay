import { useState } from 'react'
import { errorMessage } from '@/api/errors'
import { enrollFaces } from '@/api/persons'
import type { EnrollmentResult, PersonRead } from '@/api/types'
import { PhotoUploader } from '@/components/common/PhotoUploader'
import { Alert } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'
import { MAX_ENROLLMENT_PHOTOS, MIN_ENROLLMENT_PHOTOS, PERSON_TYPE_LABELS } from '@/lib/constants'
import { pluralize } from '@/lib/format'
import { PhotoTips } from './PhotoTips'

interface PhotoStepProps {
  person: PersonRead
  onBack: () => void
  onDone: (result: EnrollmentResult) => void
}

/** Step 2: choose 3 to 5 face photos and upload them. */
export function PhotoStep({ person, onBack, onDone }: PhotoStepProps) {
  const [files, setFiles] = useState<File[]>([])
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // People who already have photos only need enough to reach the minimum.
  const needed = Math.max(1, MIN_ENROLLMENT_PHOTOS - person.embedding_count)

  const upload = async () => {
    setUploading(true)
    setError(null)
    try {
      onDone(await enrollFaces(person.id, files))
    } catch (err) {
      setError(errorMessage(err))
      setUploading(false)
    }
  }

  if (!person.consent_given) {
    return (
      <Alert
        tone="warning"
        title="Consent has not been recorded"
        action={
          <Button size="sm" onClick={onBack}>
            Back
          </Button>
        }
      >
        Face photos can only be added after the consent form is signed.
      </Alert>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-gray-200 px-4 py-3">
        <div>
          <p className="font-medium text-gray-900">{person.full_name}</p>
          <p className="text-sm text-gray-500">
            {person.id_number} · {PERSON_TYPE_LABELS[person.person_type]} · {pluralize(person.embedding_count, 'face photo')} on file
          </p>
        </div>
        <Button size="sm" variant="ghost" onClick={onBack} disabled={uploading}>
          Change person
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <PhotoUploader files={files} onChange={setFiles} max={MAX_ENROLLMENT_PHOTOS} disabled={uploading} />
        </div>
        <PhotoTips />
      </div>

      {error && <Alert tone="error">{error}</Alert>}

      <div className="flex flex-col-reverse gap-3 border-t border-gray-200 pt-6 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-gray-500">
          {files.length < needed
            ? `Add at least ${pluralize(needed - files.length, 'more photo')} to continue.`
            : 'Photos are turned into face data and then discarded — no image is stored.'}
        </p>
        <Button variant="primary" onClick={upload} disabled={files.length < needed} loading={uploading}>
          Upload {files.length > 0 && pluralize(files.length, 'photo')}
        </Button>
      </div>
    </div>
  )
}
