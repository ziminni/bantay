import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { listCameras } from '@/api/cameras'
import type { CameraRead } from '@/api/types'
import { LabSelect } from '@/components/common/selects'
import { PageHeader } from '@/components/layout/PageHeader'
import { ButtonLink } from '@/components/ui/Button'
import { Checkbox } from '@/components/ui/Input'
import { EmptyState } from '@/components/ui/EmptyState'
import { ErrorState } from '@/components/ui/ErrorState'
import { LoadingState } from '@/components/ui/LoadingState'
import { useAsync } from '@/hooks/useAsync'
import { pluralize } from '@/lib/format'
import { CameraTile } from './components/CameraTile'
import { CameraViewer } from './components/CameraViewer'

export function LiveViewPage() {
  const [params, setParams] = useSearchParams()
  const labId = params.get('lab_id') ? Number(params.get('lab_id')) : undefined
  const [showDisabled, setShowDisabled] = useState(false)
  const [openId, setOpenId] = useState<number | null>(null)

  const cameras = useAsync(() => listCameras(labId ? { lab_id: labId } : {}), [labId], { refreshInterval: 15_000 })
  const all = cameras.data ?? []
  const visible = showDisabled ? all : all.filter((c) => c.enabled)
  const hiddenCount = all.length - visible.length
  const open: CameraRead | null = all.find((c) => c.id === openId) ?? null

  return (
    <>
      <PageHeader
        title="Live View"
        description="Watch the lab cameras. Entrance cameras also recognize the people walking in."
        actions={
          <div className="w-full sm:w-56">
            <label htmlFor="live-lab" className="sr-only">
              Laboratory
            </label>
            <LabSelect
              id="live-lab"
              value={labId ? String(labId) : ''}
              onChange={(e) => setParams(e.target.value ? { lab_id: e.target.value } : {}, { replace: true })}
            />
          </div>
        }
      />

      {cameras.loading && !cameras.data ? (
        <LoadingState />
      ) : cameras.error && !cameras.data ? (
        <ErrorState error={cameras.error} onRetry={cameras.reload} />
      ) : all.length === 0 ? (
        <EmptyState
          title="No cameras yet"
          description="Add a camera to a laboratory to see its live feed here."
          action={<ButtonLink to="/labs">Go to Labs</ButtonLink>}
        />
      ) : (
        <div className="space-y-6">
          {(hiddenCount > 0 || showDisabled) && (
            <Checkbox
              id="show-disabled"
              checked={showDisabled}
              onChange={(e) => setShowDisabled(e.target.checked)}
              label="Show disabled cameras"
              description={!showDisabled ? `${pluralize(hiddenCount, 'disabled camera')} hidden` : undefined}
            />
          )}
          {visible.length === 0 ? (
            <EmptyState title="All cameras here are disabled" />
          ) : (
            <div className="grid gap-6 md:grid-cols-2">
              {visible.map((c) => (
                <CameraTile key={c.id} camera={c} onOpen={() => setOpenId(c.id)} />
              ))}
            </div>
          )}
        </div>
      )}

      <CameraViewer camera={open} onClose={() => setOpenId(null)} />
    </>
  )
}
