import { useState } from 'react'
import { streamUrl } from '@/api/cameras'
import type { CameraRead } from '@/api/types'
import { MOCK_MODE } from '@/config'
import { cn } from '@/lib/cn'

/**
 * The live picture of one camera. The backend serves MJPEG, which a browser
 * shows directly in an <img>. Until the backend is connected, and whenever the
 * camera has no picture, a grey placeholder explains why.
 */
export function CameraFeed({ camera, className }: { camera: CameraRead; className?: string }) {
  const [broken, setBroken] = useState(false)

  const reason = MOCK_MODE
    ? 'Live video appears here once the backend is connected'
    : camera.status === 'DISABLED'
      ? 'Camera is disabled'
      : camera.status === 'OFFLINE'
        ? 'Camera is offline'
        : broken
          ? 'The stream could not be loaded'
          : null

  return (
    <div className={cn('relative aspect-video overflow-hidden bg-gray-200', className)}>
      {reason ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 p-4 text-center">
          <p className="text-sm font-medium text-gray-700">{camera.name}</p>
          <p className="text-xs text-gray-500">{reason}</p>
        </div>
      ) : (
        <img
          src={streamUrl(camera.id)}
          alt={`Live view of ${camera.name}`}
          className="absolute inset-0 size-full object-contain"
          onError={() => setBroken(true)}
        />
      )}
    </div>
  )
}
