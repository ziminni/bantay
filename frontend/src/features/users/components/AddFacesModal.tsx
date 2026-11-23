import { useState } from 'react'
import { errorMessage } from '@/api/errors'
import { enrollFaces } from '@/api/persons'
import type { EnrollmentResult, PersonRead } from '@/api/types'
import { EnrollmentResultView } from '@/components/common/EnrollmentResultView'
import { PhotoUploader } from '@/components/common/PhotoUploader'
import { Alert } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { MAX_ENROLLMENT_PHOTOS } from '@/lib/constants'

/** Upload more face photos for someone already registered. */
export function AddFacesModal({
  person,
  open,
  onClose,
  onUploaded,
}: {
  person: PersonRead
  open: boolean
  onClose: () => void
  onUploaded: () => void
}) {
  const [files, setFiles] = useState<File[]>([])
  const [result, setResult] = useState<EnrollmentResult | null>(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const close = () => {
    if (uploading) return
    setFiles([])
    setResult(null)
    setError(null)
    onClose()
  }

  const upload = async () => {
    setUploading(true)
    setError(null)
    try {
      setResult(await enrollFaces(person.id, files))
      setFiles([])
      onUploaded()
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setUploading(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={close}
      size="xl"
      title={`Add face photos — ${person.full_name}`}
      description={result ? undefined : 'Capture with camera or upload photos. Each photo must show exactly one clear face. Photos are not stored.'}
      footer={
        result ? (
          <Button variant="primary" onClick={close}>
            Done
          </Button>
        ) : (
          <>
            <Button onClick={close} disabled={uploading}>
              Cancel
            </Button>
            <Button variant="primary" onClick={upload} disabled={files.length === 0} loading={uploading}>
              Upload
            </Button>
          </>
        )
      }
    >
      {result ? (
        <EnrollmentResultView result={result} />
      ) : (
        <div className="space-y-4">
          <PhotoUploader files={files} onChange={setFiles} max={MAX_ENROLLMENT_PHOTOS} disabled={uploading} />
          {error && <Alert tone="error">{error}</Alert>}
        </div>
      )}
    </Modal>
  )
}
