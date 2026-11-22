import { useMemo, useState } from 'react'
import { exportEntriesCsv, listEntries } from '@/api/entries'
import { errorMessage } from '@/api/errors'
import { getPerson } from '@/api/persons'
import type { EntryLogRead } from '@/api/types'
import { PageHeader } from '@/components/layout/PageHeader'
import { Alert } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'
import { ErrorState } from '@/components/ui/ErrorState'
import { Pagination } from '@/components/ui/Pagination'
import { Section } from '@/components/ui/Section'
import { useToast } from '@/components/ui/useToast'
import { useAsync } from '@/hooks/useAsync'
import { useUrlFilters } from '@/hooks/useUrlFilters'
import { DEFAULT_PAGE_SIZE } from '@/lib/constants'
import { EntriesTable } from './components/EntriesTable'
import { EntryDetail } from './components/EntryDetail'
import { EntryFilters } from './components/EntryFilters'
import { ManualEntryForm } from './components/ManualEntryForm'
import { LOG_FILTER_DEFAULTS, toEntryParams } from './filters'

export function LogsPage() {
  const filters = useUrlFilters(LOG_FILTER_DEFAULTS)
  const size = filters.size ?? DEFAULT_PAGE_SIZE
  const params = useMemo(() => toEntryParams(filters.values), [filters.values])

  const entries = useAsync(() => listEntries({ ...params, page: filters.page, size }), [params, filters.page, size])
  const person = useAsync(
    () => (params.person_id ? getPerson(params.person_id) : Promise.resolve(null)),
    [params.person_id],
  )

  const [selected, setSelected] = useState<EntryLogRead | null>(null)
  const [adding, setAdding] = useState(false)
  const [exporting, setExporting] = useState(false)
  const toast = useToast()

  const exportCsv = async () => {
    setExporting(true)
    try {
      const blob = await exportEntriesCsv(params)
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `bantay-entries-${new Date().toISOString().slice(0, 10)}.csv`
      a.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      toast.error(errorMessage(err))
    } finally {
      setExporting(false)
    }
  }

  const page = entries.data

  return (
    <>
      <PageHeader
        title="Entry Logs"
        description="Every recorded entry into the labs, newest first. Click a row for details."
        actions={
          <Button variant="primary" onClick={() => setAdding(true)}>
            Add manual entry
          </Button>
        }
      />

      {params.person_id && (
        <Alert
          className="mb-6"
          title={`Showing entries of ${person.data?.full_name ?? 'one person'}`}
          action={
            <Button size="sm" variant="ghost" onClick={() => filters.setFilters({ person_id: '' })}>
              Show everyone
            </Button>
          }
        />
      )}

      <Section flush>
        <EntryFilters
          values={filters.values}
          activeCount={(['q', 'range', 'lab_id', 'camera_id', 'status'] as const).filter((k) => filters.values[k]).length}
          onChange={filters.setFilters}
          onClear={() => filters.setFilters({ ...LOG_FILTER_DEFAULTS, person_id: filters.values.person_id })}
          actions={
            <Button onClick={exportCsv} loading={exporting} disabled={!page || page.total === 0}>
              Export CSV
            </Button>
          }
        />

        {entries.error ? (
          <ErrorState error={entries.error} onRetry={entries.reload} />
        ) : (
          <>
            <EntriesTable rows={page?.items} loading={entries.loading} onOpen={setSelected} />
            {page && page.total > 0 && (
              <Pagination
                page={page.page}
                pages={page.pages}
                total={page.total}
                size={page.size}
                onPageChange={filters.setPage}
                onSizeChange={filters.setSize}
                noun="entries"
              />
            )}
          </>
        )}
      </Section>

      <EntryDetail
        entry={selected}
        onClose={() => setSelected(null)}
        onDeleted={() => {
          setSelected(null)
          entries.reload()
        }}
      />

      <ManualEntryForm
        open={adding}
        onClose={() => setAdding(false)}
        onLogged={() => {
          toast.success('Entry recorded.')
          entries.reload()
        }}
      />
    </>
  )
}
