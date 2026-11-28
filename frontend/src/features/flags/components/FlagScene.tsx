import { Pause, Play, ScanFace } from 'lucide-react'
import { useEffect, useState } from 'react'
import { snapshotUrl } from '@/api/entries'
import type { FlagRead } from '@/api/types'
import { cn } from '@/lib/cn'
import { formatDateTime } from '@/lib/format'

const CLIP_SECONDS = 6
const W = 640
const H = 360

type Point = [number, number]

interface Zone {
  name: string
  kind: 'workstation' | 'door' | 'restricted'
  x: number
  y: number
  w: number
  h: number
}

const ROOM_ZONES: Zone[] = [
  { name: 'Instructor PC', kind: 'restricted', x: 40, y: 36, w: 150, h: 96 },
  { name: 'Workstation 1', kind: 'workstation', x: 40, y: 220, w: 180, h: 110 },
  { name: 'Workstation 2', kind: 'workstation', x: 250, y: 220, w: 180, h: 110 },
  { name: 'Door', kind: 'door', x: 548, y: 40, w: 72, h: 290 },
]

const zoneColors: Record<Zone['kind'], string> = {
  workstation: '#8da2b8',
  door: '#f6c05e',
  restricted: '#f87171',
}

/**
 * Where the tracked person is at time t (0–6 s) for each kind of flag, and
 * how their limbs are posed. A stand-in for the real clip until the behaviour
 * worker saves one.
 */
function personAt(flag: FlagRead, t: number): { x: number; y: number; scale: number; stride: number; reach: number } {
  const p = t / CLIP_SECONDS
  switch (flag.type) {
    case 'RUNNING':
      return { x: 90 + p * 420, y: 180, scale: 1, stride: Math.sin(t * 11) * 1, reach: 0 }
    case 'EQUIPMENT_REMOVAL':
      return { x: 330 + p * 230, y: 200 - p * 20, scale: 1, stride: Math.sin(t * 6) * 0.5, reach: 0.4 }
    case 'UNAUTHORIZED_USE':
      return { x: 115 + Math.sin(t * 1.3) * 4, y: 150, scale: 1, stride: 0, reach: 1 }
    case 'UNKNOWN_PERSON':
      return { x: 300 + p * 40, y: 210, scale: 2.1, stride: Math.sin(t * 4) * 0.3, reach: 0 }
  }
}

/** A simplified 17-point pose (YOLOv8-pose order is not needed for a picture). */
function skeleton(x: number, y: number, s: number, stride: number, reach: number) {
  const k = (dx: number, dy: number): Point => [x + dx * s, y + dy * s]
  const head = k(0, -62)
  const neck = k(0, -48)
  const lSh = k(-12, -46)
  const rSh = k(12, -46)
  const lEl = k(-16 - reach * 6, -28 - reach * 6)
  const rEl = k(16 + reach * 6, -28 - reach * 6)
  const lWr = k(-14 + stride * 10 - reach * 2, -12 - reach * 16)
  const rWr = k(14 - stride * 10 + reach * 10, -12 - reach * 16)
  const lHip = k(-8, -8)
  const rHip = k(8, -8)
  const lKn = k(-8 - stride * 12, 14)
  const rKn = k(8 + stride * 12, 14)
  const lAn = k(-8 - stride * 20, 38)
  const rAn = k(8 + stride * 20, 38)
  const bones: Array<[Point, Point]> = [
    [neck, lSh], [neck, rSh], [lSh, lEl], [lEl, lWr], [rSh, rEl], [rEl, rWr],
    [lSh, lHip], [rSh, rHip], [lHip, rHip], [lHip, lKn], [lKn, lAn], [rHip, rKn], [rKn, rAn],
  ]
  const joints = [neck, lSh, rSh, lEl, rEl, lWr, rWr, lHip, rHip, lKn, rKn, lAn, rAn]
  return { head, bones, joints, rWr, box: { x: x - 34 * s, y: y - 78 * s, w: 68 * s, h: 122 * s } }
}

function Figure({ flag, t, ghost = false, firing }: { flag: FlagRead; t: number; ghost?: boolean; firing: boolean }) {
  const p = personAt(flag, t)
  const sk = skeleton(p.x, p.y, p.scale, p.stride, p.reach)
  const color = firing ? '#f2a93b' : '#e9e5dc'
  const showFace = flag.type === 'UNKNOWN_PERSON'
  return (
    <g opacity={ghost ? 0.18 : 1}>
      {sk.bones.map(([a, b], i) => (
        <line key={i} x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} stroke={color} strokeWidth={2.5 * Math.min(p.scale, 1.4)} strokeLinecap="round" />
      ))}
      <circle cx={sk.head[0]} cy={sk.head[1]} r={9 * p.scale} fill="none" stroke={color} strokeWidth={2.5} />
      {!ghost &&
        sk.joints.map(([jx, jy], i) => <circle key={i} cx={jx} cy={jy} r={2.6 * Math.min(p.scale, 1.4)} fill="#34d399" />)}
      {!ghost && flag.type === 'EQUIPMENT_REMOVAL' && (
        <g>
          <rect x={sk.rWr[0] - 2} y={sk.rWr[1] - 6} width={18} height={12} rx={3} fill="#f87171" />
          <text x={sk.rWr[0] + 20} y={sk.rWr[1] + 4} fill="#fecaca" fontSize={11} fontFamily="Inter Variable, sans-serif">
            {flag.evidence.object}
          </text>
        </g>
      )}
      {!ghost && !showFace && (
        <g>
          <rect {...sk.box} fill="none" stroke={color} strokeWidth={1.5} strokeDasharray="5 4" rx={4} />
          <rect x={sk.box.x} y={sk.box.y - 18} width={86} height={16} rx={3} fill={firing ? '#f2a93b' : '#0e2a47'} />
          <text x={sk.box.x + 6} y={sk.box.y - 6} fill={firing ? '#081b30' : '#f7f5f0'} fontSize={11} fontWeight={600} fontFamily="Inter Variable, sans-serif">
            person #{flag.evidence.track_id ?? '?'}
          </text>
        </g>
      )}
      {!ghost && showFace && (
        <g>
          <rect x={sk.head[0] - 30} y={sk.head[1] - 32} width={60} height={64} fill="none" stroke="#ffffff" strokeWidth={2} rx={4} />
          <rect x={sk.head[0] - 30} y={sk.head[1] - 54} width={112} height={18} rx={3} fill="#0e2a47" />
          <text x={sk.head[0] - 24} y={sk.head[1] - 41} fill="#f7f5f0" fontSize={11} fontWeight={600} fontFamily="Inter Variable, sans-serif">
            Unknown · {Math.round(flag.evidence.value * 100)}%
          </text>
        </g>
      )}
    </g>
  )
}

/**
 * The evidence viewer: snapshot or 6-second clip, with zones, the tracked
 * person's pose and the moment the rule fired marked on the timeline.
 *
 * Until the backend stores real snapshots and clips, the scene is drawn from
 * the flag's evidence so reviewers can learn the screen.
 */
export function FlagScene({ flag }: { flag: FlagRead }) {
  // Unknown person incidents: display the actual snapshot picture, not a clip
  if (flag.type === 'UNKNOWN_PERSON') {
    return (
      <div className="overflow-hidden rounded-2xl bg-navy-950 shadow-raised ring-1 ring-navy-900">
        <div className="relative aspect-video w-full overflow-hidden bg-black flex items-center justify-center">
          {flag.snapshot_path ? (
            <img
              src={snapshotUrl(flag.snapshot_path)}
              alt={`Snapshot of unknown face for flag #${flag.id}`}
              className="h-full w-full object-contain"
            />
          ) : (
            <div className="flex flex-col items-center justify-center gap-3 p-8 text-center text-navy-400">
              <div className="flex size-16 items-center justify-center rounded-full bg-white/5 ring-1 ring-white/10">
                <ScanFace className="size-8 stroke-[1.5] text-marigold-400" />
              </div>
              <div>
                <p className="text-sm font-semibold text-cream">Snapshot picture</p>
                <p className="text-xs text-navy-300">Face snapshot captured at entrance camera.</p>
              </div>
            </div>
          )}

          {/* Camera overlay burn-in */}
          <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between p-3 font-mono text-[11px] text-cream/90">
            <span className="rounded bg-black/60 px-2.5 py-1 backdrop-blur-sm">
              {(flag.camera_name ?? 'Entrance Camera').toUpperCase()} · {flag.lab_name} · SNAPSHOT
            </span>
            <span className="flex items-center gap-2">
              <span className="flex items-center gap-1.5 rounded bg-marigold-400 px-2 py-1 font-sans font-semibold text-navy-950">
                <span className="size-1.5 animate-ping rounded-full bg-navy-950" />
                UNKNOWN FACE DETECTED
              </span>
              <span className="rounded bg-black/60 px-2.5 py-1 backdrop-blur-sm">{formatDateTime(flag.occurred_at)}</span>
            </span>
          </div>
        </div>

        {/* Caption footer */}
        <div className="flex items-center justify-between border-t border-white/10 px-4 py-3 text-xs text-navy-200">
          <span className="flex items-center gap-2 font-mono">
            <span className="rounded bg-marigold-400/15 px-2 py-0.5 font-semibold text-marigold-400">SNAPSHOT PIC</span>
            <span>
              Best similarity: {Math.round(flag.evidence.value * 100)}% (threshold: {Math.round(flag.evidence.threshold * 100)}%)
            </span>
          </span>
          <span className="text-gray-400">{formatDateTime(flag.occurred_at)}</span>
        </div>
      </div>
    )
  }

  const [mode, setMode] = useState<'snapshot' | 'clip'>('snapshot')
  const [t, setT] = useState(flag.trigger_offset)
  const [playing, setPlaying] = useState(false)

  useEffect(() => {
    if (!playing) return
    const timer = setInterval(() => {
      setT((prev) => {
        const next = Math.round((prev + 0.1) * 10) / 10
        if (next >= CLIP_SECONDS) {
          setPlaying(false)
          return CLIP_SECONDS
        }
        return next
      })
    }, 100)
    return () => clearInterval(timer)
  }, [playing])

  const shownT = mode === 'snapshot' ? flag.trigger_offset : t
  const firing = shownT >= flag.trigger_offset && shownT <= flag.trigger_offset + 1.6
  const zones = flag.zones && flag.zones.length > 0 ? flag.zones : ROOM_ZONES
  const highlighted = flag.evidence.zone

  const play = () => {
    if (mode !== 'clip') setMode('clip')
    if (t >= CLIP_SECONDS) setT(0)
    setPlaying((v) => !v)
  }

  return (
    <div className="overflow-hidden rounded-2xl bg-navy-950 shadow-raised ring-1 ring-navy-900">
      <div className="relative">
        <svg viewBox={`0 0 ${W} ${H}`} className="block aspect-video w-full" role="img" aria-label={`Evidence for flag ${flag.id}`}>
          <defs>
            <pattern id="grid" width="32" height="32" patternUnits="userSpaceOnUse">
              <path d="M 32 0 L 0 0 0 32" fill="none" stroke="#173252" strokeWidth="1" />
            </pattern>
            <radialGradient id="vignette" cx="50%" cy="50%" r="75%">
              <stop offset="60%" stopColor="#091c31" stopOpacity="0" />
              <stop offset="100%" stopColor="#020a14" stopOpacity="0.85" />
            </radialGradient>
          </defs>
          <rect width={W} height={H} fill="#0b2138" />
          <rect width={W} height={H} fill="url(#grid)" />

          {zones.map((z) => {
            const hot = highlighted === z.name && firing
            return (
              <g key={z.name}>
                <rect
                  x={z.x}
                  y={z.y}
                  width={z.w}
                  height={z.h}
                  rx={6}
                  fill={zoneColors[z.kind]}
                  fillOpacity={hot ? 0.22 : 0.06}
                  stroke={zoneColors[z.kind]}
                  strokeOpacity={hot ? 1 : 0.6}
                  strokeWidth={hot ? 2 : 1.25}
                  strokeDasharray="6 5"
                />
                <text x={z.x + 8} y={z.y + 16} fill={zoneColors[z.kind]} fontSize={10} fontWeight={700} letterSpacing={1} fontFamily="Inter Variable, sans-serif">
                  {z.name.toUpperCase()}
                </text>
              </g>
            )
          })}

          {/* Motion trail for movement rules. */}
          {(flag.type === 'RUNNING' || flag.type === 'EQUIPMENT_REMOVAL') &&
            [0.9, 0.6, 0.3].map((d) => shownT - d >= 0 && <Figure key={d} flag={flag} t={shownT - d} ghost firing={false} />)}
          <Figure flag={flag} t={shownT} firing={firing} />

          <rect width={W} height={H} fill="url(#vignette)" pointerEvents="none" />
        </svg>

        {/* Camera overlay, like a CCTV burn-in. */}
        <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between p-3 font-mono text-[11px] text-cream/90">
          <span className="rounded bg-black/40 px-2 py-1 backdrop-blur-sm">
            {(flag.camera_name ?? 'Camera').toUpperCase()} · {flag.lab_name} · 5 FPS
          </span>
          <span className="flex items-center gap-2">
            {firing && (
              <span className="flex items-center gap-1.5 rounded bg-marigold-400 px-2 py-1 font-sans font-semibold text-navy-950">
                <span className="size-1.5 animate-ping rounded-full bg-navy-950" />
                RULE FIRED
              </span>
            )}
            <span className="rounded bg-black/40 px-2 py-1 backdrop-blur-sm">{formatDateTime(flag.occurred_at)}</span>
          </span>
        </div>
      </div>

      {/* Controls */}
      <div className="flex flex-wrap items-center gap-3 border-t border-white/10 px-3 py-2.5">
        <div className="flex rounded-lg bg-white/5 p-0.5 ring-1 ring-white/10" role="tablist" aria-label="Evidence">
          {(['snapshot', 'clip'] as const).map((m) => (
            <button
              key={m}
              type="button"
              role="tab"
              aria-selected={mode === m}
              onClick={() => {
                setMode(m)
                setPlaying(false)
                if (m === 'clip') setT(0)
              }}
              className={cn(
                'rounded-md px-3 py-1 text-xs font-medium transition-colors',
                mode === m ? 'bg-cream text-navy-900' : 'text-navy-200 hover:text-cream',
              )}
            >
              {m === 'snapshot' ? 'Snapshot' : '6-s clip'}
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={play}
          aria-label={playing ? 'Pause clip' : 'Play clip'}
          className="flex size-8 items-center justify-center rounded-full bg-marigold-400 text-navy-950 transition-colors hover:bg-marigold-300"
        >
          {playing ? <Pause className="size-4" /> : <Play className="ml-0.5 size-4" />}
        </button>

        <div className="relative min-w-40 flex-1">
          <input
            type="range"
            min={0}
            max={CLIP_SECONDS}
            step={0.1}
            value={shownT}
            onChange={(e) => {
              setMode('clip')
              setPlaying(false)
              setT(Number(e.target.value))
            }}
            aria-label="Clip position"
            className="w-full accent-marigold-400"
          />
          {/* Where the rule fired. */}
          <span
            aria-hidden
            title="Rule fired here"
            className="pointer-events-none absolute -top-1.5 h-2 w-0.5 rounded-full bg-marigold-400"
            style={{ left: `${(flag.trigger_offset / CLIP_SECONDS) * 100}%` }}
          />
        </div>
        <span className="font-mono text-xs text-navy-200 tabular-nums">
          {shownT.toFixed(1)} / {CLIP_SECONDS.toFixed(1)} s
        </span>
      </div>
    </div>
  )
}
