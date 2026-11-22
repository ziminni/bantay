import { useId, useState, type FormEvent, type ReactNode } from 'react'
import { ApiError, errorMessage } from '@/api/errors'
import type { PersonCreate, PersonRead, PersonType } from '@/api/types'
import { Alert } from '@/components/ui/Alert'
import { Checkbox, Input, Select } from '@/components/ui/Input'
import { FormField, FormGrid } from '@/components/ui/FormField'
import { PERSON_TYPE_LABELS, toOptions } from '@/lib/constants'
import { formatDate } from '@/lib/format'

export interface PersonFormValues {
  id_number: string
  full_name: string
  person_type: PersonType
  department: string
  consent_given: boolean
}

interface PersonFormProps {
  /** When given, the form edits this person; the ID number cannot be changed. */
  person?: PersonRead
  onSubmit: (values: PersonCreate) => Promise<unknown>
  /** Refuse to save without consent (used by Enroll, where photos come next). */
  requireConsent?: boolean
  /** Rendered at the bottom; must contain a submit button for `formId`. */
  renderActions: (state: { submitting: boolean; formId: string }) => ReactNode
}

export const CONSENT_TEXT =
  'The person has signed the consent form allowing Bantay to store their face data, as required by the Data Privacy Act of 2012 (RA 10173).'

/** Create or edit a student, faculty member or staff member. */
export function PersonForm({ person, onSubmit, requireConsent = false, renderActions }: PersonFormProps) {
  const formId = useId()
  const [values, setValues] = useState<PersonFormValues>({
    id_number: person?.id_number ?? '',
    full_name: person?.full_name ?? '',
    person_type: person?.person_type ?? 'STUDENT',
    department: person?.department ?? '',
    consent_given: person?.consent_given ?? false,
  })
  const [errors, setErrors] = useState<Partial<Record<keyof PersonFormValues, string>>>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const set = <K extends keyof PersonFormValues>(key: K, value: PersonFormValues[K]) => {
    setValues((v) => ({ ...v, [key]: value }))
    setErrors((e) => ({ ...e, [key]: undefined }))
  }

  const validate = () => {
    const next: typeof errors = {}
    if (!values.id_number.trim()) next.id_number = 'Enter the ID number.'
    else if (values.id_number.trim().length > 32) next.id_number = 'At most 32 characters.'
    if (!values.full_name.trim()) next.full_name = 'Enter the full name.'
    else if (values.full_name.trim().length > 160) next.full_name = 'At most 160 characters.'
    if (values.department.length > 120) next.department = 'At most 120 characters.'
    if (requireConsent && !values.consent_given) next.consent_given = 'Consent is required before face photos can be taken.'
    setErrors(next)
    return Object.keys(next).length === 0
  }

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setFormError(null)
    if (!validate()) return
    setSubmitting(true)
    try {
      await onSubmit({
        id_number: values.id_number.trim(),
        full_name: values.full_name.trim(),
        person_type: values.person_type,
        department: values.department.trim() || null,
        consent_given: values.consent_given,
      })
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) setErrors({ id_number: err.detail })
      else setFormError(errorMessage(err))
    } finally {
      setSubmitting(false)
    }
  }

  const ids = {
    id_number: `${formId}-id`,
    full_name: `${formId}-name`,
    person_type: `${formId}-type`,
    department: `${formId}-dept`,
    consent: `${formId}-consent`,
  }

  return (
    <form id={formId} onSubmit={submit} noValidate className="space-y-6">
      <FormGrid columns={2}>
        <FormField
          htmlFor={ids.id_number}
          label="ID number"
          required={!person}
          error={errors.id_number}
          hint={person ? 'The ID number cannot be changed.' : 'School ID, e.g. 2021-12345'}
        >
          <Input
            id={ids.id_number}
            value={values.id_number}
            onChange={(e) => set('id_number', e.target.value)}
            disabled={Boolean(person)}
            aria-invalid={Boolean(errors.id_number)}
            autoComplete="off"
          />
        </FormField>

        <FormField htmlFor={ids.full_name} label="Full name" required error={errors.full_name}>
          <Input
            id={ids.full_name}
            value={values.full_name}
            onChange={(e) => set('full_name', e.target.value)}
            aria-invalid={Boolean(errors.full_name)}
            autoComplete="off"
          />
        </FormField>

        <FormField htmlFor={ids.person_type} label="Type">
          <Select
            id={ids.person_type}
            value={values.person_type}
            onChange={(e) => set('person_type', e.target.value as PersonType)}
            options={toOptions(PERSON_TYPE_LABELS)}
          />
        </FormField>

        <FormField htmlFor={ids.department} label="Department" hint="Optional" error={errors.department}>
          <Input
            id={ids.department}
            value={values.department}
            onChange={(e) => set('department', e.target.value)}
            placeholder="e.g. Information Technology"
          />
        </FormField>
      </FormGrid>

      <div className={errors.consent_given ? 'rounded-md border border-red-300 p-4' : 'rounded-md border border-gray-200 p-4'}>
        <Checkbox
          id={ids.consent}
          checked={values.consent_given}
          onChange={(e) => set('consent_given', e.target.checked)}
          label="Consent form signed"
          description={
            <>
              {CONSENT_TEXT} Face photos cannot be uploaded without it.
              {person?.consent_signed_at && values.consent_given && (
                <span className="mt-1 block">Recorded on {formatDate(person.consent_signed_at)}.</span>
              )}
              {errors.consent_given && <span className="mt-1 block font-medium text-red-700">{errors.consent_given}</span>}
              {person?.consent_given && !values.consent_given && (
                <span className="mt-1 block font-medium text-gray-900">
                  Withdrawing consent stops enrollment. Delete the person to erase their face data.
                </span>
              )}
            </>
          }
        />
      </div>

      {formError && <Alert tone="error">{formError}</Alert>}

      {renderActions({ submitting, formId })}
    </form>
  )
}
