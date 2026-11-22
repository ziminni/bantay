import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { createPerson, listPersons } from '@/api/persons'
import type { PersonRead, PersonType } from '@/api/types'
import { ActiveBadge } from '@/components/common/badges'
import { PersonForm } from '@/components/common/PersonForm'
import { PageHeader } from '@/components/layout/PageHeader'
import { Button, ButtonLink } from '@/components/ui/Button'
import { DataTable, type Column } from '@/components/ui/DataTable'
import { EmptyState } from '@/components/ui/EmptyState'
import { ErrorState } from '@/components/ui/ErrorState'
import { FilterBar } from '@/components/ui/FilterBar'
import { FormField } from '@/components/ui/FormField'
import { SearchInput, Select } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import { Pagination } from '@/components/ui/Pagination'
import { Section } from '@/components/ui/Section'
import { useToast } from '@/components/ui/useToast'
import { useAsync } from '@/hooks/useAsync'
import { useSearchBox } from '@/hooks/useSearchBox'
import { useUrlFilters } from '@/hooks/useUrlFilters'
import { DEFAULT_PAGE_SIZE, MIN_ENROLLMENT_PHOTOS, PERSON_TYPE_LABELS, toOptions } from '@/lib/constants'

const DEFAULTS = { q: '', type: '', status: '', enrolled: '' }

const columns: Column<PersonRead>[] = [
  {
    key: 'name',
    header: 'Name',
    cell: (p) => (
      <>
        <span className="font-medium text-gray-900">{p.full_name}</span>
        <span className="block text-xs text-gray-500">{p.id_number}</span>
      </>
    ),
  },
  { key: 'type', header: 'Type', hideBelow: 'sm', cell: (p) => PERSON_TYPE_LABELS[p.person_type] },
  { key: 'dept', header: 'Department', hideBelow: 'lg', cell: (p) => p.department ?? '—' },
  {
    key: 'faces',
    header: 'Face photos',
    cell: (p) =>
      p.embedding_count === 0 ? (
        <span className="text-gray-500">Not enrolled</span>
      ) : p.embedding_count < MIN_ENROLLMENT_PHOTOS ? (
        <span>
          {p.embedding_count} <span className="text-gray-500">· needs more</span>
        </span>
      ) : (
        p.embedding_count
      ),
  },
  { key: 'consent', header: 'Consent', hideBelow: 'md', cell: (p) => (p.consent_given ? 'Signed' : 'Not signed') },
  { key: 'status', header: 'Status', cell: (p) => <ActiveBadge active={p.active} /> },
]

export function UsersPage() {
  const filters = useUrlFilters(DEFAULTS)
  const { values } = filters
  const size = filters.size ?? DEFAULT_PAGE_SIZE
  const navigate = useNavigate()
  const toast = useToast()
  const [adding, setAdding] = useState(false)

  const [search, setSearch] = useSearchBox(values.q, (q) => filters.setFilters({ q }))

  const persons = useAsync(
    () =>
      listPersons({
        q: values.q || undefined,
        person_type: (values.type || undefined) as PersonType | undefined,
        active: values.status ? values.status === 'active' : undefined,
        enrolled_only: values.enrolled === 'yes',
        page: filters.page,
        size,
      }),
    [values, filters.page, size],
  )
  const page = persons.data

  return (
    <>
      <PageHeader
        title="Users"
        description="Students, faculty and staff who can be recognized at lab entrances."
        actions={
          <>
            <ButtonLink to="/enroll">Enroll a face</ButtonLink>
            <Button variant="primary" onClick={() => setAdding(true)}>
              Add person
            </Button>
          </>
        }
      />

      <Section flush>
        <FilterBar
          activeCount={filters.activeCount}
          onClear={filters.reset}
          primary={
            <>
              <label htmlFor="users-search" className="sr-only">
                Search people
              </label>
              <SearchInput
                id="users-search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by name or ID number"
              />
            </>
          }
        >
          <FormField htmlFor="users-type" label="Type">
            <Select
              id="users-type"
              value={values.type}
              onChange={(e) => filters.setFilters({ type: e.target.value })}
              options={toOptions(PERSON_TYPE_LABELS)}
              placeholder="All types"
            />
          </FormField>
          <FormField htmlFor="users-status" label="Status">
            <Select
              id="users-status"
              value={values.status}
              onChange={(e) => filters.setFilters({ status: e.target.value })}
              options={[
                { value: 'active', label: 'Active' },
                { value: 'inactive', label: 'Inactive' },
              ]}
              placeholder="All"
            />
          </FormField>
          <FormField htmlFor="users-enrolled" label="Face photos">
            <Select
              id="users-enrolled"
              value={values.enrolled}
              onChange={(e) => filters.setFilters({ enrolled: e.target.value })}
              options={[{ value: 'yes', label: 'Has face photos' }]}
              placeholder="Anyone"
            />
          </FormField>
        </FilterBar>

        {persons.error ? (
          <ErrorState error={persons.error} onRetry={persons.reload} />
        ) : (
          <>
            <DataTable
              columns={columns}
              rows={page?.items}
              rowKey={(p) => p.id}
              loading={persons.loading}
              onRowClick={(p) => navigate(`/users/${p.id}`)}
              rowLabel={(p) => `Open ${p.full_name}`}
              caption="People"
              empty={
                <EmptyState
                  title={filters.activeCount ? 'No one matches these filters' : 'No one registered yet'}
                  description={filters.activeCount ? 'Try a different search or clear the filters.' : 'Add a person, then enroll their face.'}
                />
              }
            />
            {page && page.total > 0 && (
              <Pagination
                page={page.page}
                pages={page.pages}
                total={page.total}
                size={page.size}
                onPageChange={filters.setPage}
                onSizeChange={filters.setSize}
                noun="people"
              />
            )}
          </>
        )}
      </Section>

      <Modal open={adding} onClose={() => setAdding(false)} title="Add person" size="lg">
        <PersonForm
          onSubmit={async (values) => {
            const person = await createPerson(values)
            toast.success(`${person.full_name} added. Add face photos to finish enrollment.`)
            navigate(`/users/${person.id}`)
          }}
          renderActions={({ submitting, formId }) => (
            <div className="flex justify-end gap-3 border-t border-gray-200 pt-5">
              <Button onClick={() => setAdding(false)} disabled={submitting}>
                Cancel
              </Button>
              <Button type="submit" form={formId} variant="primary" loading={submitting}>
                Add person
              </Button>
            </div>
          )}
        />
      </Modal>
    </>
  )
}
