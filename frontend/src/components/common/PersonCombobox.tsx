import { useId, useState } from 'react'
import { listPersons } from '@/api/persons'
import type { PersonRead } from '@/api/types'
import { SearchInput } from '@/components/ui/Input'
import { useAsync } from '@/hooks/useAsync'
import { useDebouncedValue } from '@/hooks/useDebouncedValue'
import { PERSON_TYPE_LABELS } from '@/lib/constants'

interface PersonComboboxProps {
  id?: string
  value: PersonRead | null
  onChange: (person: PersonRead | null) => void
  invalid?: boolean
}

/** Search for one person by name or ID number and pick them. */
export function PersonCombobox({ id, value, onChange, invalid }: PersonComboboxProps) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const q = useDebouncedValue(query, 200)
  const listId = useId()
  const results = useAsync(() => (open ? listPersons({ q, active: true, size: 8 }) : Promise.resolve(null)), [q, open])

  if (value) {
    return (
      <div className="flex h-10 items-center justify-between gap-3 rounded-md border border-gray-300 bg-white px-3 text-sm">
        <span className="truncate">
          <span className="font-medium">{value.full_name}</span>
          <span className="text-gray-500"> · {value.id_number}</span>
        </span>
        <button type="button" onClick={() => onChange(null)} className="shrink-0 text-gray-600 underline hover:text-gray-900">
          Change
        </button>
      </div>
    )
  }

  const items = results.data?.items ?? []

  return (
    <div className="relative">
      <SearchInput
        id={id}
        value={query}
        onChange={(e) => {
          setQuery(e.target.value)
          setOpen(true)
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        placeholder="Search by name or ID number"
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-invalid={invalid}
        autoComplete="off"
      />
      {open && (
        <ul
          id={listId}
          role="listbox"
          className="absolute z-10 mt-1 max-h-64 w-full overflow-y-auto rounded-md border border-gray-200 bg-white py-1 shadow-lg"
        >
          {results.loading ? (
            <li className="px-3 py-2 text-sm text-gray-500">Searching…</li>
          ) : items.length === 0 ? (
            <li className="px-3 py-2 text-sm text-gray-500">No one found.</li>
          ) : (
            items.map((p) => (
              <li
                key={p.id}
                role="option"
                aria-selected={false}
                onMouseDown={(e) => {
                  e.preventDefault()
                  onChange(p)
                  setQuery('')
                  setOpen(false)
                }}
                className="cursor-pointer px-3 py-2 text-sm hover:bg-gray-100"
              >
                <span className="font-medium">{p.full_name}</span>
                <span className="block text-xs text-gray-500">
                  {p.id_number} · {PERSON_TYPE_LABELS[p.person_type]}
                </span>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  )
}
