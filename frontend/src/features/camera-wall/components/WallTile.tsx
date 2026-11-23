import type { CameraRead } from '@/api/types'
import { CameraFeed } from '@/features/live-view/components/CameraFeed'
import { cn } from '@/lib/cn'
import { CAMERA_ROLE_SHORT } from '@/lib/constants'

interface WallTileProps {
  camera: CameraRead | null
  channel: number
  /** The wall's shared clock, already formatted, like a DVR's on-screen time. */
  clock: string
  /** Stretch to the grid cell (full screen) instead of keeping 16:9. */
  fill: boolean
  /** Show the lab name too (on the "All labs" wall). */
  showLab: boolean
  onSelect?: () => void
  selected?: boolean
}

/** One channel of the camera wall, with a security-monitor style overlay. */
export function WallTile({ camera, channel, clock, fill, showLab, onSelect, selected }: WallTileProps) {
  const ch = `CH ${String(channel).padStart(2, '0')}`

  if (!camera) {
    return (
      <div
        className={cn(
          'flex items-center justify-center rounded-md bg-navy-950 bg-[repeating-linear-gradient(0deg,transparent,transparent_3px,rgb(255_255_255/0.015)_3px,rgb(255_255_255/0.015)_4px)] ring-1 ring-white/5',
          fill ? 'size-full' : 'aspect-video',
        )}
      >
        <div className="text-center font-mono text-[11px] tracking-[0.2em] text-navy-500">
          <p>{ch}</p>
          <p className="mt-1">NO CHANNEL</p>
        </div>
      </div>
    )
  }

  const online = camera.status === 'ONLINE'

  return (
    <button
      type="button"
      onClick={onSelect}
      aria-label={`${selected ? 'Back to the wall from' : 'Focus on'} ${camera.name}`}
      className={cn(
        'group relative block overflow-hidden rounded-md bg-navy-950 text-left ring-1 transition-shadow',
        selected ? 'ring-marigold-400/60' : 'ring-white/5 hover:ring-marigold-400/60',
        fill ? 'size-full' : 'aspect-video',
      )}
    >
      <CameraFeed camera={camera} fill chrome={false} />

      {/* Top: channel and name on the left, the clock on the right. */}
      <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between gap-2 bg-gradient-to-b from-navy-950/85 to-transparent px-3 pt-2 pb-6 font-mono text-[11px] text-cream">
        <span className="min-w-0 truncate">
          <span className="text-marigold-400">{ch}</span>
          <span className="ml-2 font-sans text-xs font-medium">{camera.name}</span>
          {showLab && camera.lab_name && <span className="ml-1.5 font-sans text-xs text-navy-200">· {camera.lab_name}</span>}
        </span>
        <span className="shrink-0 tabular-nums text-cream/90">{clock}</span>
      </div>

      {/* Bottom: recording state and camera type. */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-end justify-between bg-gradient-to-t from-navy-950/85 to-transparent px-3 pt-6 pb-2 font-mono text-[11px]">
        {online ? (
          <span className="inline-flex items-center gap-1.5 font-semibold text-cream">
            <span className="size-2 animate-pulse rounded-full bg-red-500" aria-hidden />
            REC
          </span>
        ) : (
          <span className="font-semibold tracking-wider text-red-400">{camera.status === 'DISABLED' ? 'DISABLED' : 'NO SIGNAL'}</span>
        )}
        <span className="text-navy-200 uppercase">{CAMERA_ROLE_SHORT[camera.role]}</span>
      </div>
    </button>
  )
}
