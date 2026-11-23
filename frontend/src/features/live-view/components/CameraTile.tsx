import { DoorOpen, Maximize2, Monitor } from 'lucide-react'
import type { CameraRead } from '@/api/types'
import { CameraStatusBadge } from '@/components/common/badges'
import { CAMERA_ROLE_SHORT } from '@/lib/constants'
import { CameraFeed } from './CameraFeed'

/** One camera in the Live View grid. Clicking it opens the large view. */
export function CameraTile({ camera, onOpen }: { camera: CameraRead; onOpen: () => void }) {
  const RoleIcon = camera.role === 'ENTRY' ? DoorOpen : Monitor
  return (
    <article className="group overflow-hidden rounded-2xl border border-gray-200/80 bg-white shadow-card transition-shadow hover:shadow-raised">
      <button type="button" onClick={onOpen} className="relative block w-full text-left" aria-label={`Open ${camera.name}`}>
        <CameraFeed camera={camera} />
        <span className="absolute inset-0 flex items-center justify-center bg-navy-950/0 opacity-0 transition group-hover:bg-navy-950/30 group-hover:opacity-100">
          <span className="inline-flex items-center gap-2 rounded-lg bg-white/95 px-3 py-1.5 text-sm font-medium text-navy-900 shadow-raised">
            <Maximize2 className="size-4" aria-hidden />
            Open
          </span>
        </span>
      </button>
      <div className="flex items-center justify-between gap-3 px-5 py-4">
        <div className="min-w-0">
          <h2 className="truncate font-display text-[15px] font-semibold text-navy-900">{camera.name}</h2>
          <p className="mt-0.5 flex items-center gap-1.5 text-xs text-gray-500">
            <RoleIcon className="size-3.5" aria-hidden />
            {camera.lab_name} · {CAMERA_ROLE_SHORT[camera.role]}
          </p>
        </div>
        <CameraStatusBadge status={camera.status} />
      </div>
    </article>
  )
}
