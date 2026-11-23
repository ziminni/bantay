import {
  ChevronLeft,
  ChevronRight,
  Grid2x2,
  Grid3x3,
  LayoutGrid,
  Maximize,
  Minimize,
  Pause,
  Play,
  Square,
  type LucideIcon,
} from 'lucide-react'
import { useEffect, useState, type ReactNode } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { listCameras } from '@/api/cameras'
import { getLab } from '@/api/labs'
import { PageHeader } from '@/components/layout/PageHeader'
import { ButtonLink } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { ErrorState } from '@/components/ui/ErrorState'
import { LoadingState } from '@/components/ui/LoadingState'
import { Section } from '@/components/ui/Section'
import { TIME_ZONE } from '@/config'
import { useAsync } from '@/hooks/useAsync'
import { useFullscreen } from '@/hooks/useFullscreen'
import { useNow } from '@/hooks/useNow'
import { cn } from '@/lib/cn'
import { pluralize } from '@/lib/format'
import { WallTile } from './components/WallTile'

type Layout = 'auto' | '1' | '4' | '9' | '16'

const LAYOUTS: Array<{ value: Exclude<Layout, 'auto'>; label: string; icon: LucideIcon }> = [
  { value: '1', label: 'One camera', icon: Square },
  { value: '4', label: '2 by 2', icon: Grid2x2 },
  { value: '9', label: '3 by 3', icon: Grid3x3 },
  { value: '16', label: '4 by 4', icon: LayoutGrid },
]

/** How long each page stays up when cycling, like a DVR's sequence mode. */
const CYCLE_MS = 10_000

const dateFmt = new Intl.DateTimeFormat('en-CA', { timeZone: TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit' })
const timeFmt = new Intl.DateTimeFormat('en-GB', { timeZone: TIME_ZONE, hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })

function slotsFor(layout: Layout, count: number): number {
  if (layout !== 'auto') return Number(layout)
  if (count <= 1) return 1
  if (count <= 4) return 4
  if (count <= 9) return 9
  return 16
}

/**
 * The camera wall for one lab (or every lab): all its cameras in a grid, with
 * a channel number, name and clock on each, like a CCTV monitor. Click a
 * camera to focus on it; the whole wall can go full screen.
 */
export function LabWallPage() {
  const { labId = 'all' } = useParams()
  const all = labId === 'all'
  const [params, setParams] = useSearchParams()
  const layout = (params.get('grid') as Layout | null) ?? 'auto'

  const lab = useAsync(() => (all ? Promise.resolve(null) : getLab(Number(labId))), [labId])
  const cams = useAsync(() => listCameras(all ? {} : { lab_id: Number(labId) }), [labId], { refreshInterval: 15_000 })
  const cameras = (cams.data ?? []).filter((c) => c.enabled)
  const hidden = (cams.data?.length ?? 0) - cameras.length

  const [focusId, setFocusId] = useState<number | null>(null)
  const [page, setPage] = useState(0)
  const [cycling, setCycling] = useState(false)
  const { ref, isFullscreen, supported, toggle } = useFullscreen<HTMLDivElement>()
  const now = useNow(1000)
  const clock = `${dateFmt.format(now)} ${timeFmt.format(now)}`

  const focused = cameras.find((c) => c.id === focusId) ?? null
  const slots = focused ? 1 : slotsFor(layout, cameras.length)
  const cols = Math.sqrt(slots)
  const pages = Math.max(1, Math.ceil(cameras.length / slots))
  const current = Math.min(page, pages - 1)
  const shown = focused ? [focused] : cameras.slice(current * slots, current * slots + slots)
  const cells = focused ? shown : [...shown, ...Array<null>(slots - shown.length).fill(null)]
  const online = cameras.filter((c) => c.status === 'ONLINE').length

  // Sequence mode: step through the pages on a timer.
  useEffect(() => {
    if (!cycling || pages <= 1 || focused) return
    const timer = setInterval(() => setPage((p) => (p + 1) % pages), CYCLE_MS)
    return () => clearInterval(timer)
  }, [cycling, pages, focused])

  const setLayout = (value: Layout) => {
    setFocusId(null)
    setPage(0)
    setParams(value === 'auto' ? {} : { grid: value }, { replace: true })
  }

  const title = all ? 'All labs' : (lab.data?.name ?? 'Camera Wall')

  if (!all && lab.error) {
    return (
      <Section>
        <ErrorState error={lab.error} onRetry={lab.reload} />
      </Section>
    )
  }

  return (
    <>
      <PageHeader
        back={{ to: '/wall', label: 'Camera Wall' }}
        title={title}
        description={
          all
            ? 'Every camera in every lab.'
            : [lab.data?.room, 'Click a camera to focus on it; double-click the wall to go full screen.'].filter(Boolean).join(' · ')
        }
      />

      {cams.loading && !cams.data ? (
        <LoadingState label="Connecting to the cameras…" />
      ) : cams.error && !cams.data ? (
        <Section>
          <ErrorState error={cams.error} onRetry={cams.reload} />
        </Section>
      ) : cameras.length === 0 ? (
        <Section>
          <EmptyState
            title="No cameras to show"
            description={hidden > 0 ? `${pluralize(hidden, 'camera')} here ${hidden === 1 ? 'is' : 'are'} disabled.` : 'Add a camera to this lab first.'}
            action={!all ? <ButtonLink to={`/labs/${labId}`}>Manage this lab&apos;s cameras</ButtonLink> : undefined}
          />
        </Section>
      ) : (
        <div
          ref={ref}
          onDoubleClick={(e) => {
            if (supported && e.target === e.currentTarget) void toggle()
          }}
          className={cn(
            'flex flex-col overflow-hidden bg-navy-900 shadow-raised ring-1 ring-navy-950',
            isFullscreen ? 'h-screen w-screen' : 'rounded-2xl',
          )}
        >
          {/* Control bar */}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-white/10 px-4 py-3 text-cream">
            <div className="flex min-w-0 items-center gap-3">
              <span className="relative flex size-2.5" aria-hidden>
                {online > 0 && <span className="absolute inline-flex size-full animate-ping rounded-full bg-red-500 opacity-60" />}
                <span className={cn('relative inline-flex size-2.5 rounded-full', online > 0 ? 'bg-red-500' : 'bg-navy-400')} />
              </span>
              <span className="truncate font-display font-semibold">{title}</span>
              <span className="hidden font-mono text-xs text-navy-200 sm:inline">
                {online}/{cameras.length} ONLINE
              </span>
            </div>

            <div className="ml-auto flex flex-wrap items-center gap-2">
              {focused ? (
                <WallButton onClick={() => setFocusId(null)} label="Back to the wall" icon={Grid2x2}>
                  Back to wall
                </WallButton>
              ) : (
                <div role="radiogroup" aria-label="Layout" className="flex rounded-lg bg-white/5 p-0.5 ring-1 ring-white/10">
                  {LAYOUTS.map((l) => {
                    const active = slots === Number(l.value)
                    return (
                      <button
                        key={l.value}
                        type="button"
                        role="radio"
                        aria-checked={active}
                        aria-label={l.label}
                        title={l.label}
                        onClick={() => setLayout(l.value)}
                        className={cn(
                          'flex size-8 items-center justify-center rounded-md transition-colors',
                          active ? 'bg-marigold-400 text-navy-950' : 'text-navy-200 hover:bg-white/10 hover:text-cream',
                        )}
                      >
                        <l.icon className="size-4" aria-hidden />
                      </button>
                    )
                  })}
                </div>
              )}

              {!focused && pages > 1 && (
                <div className="flex items-center gap-1 rounded-lg bg-white/5 p-0.5 ring-1 ring-white/10">
                  <IconButton label="Previous page" onClick={() => setPage((current - 1 + pages) % pages)} icon={ChevronLeft} />
                  <span className="px-1 font-mono text-xs tabular-nums text-navy-100">
                    {current + 1}/{pages}
                  </span>
                  <IconButton label="Next page" onClick={() => setPage((current + 1) % pages)} icon={ChevronRight} />
                  <IconButton
                    label={cycling ? 'Stop cycling' : `Cycle pages every ${CYCLE_MS / 1000} seconds`}
                    onClick={() => setCycling((v) => !v)}
                    icon={cycling ? Pause : Play}
                    active={cycling}
                  />
                </div>
              )}

              {supported && (
                <WallButton onClick={() => void toggle()} label={isFullscreen ? 'Exit full screen' : 'Full screen'} icon={isFullscreen ? Minimize : Maximize}>
                  <span className="hidden sm:inline">{isFullscreen ? 'Exit full screen' : 'Full screen'}</span>
                </WallButton>
              )}
            </div>
          </div>

          {/* The wall */}
          <div
            className={cn('grid gap-1.5 p-1.5', isFullscreen && 'min-h-0 flex-1')}
            style={{
              gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
              gridTemplateRows: isFullscreen ? `repeat(${cols}, minmax(0, 1fr))` : undefined,
            }}
          >
            {cells.map((cam, i) => (
              <WallTile
                key={cam?.id ?? `empty-${i}`}
                camera={cam}
                channel={focused ? cameras.indexOf(focused) + 1 : current * slots + i + 1}
                clock={clock}
                fill={isFullscreen}
                showLab={all}
                selected={Boolean(focused)}
                onSelect={cam ? () => setFocusId(focused ? null : cam.id) : undefined}
              />
            ))}
          </div>

          {hidden > 0 && !isFullscreen && (
            <p className="border-t border-white/10 px-4 py-2 text-xs text-navy-300">
              {pluralize(hidden, 'disabled camera')} not shown.
            </p>
          )}
        </div>
      )}
    </>
  )
}

function WallButton({
  onClick,
  label,
  icon: Icon,
  children,
}: {
  onClick: () => void
  label: string
  icon: LucideIcon
  children: ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className="inline-flex h-9 items-center gap-2 rounded-lg bg-white/5 px-3 text-sm font-medium text-cream ring-1 ring-white/10 transition-colors hover:bg-white/10"
    >
      <Icon className="size-4" aria-hidden />
      {children}
    </button>
  )
}

function IconButton({ label, onClick, icon: Icon, active = false }: { label: string; onClick: () => void; icon: LucideIcon; active?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      aria-pressed={active || undefined}
      className={cn(
        'flex size-8 items-center justify-center rounded-md transition-colors',
        active ? 'bg-marigold-400 text-navy-950' : 'text-navy-200 hover:bg-white/10 hover:text-cream',
      )}
    >
      <Icon className="size-4" aria-hidden />
    </button>
  )
}
