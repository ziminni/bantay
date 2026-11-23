import { VideoOff } from 'lucide-react'
import { useState } from 'react'
import { streamUrl } from '@/api/cameras'
import type { CameraRead } from '@/api/types'
import { MOCK_MODE } from '@/config'
import { cn } from '@/lib/cn'

/**
 * The live picture of one camera. The backend serves MJPEG, which a browser
 * shows directly in an <img>. Until the backend is connected, and whenever the
 * camera has no picture, a dark placeholder explains why.
 */
export function CameraFeed({
  camera,
  className,
  fill = false,
}: {
  camera: CameraRead
  className?: string
  /** Fill the parent instead of keeping a 16:9 box (used in full-screen mode). */
  fill?: boolean
}) {
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
    <div className={cn('relative overflow-hidden bg-navy-950', fill ? 'size-full' : 'aspect-video', className)}>
      {reason ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-[radial-gradient(ellipse_at_center,var(--color-navy-800),var(--color-navy-950))] p-4 text-center">
          <span className="flex size-11 items-center justify-center rounded-full bg-white/5 text-navy-300 ring-1 ring-white/10">
            <VideoOff className="size-5" aria-hidden />
          </span>
          <p className="text-sm font-medium text-cream">{reason}</p>
          {camera.last_error && camera.status === 'OFFLINE' && (
            <p className="max-w-xs truncate text-xs text-navy-300">{camera.last_error}</p>
          )}
        </div>
      ) : (
        <>
          <img
            src={streamUrl(camera.id)}
            alt={`Live view of ${camera.name}`}
            className="absolute inset-0 size-full object-contain"
            onError={() => setBroken(true)}
          />
          <span className="absolute top-3 left-3 inline-flex items-center gap-1.5 rounded-md bg-navy-950/70 px-2 py-1 text-[11px] font-semibold tracking-wider text-cream uppercase backdrop-blur-sm">
            <span className="size-1.5 animate-pulse rounded-full bg-red-500" aria-hidden />
            Live
          </span>
        </>
      )}
      <ScanBrackets withTopLeft={Boolean(reason)} />
    </div>
  )
}

/** The four corner brackets from the Bantay mark, framing the picture like a viewfinder. */
function ScanBrackets({ withTopLeft }: { withTopLeft: boolean }) {
  const c = 'absolute size-6 border-marigold-400/70'
  return (
    <span aria-hidden className="pointer-events-none">
      {/* The top-left corner gives way to the LIVE label while streaming. */}
      {withTopLeft && <span className={cn(c, 'top-2.5 left-2.5 rounded-tl-lg border-t-2 border-l-2')} />}
      <span className={cn(c, 'top-2.5 right-2.5 rounded-tr-lg border-t-2 border-r-2')} />
      <span className={cn(c, 'right-2.5 bottom-2.5 rounded-br-lg border-r-2 border-b-2')} />
      <span className={cn(c, 'bottom-2.5 left-2.5 rounded-bl-lg border-b-2 border-l-2')} />
    </span>
  )
}
