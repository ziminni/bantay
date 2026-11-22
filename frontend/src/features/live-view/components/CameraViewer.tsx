import type { CameraRead } from '@/api/types'
import { CameraStatusBadge } from '@/components/common/badges'
import { ButtonLink } from '@/components/ui/Button'
import { DescriptionList } from '@/components/ui/DescriptionList'
import { Modal } from '@/components/ui/Modal'
import { CAMERA_ROLE_LABELS } from '@/lib/constants'
import { formatRelative } from '@/lib/format'
import { CameraFeed } from './CameraFeed'

/** One camera, large, with its details. */
export function CameraViewer({ camera, onClose }: { camera: CameraRead | null; onClose: () => void }) {
  return (
    <Modal
      open={camera !== null}
      onClose={onClose}
      size="lg"
      title={camera?.name ?? ''}
      description={camera?.lab_name ?? undefined}
      footer={
        camera && (
          <>
            <ButtonLink to={`/logs?camera_id=${camera.id}&range=today`}>Today&apos;s entries</ButtonLink>
            <ButtonLink to={`/labs/${camera.lab_id}`}>Camera settings</ButtonLink>
          </>
        )
      }
    >
      {camera && (
        <div className="space-y-5">
          <CameraFeed camera={camera} className="rounded-md" />
          <DescriptionList
            columns={2}
            items={[
              { label: 'Status', value: <CameraStatusBadge status={camera.status} /> },
              { label: 'Type', value: CAMERA_ROLE_LABELS[camera.role] },
              { label: 'Last picture', value: formatRelative(camera.last_seen_at) },
              { label: 'Last error', value: camera.last_error ?? 'None' },
            ]}
          />
        </div>
      )}
    </Modal>
  )
}
