import type { ReactNode } from 'react'
import { CameraSelect, LabSelect } from '@/components/common/selects'
import { FilterBar } from '@/components/ui/FilterBar'
import { FormField } from '@/components/ui/FormField'
import { Input, SearchInput, Select } from '@/components/ui/Input'
import { useSearchBox } from '@/hooks/useSearchBox'
import { ENTRY_STATUS_LABELS, toOptions } from '@/lib/constants'
import { RANGE_OPTIONS, type LogFilters } from '../filters'

interface EntryFiltersProps {
  values: LogFilters
  activeCount: number
  onChange: (next: Partial<LogFilters>) => void
  onClear: () => void
  actions?: ReactNode
}

export function EntryFilters({ values, activeCount, onChange, onClear, actions }: EntryFiltersProps) {
  const [search, setSearch] = useSearchBox(values.q, (q) => onChange({ q }))

  return (
    <FilterBar
      activeCount={activeCount}
      onClear={onClear}
      actions={actions}
      primary={
        <>
          <label htmlFor="logs-search" className="sr-only">
            Search entries
          </label>
          <SearchInput
            id="logs-search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name or ID number"
          />
        </>
      }
    >
      <FormField htmlFor="logs-range" label="Date">
        <Select
          id="logs-range"
          value={values.range}
          onChange={(e) => onChange({ range: e.target.value, from: '', to: '' })}
          options={RANGE_OPTIONS}
          placeholder="Any time"
        />
      </FormField>

      <FormField htmlFor="logs-lab" label="Laboratory">
        <LabSelect
          id="logs-lab"
          value={values.lab_id}
          onChange={(e) => onChange({ lab_id: e.target.value, camera_id: '' })}
        />
      </FormField>

      <FormField htmlFor="logs-camera" label="Camera">
        <CameraSelect
          id="logs-camera"
          labId={values.lab_id ? Number(values.lab_id) : undefined}
          value={values.camera_id}
          onChange={(e) => onChange({ camera_id: e.target.value })}
        />
      </FormField>

      <FormField htmlFor="logs-status" label="Status">
        <Select
          id="logs-status"
          value={values.status}
          onChange={(e) => onChange({ status: e.target.value })}
          options={toOptions(ENTRY_STATUS_LABELS)}
          placeholder="All"
        />
      </FormField>

      {values.range === 'custom' && (
        <>
          <FormField htmlFor="logs-from" label="From">
            <Input id="logs-from" type="datetime-local" value={values.from} onChange={(e) => onChange({ from: e.target.value })} />
          </FormField>
          <FormField htmlFor="logs-to" label="To">
            <Input id="logs-to" type="datetime-local" value={values.to} min={values.from || undefined} onChange={(e) => onChange({ to: e.target.value })} />
          </FormField>
        </>
      )}
    </FilterBar>
  )
}
