import { useId, useState, type FormEvent } from 'react'
import { Laptop } from 'lucide-react'
import { createCamera, deleteCamera, updateCamera } from '@/api/cameras'
import { ApiError, errorMessage } from '@/api/errors'
import type { CameraRead, CameraRole } from '@/api/types'
import { Alert } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { FormField } from '@/components/ui/FormField'
import { Checkbox, Input } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import { cn } from '@/lib/cn'

interface CameraFormProps {
  open: boolean
  labId: number
  /** When given, edits this camera; otherwise adds a new one to the lab. */
  camera?: CameraRead | null
  onClose: () => void
  onSaved: (message: string) => void
}

const ROLES: Array<{ value: CameraRole; label: string; description: string }> = [
  { value: 'ENTRY', label: 'Entrance camera', description: 'Points at the door. Recognizes faces and records entries.' },
  { value: 'ROOM', label: 'Room camera', description: 'Watches the room. Live view only; records nothing.' },
]

const URL_PATTERN = /^(rtsps?|https?|webcam|device):\/\/\S+$|^(\d+|webcam)$/i

export function CameraForm(props: CameraFormProps) {
  const { open, camera, onClose } = props
  return (
    <Modal open={open} onClose={onClose} title={camera ? `Edit ${camera.name}` : 'Add camera'}>
      {open && <Form {...props} />}
    </Modal>
  )
}

function Form({ labId, camera, onClose, onSaved }: CameraFormProps) {
  const id = useId()
  const [name, setName] = useState(camera?.name ?? '')
  const [role, setRole] = useState<CameraRole>(camera?.role ?? 'ENTRY')
  // The API never returns the camera password, so an existing URL is only replaced when the user asks to.
  const [changeUrl, setChangeUrl] = useState(!camera)
  const [url, setUrl] = useState('')
  const [enabled, setEnabled] = useState(camera?.enabled ?? true)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    const next: Record<string, string> = {}
    if (!name.trim()) next.name = 'Enter a name.'
    else if (name.trim().length > 80) next.name = 'At most 80 characters.'
    if (changeUrl && !URL_PATTERN.test(url.trim())) {
      next.url = 'Enter a valid stream URL (e.g. webcam://0, http://..., or rtsp://...)'
    }
    setErrors(next)
    setFormError(null)
    if (Object.keys(next).length) return

    setSubmitting(true)
    try {
      if (camera) {
        await updateCamera(camera.id, {
          name: name.trim(),
          role,
          enabled,
          ...(changeUrl ? { rtsp_url: url.trim() } : {}),
        })
        onSaved('Camera saved. Its connection was restarted.')
      } else {
        await createCamera({ lab_id: labId, name: name.trim(), role, rtsp_url: url.trim(), enabled })
        onSaved('Camera added. Bantay is connecting to it.')
      }
      onClose()
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) setErrors({ name: err.detail })
      else setFormError(errorMessage(err))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <>
      <form onSubmit={submit} noValidate className="space-y-6">
        <FormField htmlFor={`${id}-name`} label="Name" required error={errors.name}>
          <Input id={`${id}-name`} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Lab 1 Entrance" aria-invalid={Boolean(errors.name)} />
        </FormField>

        <fieldset>
          <legend className="mb-2 text-sm font-medium text-gray-900">Type</legend>
          <div className="grid gap-3 sm:grid-cols-2">
            {ROLES.map((r) => (
              <label
                key={r.value}
                className={cn(
                  'flex cursor-pointer gap-3 rounded-md border p-3 text-sm',
                  role === r.value ? 'border-gray-900' : 'border-gray-300 hover:bg-gray-50',
                )}
              >
                <input
                  type="radio"
                  name={`${id}-role`}
                  value={r.value}
                  checked={role === r.value}
                  onChange={() => setRole(r.value)}
                  className="mt-0.5 accent-gray-900"
                />
                <span>
                  <span className="block font-medium text-gray-900">{r.label}</span>
                  <span className="mt-0.5 block text-gray-500">{r.description}</span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>

        {changeUrl ? (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label htmlFor={`${id}-url`} className="block text-sm font-medium text-gray-900">
                Stream URL <span className="text-red-500">*</span>
              </label>
              <button
                type="button"
                onClick={() => {
                  setUrl('webcam://0')
                  if (!name.trim()) setName('Laptop Webcam')
                  setErrors((prev) => {
                    const copy = { ...prev }
                    delete copy.url
                    return copy
                  })
                }}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-sky-600 hover:text-sky-700 bg-sky-50 hover:bg-sky-100 px-2.5 py-1 rounded-md transition-colors cursor-pointer"
              >
                <Laptop className="h-3.5 w-3.5" />
                Use Laptop Camera (webcam://0)
              </button>
            </div>
            <Input
              id={`${id}-url`}
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="webcam://0, http://192.168.1.X:4747/video, or rtsp://"
              className="font-mono"
              autoComplete="off"
              spellCheck={false}
              aria-invalid={Boolean(errors.url)}
            />
            {errors.url ? (
              <p className="text-xs text-red-600">{errors.url}</p>
            ) : (
              <p className="text-xs text-gray-500">
                Use <code className="font-mono text-gray-700 bg-gray-100 px-1 py-0.5 rounded">webcam://0</code> for your built-in laptop camera, or enter an RTSP / phone stream URL.
              </p>
            )}
          </div>
        ) : (
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-gray-900">Stream URL</p>
              <button
                type="button"
                onClick={() => {
                  setChangeUrl(true)
                  setUrl('webcam://0')
                  setErrors((prev) => {
                    const copy = { ...prev }
                    delete copy.url
                    return copy
                  })
                }}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-sky-600 hover:text-sky-700 bg-sky-50 hover:bg-sky-100 px-2.5 py-1 rounded-md transition-colors cursor-pointer"
              >
                <Laptop className="h-3.5 w-3.5" />
                Switch to Laptop Camera (webcam://0)
              </button>
            </div>
            <div className="flex items-center justify-between gap-3 rounded-md border border-gray-200 bg-gray-50 px-3 py-2">
              <code className="truncate text-sm text-gray-700">{camera?.rtsp_url}</code>
              <Button size="sm" variant="ghost" onClick={() => setChangeUrl(true)}>
                Change URL
              </Button>
            </div>
          </div>
        )}

        <Checkbox
          id={`${id}-enabled`}
          checked={enabled}
          onChange={(e) => setEnabled(e.target.checked)}
          label="Enabled"
          description="Turn off to stop reading this camera without deleting it."
        />

        {formError && <Alert tone="error">{formError}</Alert>}

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-gray-200 pt-5">
          <div>
            {camera && (
              <Button variant="danger" onClick={() => setConfirmDelete(true)} disabled={submitting}>
                Delete camera
              </Button>
            )}
          </div>
          <div className="flex gap-3">
            <Button onClick={onClose} disabled={submitting}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" loading={submitting}>
              {camera ? 'Save changes' : 'Add camera'}
            </Button>
          </div>
        </div>
      </form>

      {camera && (
        <ConfirmDialog
          open={confirmDelete}
          onClose={() => setConfirmDelete(false)}
          title={`Delete ${camera.name}?`}
          confirmLabel="Delete camera"
          destructive
          onConfirm={async () => {
            await deleteCamera(camera.id)
            onSaved('Camera deleted.')
            onClose()
          }}
        >
          <p>Bantay stops reading this camera. Entries it already recorded are kept.</p>
        </ConfirmDialog>
      )}
    </>
  )
}
