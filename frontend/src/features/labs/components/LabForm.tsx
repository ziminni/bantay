import { useId, useState, type FormEvent, type ReactNode } from 'react'
import { ApiError, errorMessage } from '@/api/errors'
import type { LabCreate, LabRead } from '@/api/types'
import { Alert } from '@/components/ui/Alert'
import { FormField, FormGrid } from '@/components/ui/FormField'
import { Input } from '@/components/ui/Input'
import { DEFAULT_COOLDOWN_SECONDS, DEFAULT_MATCH_THRESHOLD } from '@/lib/constants'
import { formatDuration } from '@/lib/format'

interface LabFormProps {
  lab?: LabRead
  onSubmit: (values: LabCreate) => Promise<unknown>
  renderActions: (state: { submitting: boolean; formId: string }) => ReactNode
}

/** Create or edit a laboratory, including its recognition settings. */
export function LabForm({ lab, onSubmit, renderActions }: LabFormProps) {
  const formId = useId()
  const [name, setName] = useState(lab?.name ?? '')
  const [room, setRoom] = useState(lab?.room ?? '')
  const [open, setOpen] = useState(lab?.open_time?.slice(0, 5) ?? '')
  const [close, setClose] = useState(lab?.close_time?.slice(0, 5) ?? '')
  // The threshold is a similarity from 0 to 1; people find a percentage easier to read.
  const [threshold, setThreshold] = useState(String(Number(((lab?.match_threshold ?? DEFAULT_MATCH_THRESHOLD) * 100).toFixed(1))))
  const [cooldown, setCooldown] = useState(String(lab?.cooldown_seconds ?? DEFAULT_COOLDOWN_SECONDS))
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const thresholdNum = Number(threshold)
  const cooldownNum = Number(cooldown)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    const next: Record<string, string> = {}
    if (!name.trim()) next.name = 'Enter a name.'
    else if (name.trim().length > 80) next.name = 'At most 80 characters.'
    if (room.length > 80) next.room = 'At most 80 characters.'
    if (open && close && close <= open) next.close = 'Closing time must be after opening time.'
    if (threshold === '' || !Number.isFinite(thresholdNum) || thresholdNum < 0 || thresholdNum > 100)
      next.threshold = 'Enter a number from 0 to 100.'
    if (cooldown === '' || !Number.isInteger(cooldownNum) || cooldownNum < 0) next.cooldown = 'Enter whole seconds, 0 or more.'
    setErrors(next)
    setFormError(null)
    if (Object.keys(next).length) return

    setSubmitting(true)
    try {
      await onSubmit({
        name: name.trim(),
        room: room.trim() || null,
        open_time: open ? `${open}:00` : null,
        close_time: close ? `${close}:00` : null,
        match_threshold: thresholdNum / 100,
        cooldown_seconds: cooldownNum,
      })
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) setErrors({ name: err.detail })
      else setFormError(errorMessage(err))
    } finally {
      setSubmitting(false)
    }
  }

  const ids = {
    name: `${formId}-name`,
    room: `${formId}-room`,
    open: `${formId}-open`,
    close: `${formId}-close`,
    threshold: `${formId}-threshold`,
    cooldown: `${formId}-cooldown`,
  }

  return (
    <form id={formId} onSubmit={submit} noValidate className="space-y-8">
      <fieldset className="space-y-5">
        <legend className="mb-4 text-sm font-semibold text-gray-900">Laboratory</legend>
        <FormGrid columns={2}>
          <FormField htmlFor={ids.name} label="Name" required error={errors.name}>
            <Input id={ids.name} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Lab 1" aria-invalid={Boolean(errors.name)} />
          </FormField>
          <FormField htmlFor={ids.room} label="Room" hint="Optional" error={errors.room}>
            <Input id={ids.room} value={room} onChange={(e) => setRoom(e.target.value)} placeholder="e.g. IT Building, Room 201" />
          </FormField>
          <FormField htmlFor={ids.open} label="Opens at" hint="Optional">
            <Input id={ids.open} type="time" value={open} onChange={(e) => setOpen(e.target.value)} />
          </FormField>
          <FormField htmlFor={ids.close} label="Closes at" hint="Optional" error={errors.close}>
            <Input id={ids.close} type="time" value={close} onChange={(e) => setClose(e.target.value)} aria-invalid={Boolean(errors.close)} />
          </FormField>
        </FormGrid>
      </fieldset>

      <fieldset className="space-y-5">
        <legend className="mb-1 text-sm font-semibold text-gray-900">Recognition</legend>
        <p className="mb-4 text-sm text-gray-500">The defaults work for most labs. Adjust after testing in the room.</p>
        <FormGrid columns={2}>
          <FormField
            htmlFor={ids.threshold}
            label="Match threshold (%)"
            error={errors.threshold}
            hint="How similar a face must be to count as a match. Higher is stricter; faces below it are logged as Unknown."
          >
            <Input
              id={ids.threshold}
              type="number"
              inputMode="decimal"
              min={0}
              max={100}
              step="any"
              value={threshold}
              onChange={(e) => setThreshold(e.target.value)}
              aria-invalid={Boolean(errors.threshold)}
            />
          </FormField>
          <FormField
            htmlFor={ids.cooldown}
            label="Cooldown (seconds)"
            error={errors.cooldown}
            hint={
              Number.isInteger(cooldownNum) && cooldownNum >= 0
                ? `${cooldownNum === 0 ? 'Off — every sighting is logged' : `${formatDuration(cooldownNum)}`}. The same person is not logged again in this lab within this time.`
                : 'The same person is not logged again in this lab within this time.'
            }
          >
            <Input
              id={ids.cooldown}
              type="number"
              inputMode="numeric"
              min={0}
              step={1}
              value={cooldown}
              onChange={(e) => setCooldown(e.target.value)}
              aria-invalid={Boolean(errors.cooldown)}
            />
          </FormField>
        </FormGrid>
      </fieldset>

      {formError && <Alert tone="error">{formError}</Alert>}

      {renderActions({ submitting, formId })}
    </form>
  )
}
