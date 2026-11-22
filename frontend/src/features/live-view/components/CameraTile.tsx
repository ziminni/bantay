import type { CameraRead } from '@/api/types'
import { CameraStatusBadge } from '@/components/common/badges'
import { CAMERA_ROLE_SHORT } from '@/lib/constants'
import { CameraFeed } from './CameraFeed'

/** One camera in the Live View grid. Clicking it opens the large view. */
export function CameraTile({ camera, onOpen }: { camera: CameraRead; onOpen: () => void }) {
  return (
    <article className="overflow-hidden rounded-lg border border-gray-200 bg-white">
      <button type="button" onClick={onOpen} className="block w-full text-left" aria-label={`Open ${camera.name}`}>
        <CameraFeed camera={camera} />
      </button>
      <div className="flex items-start justify-between gap-3 px-4 py-3">
        <div className="min-w-0">
          <h2 className="truncate text-sm font-medium text-gray-900">{camera.name}</h2>
          <p className="text-xs text-gray-500">
            {camera.lab_name} · {CAMERA_ROLE_SHORT[camera.role]}
          </p>
        </div>
        <CameraStatusBadge status={camera.status} />
      </div>
    </article>
  )
}
