import { useState } from 'react'
import { errorMessage } from '@/api/errors'
import { createPerson, listPersons, updatePerson } from '@/api/persons'
import type { PersonRead } from '@/api/types'
import { CONSENT_TEXT, PersonForm } from '@/components/common/PersonForm'
import { Alert } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'
import { Checkbox, SearchInput } from '@/components/ui/Input'
import { LoadingState } from '@/components/ui/LoadingState'
import { useAsync } from '@/hooks/useAsync'
import { useDebouncedValue } from '@/hooks/useDebouncedValue'
import { cn } from '@/lib/cn'
import { PERSON_TYPE_LABELS } from '@/lib/constants'
import { pluralize } from '@/lib/format'

type Mode = 'existing' | 'new'

/** Step 1: pick an existing person or register a new one. */
export function PersonStep({ onDone }: { onDone: (person: PersonRead) => void }) {
  const [mode, setMode] = useState<Mode>('existing')

  return (
    <div className="space-y-6">
      <div role="tablist" aria-label="Who are you enrolling?" className="inline-flex rounded-md border border-gray-300 p-1">
        {(
          [
            ['existing', 'Existing person'],
            ['new', 'New person'],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            type="button"
            role="tab"
            aria-selected={mode === value}
            onClick={() => setMode(value)}
            className={cn(
              'rounded px-4 py-1.5 text-sm',
              mode === value ? 'bg-gray-900 font-medium text-white' : 'text-gray-700 hover:bg-gray-100',
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {mode === 'existing' ? (
        <ExistingPerson onDone={onDone} onCreateNew={() => setMode('new')} />
      ) : (
        <PersonForm
          requireConsent
          onSubmit={async (values) => onDone(await createPerson(values))}
          renderActions={({ submitting, formId }) => (
            <div className="flex justify-end">
              <Button type="submit" form={formId} variant="primary" loading={submitting}>
                Save and continue
              </Button>
            </div>
          )}
        />
      )}
    </div>
  )
}

function ExistingPerson({ onDone, onCreateNew }: { onDone: (p: PersonRead) => void; onCreateNew: () => void }) {
  const [query, setQuery] = useState('')
  const q = useDebouncedValue(query)
  const [selected, setSelected] = useState<PersonRead | null>(null)
  const results = useAsync(() => listPersons({ q, active: true, size: 6 }), [q])

  if (selected) {
    return <ConfirmPerson person={selected} onBack={() => setSelected(null)} onDone={onDone} />
  }

  return (
    <div className="space-y-4">
      <div className="max-w-md">
        <label htmlFor="enroll-search" className="mb-1.5 block text-sm font-medium">
          Find a person
        </label>
        <SearchInput
          id="enroll-search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Name or ID number"
          autoFocus
        />
      </div>

      {results.loading && !results.data ? (
        <LoadingState />
      ) : results.data && results.data.items.length > 0 ? (
        <ul className="divide-y divide-gray-100 rounded-md border border-gray-200">
          {results.data.items.map((p) => (
            <li key={p.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
              <div className="min-w-0">
                <p className="font-medium text-gray-900">{p.full_name}</p>
                <p className="text-sm text-gray-500">
                  {p.id_number} · {PERSON_TYPE_LABELS[p.person_type]} · {pluralize(p.embedding_count, 'photo')}
                  {!p.consent_given && ' · No consent'}
                </p>
              </div>
              <Button size="sm" onClick={() => setSelected(p)}>
                Select
              </Button>
            </li>
          ))}
          {results.data.total > results.data.items.length && (
            <li className="px-4 py-3 text-sm text-gray-500">
              {results.data.total - results.data.items.length} more — type more of the name to narrow down.
            </li>
          )}
        </ul>
      ) : (
        <div className="rounded-md border border-gray-200 px-4 py-6 text-center text-sm text-gray-500">
          No one found.{' '}
          <button type="button" onClick={onCreateNew} className="font-medium text-gray-900 underline">
            Register a new person
          </button>
        </div>
      )}
    </div>
  )
}

/** Shows the chosen person; asks for consent first when it has not been recorded. */
function ConfirmPerson({ person, onBack, onDone }: { person: PersonRead; onBack: () => void; onDone: (p: PersonRead) => void }) {
  const [consent, setConsent] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const recordConsent = async () => {
    setSaving(true)
    setError(null)
    try {
      onDone(await updatePerson(person.id, { consent_given: true }))
    } catch (err) {
      setError(errorMessage(err))
      setSaving(false)
    }
  }

  return (
    <div className="space-y-5">
      <div className="rounded-md border border-gray-200 px-4 py-3">
        <p className="font-medium text-gray-900">{person.full_name}</p>
        <p className="text-sm text-gray-500">
          {person.id_number} · {PERSON_TYPE_LABELS[person.person_type]} · {pluralize(person.embedding_count, 'face photo')} on
          file
        </p>
      </div>

      {!person.consent_given && (
        <Alert tone="warning" title="Consent has not been recorded">
          <div className="mt-2 space-y-3">
            <Checkbox id="confirm-consent" checked={consent} onChange={(e) => setConsent(e.target.checked)} label="Consent form signed" description={CONSENT_TEXT} />
          </div>
        </Alert>
      )}

      {error && <Alert tone="error">{error}</Alert>}

      <div className="flex justify-between gap-3">
        <Button onClick={onBack}>Choose someone else</Button>
        {person.consent_given ? (
          <Button variant="primary" onClick={() => onDone(person)}>
            Continue
          </Button>
        ) : (
          <Button variant="primary" disabled={!consent} loading={saving} onClick={recordConsent}>
            Record consent and continue
          </Button>
        )}
      </div>
    </div>
  )
}
