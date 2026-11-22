import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { listCameras } from '@/api/cameras'
import { errorMessage } from '@/api/errors'
import { deleteLab, getLab, updateLab } from '@/api/labs'
import type { CameraRead } from '@/api/types'
import { ActiveBadge } from '@/components/common/badges'
import { PageHeader } from '@/components/layout/PageHeader'
import { Alert } from '@/components/ui/Alert'
import { Button, ButtonLink } from '@/components/ui/Button'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { DescriptionList } from '@/components/ui/DescriptionList'
import { ErrorState } from '@/components/ui/ErrorState'
import { LoadingState } from '@/components/ui/LoadingState'
import { Modal } from '@/components/ui/Modal'
import { Section } from '@/components/ui/Section'
import { useToast } from '@/components/ui/useToast'
import { useAsync } from '@/hooks/useAsync'
import { formatDate, formatDuration, formatOpeningHours, formatSimilarity } from '@/lib/format'
import { CameraForm } from './components/CameraForm'
import { CameraList } from './components/CameraList'
import { LabForm } from './components/LabForm'

type Dialog = 'edit' | 'deactivate' | 'delete' | 'camera' | null

export function LabDetailPage() {
  const id = Number(useParams().id)
  const navigate = useNavigate()
  const toast = useToast()
  const [dialog, setDialog] = useState<Dialog>(null)
  const [editingCamera, setEditingCamera] = useState<CameraRead | null>(null)

  const lab = useAsync(() => getLab(id), [id])
  const cameras = useAsync(() => listCameras({ lab_id: id }), [id])

  const l = lab.data
  if (lab.loading && !l) return <LoadingState />
  if (!l) return <ErrorState error={lab.error} onRetry={lab.reload} />

  const refresh = () => {
    lab.reload()
    cameras.reload()
  }

  const activate = async () => {
    try {
      await updateLab(l.id, { active: true })
      toast.success(`${l.name} is active again.`)
      lab.reload()
    } catch (err) {
      toast.error(errorMessage(err))
    }
  }

  const openCamera = (camera: CameraRead | null) => {
    setEditingCamera(camera)
    setDialog('camera')
  }

  return (
    <>
      <PageHeader
        back={{ to: '/labs', label: 'Labs' }}
        title={l.name}
        description={l.room ?? undefined}
        actions={
          <>
            <ButtonLink to={`/logs?lab_id=${l.id}`}>Entry logs</ButtonLink>
            <Button onClick={() => setDialog('edit')}>Edit</Button>
            {l.active ? (
              <Button onClick={() => setDialog('deactivate')}>Deactivate</Button>
            ) : (
              <Button onClick={activate}>Activate</Button>
            )}
            <Button variant="danger" onClick={() => setDialog('delete')}>
              Delete
            </Button>
          </>
        }
      />

      <div className="space-y-6">
        {!l.active && <Alert title="This lab is inactive">No entries are recorded here until it is activated again.</Alert>}

        <div className="grid gap-6 lg:grid-cols-3">
          <Section title="Settings">
            <DescriptionList
              items={[
                { label: 'Room', value: l.room ?? '—' },
                { label: 'Opening hours', value: formatOpeningHours(l.open_time, l.close_time) },
                { label: 'Match threshold', value: `${formatSimilarity(l.match_threshold)} similarity` },
                { label: 'Cooldown', value: formatDuration(l.cooldown_seconds) },
                { label: 'Status', value: <ActiveBadge active={l.active} /> },
                { label: 'Created', value: formatDate(l.created_at) },
              ]}
            />
          </Section>

          <Section
            title="Cameras"
            description="Entrance cameras record entries. Room cameras are for live view only."
            className="lg:col-span-2"
            flush
            actions={
              cameras.data && cameras.data.length > 0 ? (
                <Button size="sm" onClick={() => openCamera(null)}>
                  Add camera
                </Button>
              ) : undefined
            }
          >
            {cameras.error ? (
              <ErrorState error={cameras.error} onRetry={cameras.reload} />
            ) : cameras.data ? (
              <CameraList cameras={cameras.data} onEdit={openCamera} onAdd={() => openCamera(null)} onChanged={refresh} />
            ) : (
              <LoadingState />
            )}
          </Section>
        </div>
      </div>

      <Modal open={dialog === 'edit'} onClose={() => setDialog(null)} title={`Edit ${l.name}`} size="lg">
        <LabForm
          lab={l}
          onSubmit={async (values) => {
            await updateLab(l.id, values)
            toast.success('Changes saved.')
            setDialog(null)
            lab.reload()
          }}
          renderActions={({ submitting, formId }) => (
            <div className="flex justify-end gap-3 border-t border-gray-200 pt-5">
              <Button onClick={() => setDialog(null)} disabled={submitting}>
                Cancel
              </Button>
              <Button type="submit" form={formId} variant="primary" loading={submitting}>
                Save changes
              </Button>
            </div>
          )}
        />
      </Modal>

      <CameraForm
        open={dialog === 'camera'}
        labId={l.id}
        camera={editingCamera}
        onClose={() => setDialog(null)}
        onSaved={(message) => {
          toast.success(message)
          refresh()
        }}
      />

      <ConfirmDialog
        open={dialog === 'deactivate'}
        onClose={() => setDialog(null)}
        title={`Deactivate ${l.name}?`}
        confirmLabel="Deactivate"
        onConfirm={async () => {
          await updateLab(l.id, { active: false })
          toast.success(`${l.name} deactivated.`)
          lab.reload()
        }}
      >
        <p>Bantay stops recording entries in this lab. Its history and cameras are kept, and you can activate it again later.</p>
      </ConfirmDialog>

      <ConfirmDialog
        open={dialog === 'delete'}
        onClose={() => setDialog(null)}
        title={`Delete ${l.name}?`}
        confirmLabel="Delete lab"
        destructive
        onConfirm={async () => {
          await deleteLab(l.id)
          toast.success(`${l.name} deleted.`)
          navigate('/labs')
        }}
      >
        <p>The lab and its cameras are deleted. This cannot be undone.</p>
        <p>A lab that already has entry logs cannot be deleted, to keep the records complete — deactivate it instead.</p>
      </ConfirmDialog>
    </>
  )
}
