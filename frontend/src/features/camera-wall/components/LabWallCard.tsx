import { ArrowRight, Cctv, Layers, Monitor } from 'lucide-react'
import { Link } from 'react-router-dom'
import type { CameraRead } from '@/api/types'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { cn } from '@/lib/cn'
import { pluralize } from '@/lib/format'

interface LabWallCardProps {
  to: string
  title: string
  subtitle?: string | null
  cameras: CameraRead[]
  /** The "All labs" card is navy so it stands apart from the single labs. */
  featured?: boolean
  inactive?: boolean
}

/**
 * One lab on the camera-wall picker: a small mosaic of its cameras (names and
 * status only — no video, so the picker stays light), then how many are online.
 */
export function LabWallCard({ to, title, subtitle, cameras, featured = false, inactive = false }: LabWallCardProps) {
  const enabled = cameras.filter((c) => c.enabled)
  const online = enabled.filter((c) => c.status === 'ONLINE').length
  const preview = enabled.slice(0, 4)
  const Icon = featured ? Layers : Monitor

  return (
    <Link
      to={to}
      className={cn(
        'group flex flex-col overflow-hidden rounded-2xl shadow-card ring-1 transition-[box-shadow,transform] hover:-translate-y-0.5 hover:shadow-raised',
        featured ? 'bg-navy-900 ring-navy-900' : 'bg-white ring-gray-200/80',
      )}
    >
      {/* Mosaic preview */}
      <div className={cn('grid aspect-video grid-cols-2 grid-rows-2 gap-1 p-1', featured ? 'bg-navy-950' : 'bg-navy-900')}>
        {preview.length === 0 ? (
          <div className="col-span-2 row-span-2 flex flex-col items-center justify-center gap-2 text-navy-300">
            <Cctv className="size-6" aria-hidden />
            <span className="text-xs">No cameras yet</span>
          </div>
        ) : (
          Array.from({ length: 4 }, (_, i) => {
            const cam = preview[i]
            return (
              <div
                key={cam?.id ?? `empty-${i}`}
                className="relative flex items-end overflow-hidden rounded-md bg-[radial-gradient(ellipse_at_center,var(--color-navy-800),var(--color-navy-950))] p-2"
              >
                {cam ? (
                  <>
                    <span className="absolute top-1.5 left-2 font-mono text-[9px] tracking-wider text-navy-300">
                      CH {String(i + 1).padStart(2, '0')}
                    </span>
                    <span
                      aria-hidden
                      className={cn(
                        'absolute top-2 right-2 size-1.5 rounded-full',
                        cam.status === 'ONLINE' ? 'bg-emerald-400' : 'bg-red-500',
                      )}
                    />
                    <span className="truncate text-[11px] font-medium text-cream/90">{cam.name}</span>
                  </>
                ) : (
                  <span className="font-mono text-[9px] tracking-wider text-navy-500">NO CHANNEL</span>
                )}
              </div>
            )
          })
        )}
      </div>

      <div className="flex flex-1 flex-col p-5">
        <div className="flex items-start gap-3">
          <span
            className={cn(
              'flex size-10 shrink-0 items-center justify-center rounded-xl',
              featured ? 'bg-white/10 text-marigold-400' : 'bg-navy-50 text-navy-700',
            )}
          >
            <Icon className="size-5" aria-hidden />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className={cn('truncate font-display text-lg font-semibold', featured ? 'text-cream' : 'text-navy-900')}>
              {title}
            </h2>
            <p className={cn('truncate text-sm', featured ? 'text-navy-200' : 'text-gray-500')}>
              {subtitle || pluralize(cameras.length, 'camera')}
            </p>
          </div>
          {inactive && <StatusBadge tone="neutral">Inactive</StatusBadge>}
        </div>

        <div
          className={cn(
            'mt-5 flex items-center justify-between gap-3 border-t pt-4 text-sm',
            featured ? 'border-white/10' : 'border-gray-100',
          )}
        >
          {enabled.length === 0 ? (
            <span className={featured ? 'text-navy-300' : 'text-gray-500'}>Nothing to watch yet</span>
          ) : (
            <StatusBadge tone={online === enabled.length ? 'success' : online === 0 ? 'danger' : 'warning'}>
              {online}/{enabled.length} online
            </StatusBadge>
          )}
          <span
            className={cn(
              'inline-flex items-center gap-1.5 font-medium transition-colors',
              featured ? 'text-marigold-400' : 'text-navy-900 group-hover:text-navy-600',
            )}
          >
            Open wall
            <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" aria-hidden />
          </span>
        </div>
      </div>
    </Link>
  )
}
