import { Cctv, Monitor, Plus } from 'lucide-react'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { createLab, listLabs } from '@/api/labs'
import type { LabRead } from '@/api/types'
import { ActiveBadge } from '@/components/common/badges'
import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/Button'
import { DataTable, type Column } from '@/components/ui/DataTable'
import { EmptyState } from '@/components/ui/EmptyState'
import { ErrorState } from '@/components/ui/ErrorState'
import { Modal } from '@/components/ui/Modal'
import { Section } from '@/components/ui/Section'
import { useToast } from '@/components/ui/useToast'
import { useAsync } from '@/hooks/useAsync'
import { formatDuration, formatOpeningHours, formatSimilarity } from '@/lib/format'
import { LabForm } from './components/LabForm'

const columns: Column<LabRead>[] = [
  {
    key: 'name',
    header: 'Laboratory',
    cell: (l) => (
      <div className="flex min-w-0 items-center gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-navy-50 text-navy-700">
          <Monitor className="size-[18px]" aria-hidden />
        </span>
        <div className="min-w-0">
          <span className="block truncate font-medium text-navy-900">{l.name}</span>
          {l.room && <span className="block truncate text-xs text-gray-500">{l.room}</span>}
        </div>
      </div>
    ),
  },
  { key: 'hours', header: 'Hours', hideBelow: 'md', cell: (l) => formatOpeningHours(l.open_time, l.close_time) },
  { key: 'threshold', header: 'Threshold', hideBelow: 'lg', align: 'right', cell: (l) => formatSimilarity(l.match_threshold) },
  { key: 'cooldown', header: 'Cooldown', hideBelow: 'lg', align: 'right', cell: (l) => formatDuration(l.cooldown_seconds) },
  {
    key: 'cameras',
    header: 'Cameras',
    align: 'right',
    cell: (l) => (
      <span className="inline-flex items-center gap-1.5 tabular-nums">
        <Cctv className="size-4 text-gray-400" aria-hidden />
        {l.camera_count}
      </span>
    ),
  },
  { key: 'status', header: 'Status', cell: (l) => <ActiveBadge active={l.active} /> },
]

export function LabsPage() {
  const labs = useAsync(() => listLabs(), [])
  const [adding, setAdding] = useState(false)
  const navigate = useNavigate()
  const toast = useToast()

  return (
    <>
      <PageHeader
        title="Labs"
        description="Computer laboratories, their recognition settings and their cameras. Open a lab to manage its cameras."
        actions={
          <Button variant="primary" onClick={() => setAdding(true)} icon={<Plus />}>
            Add lab
          </Button>
        }
      />

      <Section flush>
        {labs.error ? (
          <ErrorState error={labs.error} onRetry={labs.reload} />
        ) : (
          <DataTable
            columns={columns}
            rows={labs.data}
            rowKey={(l) => l.id}
            loading={labs.loading}
            onRowClick={(l) => navigate(`/labs/${l.id}`)}
            rowLabel={(l) => `Open ${l.name}`}
            caption="Laboratories"
            empty={
              <EmptyState
                title="No laboratories yet"
                description="Add the first lab, then add the camera at its entrance."
                action={
                  <Button variant="primary" onClick={() => setAdding(true)} icon={<Plus />}>
                    Add lab
                  </Button>
                }
              />
            }
          />
        )}
      </Section>

      <Modal open={adding} onClose={() => setAdding(false)} title="Add lab" size="lg">
        <LabForm
          onSubmit={async (values) => {
            const lab = await createLab(values)
            toast.success(`${lab.name} added. Now add its entrance camera.`)
            navigate(`/labs/${lab.id}`)
          }}
          renderActions={({ submitting, formId }) => (
            <div className="flex justify-end gap-3 border-t border-gray-200 pt-5">
              <Button onClick={() => setAdding(false)} disabled={submitting}>
                Cancel
              </Button>
              <Button type="submit" form={formId} variant="primary" loading={submitting}>
                Add lab
              </Button>
            </div>
          )}
        />
      </Modal>
    </>
  )
}
