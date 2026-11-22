import { useId, useState, type FormEvent } from 'react'
import { createEntry } from '@/api/entries'
import { errorMessage } from '@/api/errors'
import type { EntryDecision, PersonRead } from '@/api/types'
import { PersonCombobox } from '@/components/common/PersonCombobox'
import { CameraSelect, LabSelect } from '@/components/common/selects'
import { Alert } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'
import { FormField, FormGrid } from '@/components/ui/FormField'
import { Checkbox, Input } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import { isoToLocalInput, localInputToIso } from '@/lib/format'

interface ManualEntryFormProps {
  open: boolean
  onClose: () => void
  onLogged: (decision: EntryDecision) => void
}

/**
 * Record an entry by hand — for when a camera is down, or to test the rules.
 * The lab's cooldown still applies unless the admin chooses to ignore it.
 */
export function ManualEntryForm({ open, onClose, onLogged }: ManualEntryFormProps) {
  return (
    <Modal open={open} onClose={onClose} title="Add manual entry" description="Use this when a camera is down or missed someone.">
      {open && <Form onClose={onClose} onLogged={onLogged} />}
    </Modal>
  )
}

function Form({ onClose, onLogged }: Omit<ManualEntryFormProps, 'open'>) {
  const id = useId()
  const [unknown, setUnknown] = useState(false)
  const [person, setPerson] = useState<PersonRead | null>(null)
  const [labId, setLabId] = useState('')
  const [cameraId, setCameraId] = useState('')
  const [at, setAt] = useState(() => isoToLocalInput(new Date().toISOString()))
  const [bypass, setBypass] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [notice, setNotice] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    const next: Record<string, string> = {}
    if (!unknown && !person) next.person = 'Choose a person, or tick "Unknown person".'
    if (!labId) next.lab = 'Choose a laboratory.'
    if (!at) next.at = 'Enter the time of entry.'
    else if (new Date(localInputToIso(at)!) > new Date()) next.at = 'The time cannot be in the future.'
    setErrors(next)
    setNotice(null)
    if (Object.keys(next).length) return

    setSubmitting(true)
    try {
      const decision = await createEntry({
        person_id: unknown ? null : person!.id,
        lab_id: Number(labId),
        camera_id: cameraId ? Number(cameraId) : null,
        entered_at: localInputToIso(at),
        bypass_cooldown: bypass,
      })
      if (decision.logged) {
        onLogged(decision)
        onClose()
      } else {
        setNotice(
          'Not recorded: this person was already logged in this lab within the cooldown period. Tick "Ignore cooldown" to record it anyway.',
        )
      }
    } catch (err) {
      setNotice(errorMessage(err))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={submit} noValidate className="space-y-5">
      <FormField htmlFor={`${id}-person`} label="Person" required={!unknown} error={errors.person}>
        {unknown ? (
          <Input id={`${id}-person`} value="Unknown person" disabled />
        ) : (
          <PersonCombobox id={`${id}-person`} value={person} onChange={setPerson} invalid={Boolean(errors.person)} />
        )}
      </FormField>
      <Checkbox
        id={`${id}-unknown`}
        checked={unknown}
        onChange={(e) => setUnknown(e.target.checked)}
        label="Unknown person"
        description="Someone who is not enrolled."
      />

      <FormGrid columns={2}>
        <FormField htmlFor={`${id}-lab`} label="Laboratory" required error={errors.lab}>
          <LabSelect
            id={`${id}-lab`}
            placeholder="Choose…"
            activeOnly
            value={labId}
            onChange={(e) => {
              setLabId(e.target.value)
              setCameraId('')
            }}
            aria-invalid={Boolean(errors.lab)}
          />
        </FormField>
        <FormField htmlFor={`${id}-camera`} label="Camera" hint="Optional">
          <CameraSelect
            id={`${id}-camera`}
            placeholder="None"
            labId={labId ? Number(labId) : undefined}
            disabled={!labId}
            value={cameraId}
            onChange={(e) => setCameraId(e.target.value)}
          />
        </FormField>
      </FormGrid>

      <FormField htmlFor={`${id}-at`} label="Time of entry" required error={errors.at}>
        <Input id={`${id}-at`} type="datetime-local" value={at} onChange={(e) => setAt(e.target.value)} aria-invalid={Boolean(errors.at)} />
      </FormField>

      {!unknown && (
        <Checkbox
          id={`${id}-bypass`}
          checked={bypass}
          onChange={(e) => setBypass(e.target.checked)}
          label="Ignore cooldown"
          description="Record the entry even if this person was logged in this lab a moment ago."
        />
      )}

      {notice && <Alert tone="warning">{notice}</Alert>}

      <div className="flex justify-end gap-3 border-t border-gray-200 pt-5">
        <Button onClick={onClose} disabled={submitting}>
          Cancel
        </Button>
        <Button type="submit" variant="primary" loading={submitting}>
          Record entry
        </Button>
      </div>
    </form>
  )
}
