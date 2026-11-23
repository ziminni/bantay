import { Maximize, Minimize, ScrollText, Settings2 } from 'lucide-react'
import type { CameraRead } from '@/api/types'
import { CameraStatusBadge } from '@/components/common/badges'
import { ButtonLink } from '@/components/ui/Button'
import { DescriptionList } from '@/components/ui/DescriptionList'
import { Modal } from '@/components/ui/Modal'
import { useFullscreen } from '@/hooks/useFullscreen'
import { cn } from '@/lib/cn'
import { CAMERA_ROLE_LABELS } from '@/lib/constants'
import { formatRelative } from '@/lib/format'
import { CameraFeed } from './CameraFeed'

/** One camera, large, with its details — and a button to watch it full screen. */
export function CameraViewer({ camera, onClose }: { camera: CameraRead | null; onClose: () => void }) {
  return (
    <Modal
      open={camera !== null}
      onClose={onClose}
      size="xl"
      title={camera?.name ?? ''}
      description={camera?.lab_name ?? undefined}
      footer={
        camera && (
          <>
            <ButtonLink to={`/logs?camera_id=${camera.id}&range=today`} icon={<ScrollText />}>
              Today&apos;s entries
            </ButtonLink>
            <ButtonLink to={`/labs/${camera.lab_id}`} icon={<Settings2 />}>
              Camera settings
            </ButtonLink>
          </>
        )
      }
    >
      {camera && (
        <div className="space-y-6">
          <FullscreenFeed camera={camera} />
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

/**
 * The feed with a full-screen button in its corner. Double-clicking the picture
 * does the same; Esc or the button leaves full screen.
 */
function FullscreenFeed({ camera }: { camera: CameraRead }) {
  const { ref, ...fs } = useFullscreen<HTMLDivElement>()

  return (
    <div
      ref={ref}
      onDoubleClick={fs.supported ? () => void fs.toggle() : undefined}
      className={cn('group relative overflow-hidden bg-navy-950', fs.isFullscreen ? 'flex h-full w-full items-center' : 'rounded-xl')}
    >
      <CameraFeed camera={camera} fill={fs.isFullscreen} />

      {/* Full screen: the camera's name across the top. */}
      {fs.isFullscreen && (
        <div className="pointer-events-none absolute inset-x-0 top-0 flex items-center gap-3 bg-gradient-to-b from-navy-950/90 to-transparent px-8 pt-6 pb-12">
          <div className="min-w-0">
            <p className="truncate font-display text-xl font-semibold text-cream">{camera.name}</p>
            <p className="text-sm text-navy-200">{camera.lab_name}</p>
          </div>
          <CameraStatusBadge status={camera.status} />
        </div>
      )}

      {fs.supported && (
        <button
          type="button"
          onClick={() => void fs.toggle()}
          aria-label={fs.isFullscreen ? 'Exit full screen' : 'Full screen'}
          title={fs.isFullscreen ? 'Exit full screen (Esc)' : 'Full screen'}
          className={cn(
            'absolute z-10 inline-flex items-center gap-2 rounded-lg bg-navy-950/70 text-cream ring-1 ring-white/15 backdrop-blur-sm transition hover:bg-navy-950/90 focus-visible:opacity-100',
            fs.isFullscreen ? 'top-6 right-8 h-10 px-3.5 text-sm font-medium' : 'top-3 right-3 size-9 justify-center',
          )}
        >
          {fs.isFullscreen ? (
            <>
              <Minimize className="size-4" aria-hidden />
              Exit full screen
            </>
          ) : (
            <Maximize className="size-4" aria-hidden />
          )}
        </button>
      )}
    </div>
  )
}
