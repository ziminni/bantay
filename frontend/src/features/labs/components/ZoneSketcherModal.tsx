import { Check, DoorOpen, Monitor, ShieldAlert, Trash2 } from 'lucide-react'
import { useRef, useState, type MouseEvent } from 'react'
import { streamUrl, updateCameraZones } from '@/api/cameras'
import { errorMessage } from '@/api/errors'
import type { CameraRead, CameraZone, ZoneKind } from '@/api/types'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { useToast } from '@/components/ui/useToast'
import { cn } from '@/lib/cn'

interface ZoneSketcherModalProps {
  open: boolean
  camera: CameraRead | null
  onClose: () => void
  onSaved: () => void
}

const W = 640
const H = 360

const KIND_CONFIG: Record<
  ZoneKind,
  { label: string; icon: typeof Monitor; color: string; fill: string; stroke: string }
> = {
  door: { label: 'Door', icon: DoorOpen, color: 'text-amber-400', fill: 'rgba(246, 192, 94, 0.25)', stroke: '#f6c05e' },
  workstation: {
    label: 'Computer / Workstation',
    icon: Monitor,
    color: 'text-sky-300',
    fill: 'rgba(141, 162, 184, 0.25)',
    stroke: '#8da2b8',
  },
  restricted: {
    label: 'Instructor PC / Restricted',
    icon: ShieldAlert,
    color: 'text-rose-400',
    fill: 'rgba(248, 113, 113, 0.25)',
    stroke: '#f87171',
  },
}

export function ZoneSketcherModal({ open, camera, onClose, onSaved }: ZoneSketcherModalProps) {
  if (!camera) return null

  const toast = useToast()
  const [zones, setZones] = useState<CameraZone[]>(() => camera.zones ?? [])
  const [selectedKind, setSelectedKind] = useState<ZoneKind>('workstation')
  const [customName, setCustomName] = useState('Computer 1')
  const [saving, setSaving] = useState(false)
  const [activeHoverIdx, setActiveHoverIdx] = useState<number | null>(null)

  // Drawing state
  const svgRef = useRef<SVGSVGElement>(null)
  const [drawing, setDrawing] = useState<{ startX: number; startY: number; currX: number; currY: number } | null>(null)

  const getCoordinates = (e: MouseEvent<SVGSVGElement>) => {
    const svg = svgRef.current
    if (!svg) return { x: 0, y: 0 }
    const rect = svg.getBoundingClientRect()
    const x = Math.max(0, Math.min(W, Math.round(((e.clientX - rect.left) / rect.width) * W)))
    const y = Math.max(0, Math.min(H, Math.round(((e.clientY - rect.top) / rect.height) * H)))
    return { x, y }
  }

  const handleMouseDown = (e: MouseEvent<SVGSVGElement>) => {
    if (e.button !== 0) return
    const { x, y } = getCoordinates(e)
    setDrawing({ startX: x, startY: y, currX: x, currY: y })
  }

  const handleMouseMove = (e: MouseEvent<SVGSVGElement>) => {
    if (!drawing) return
    const { x, y } = getCoordinates(e)
    setDrawing((prev) => (prev ? { ...prev, currX: x, currY: y } : null))
  }

  const handleMouseUp = () => {
    if (!drawing) return
    const x = Math.min(drawing.startX, drawing.currX)
    const y = Math.min(drawing.startY, drawing.currY)
    const w = Math.abs(drawing.currX - drawing.startX)
    const h = Math.abs(drawing.currY - drawing.startY)
    setDrawing(null)

    // Ignore tiny accidental clicks (< 15px)
    if (w < 15 || h < 15) return

    const newZone: CameraZone = {
      name: customName.trim() || `${KIND_CONFIG[selectedKind].label} ${zones.length + 1}`,
      kind: selectedKind,
      x,
      y,
      w,
      h,
    }

    const updated = [...zones, newZone]
    setZones(updated)

    // Auto-increment computer name if applicable
    if (selectedKind === 'workstation') {
      const match = customName.match(/^Computer\s*(\d+)$/i)
      if (match) {
        setCustomName(`Computer ${parseInt(match[1], 10) + 1}`)
      }
    }
  }

  const removeZone = (index: number) => {
    setZones((prev) => prev.filter((_, i) => i !== index))
  }

  const clearAll = () => {
    if (confirm('Clear all sketched zones for this camera?')) {
      setZones([])
    }
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      await updateCameraZones(camera.id, zones)
      toast.success(`Saved ${zones.length} zone(s) for ${camera.name}.`)
      onSaved()
      onClose()
    } catch (err) {
      toast.error(errorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  const selectPreset = (kind: ZoneKind, name: string) => {
    setSelectedKind(kind)
    setCustomName(name)
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="2xl"
      title={`Sketch Detection Zones — ${camera.name}`}
      description="Click and drag on the camera view to sketch the door, workstations, and instructor PC."
      footer={
        <div className="flex w-full items-center justify-between">
          <Button variant="ghost" size="sm" onClick={clearAll} disabled={zones.length === 0} icon={<Trash2 />}>
            Clear all
          </Button>
          <div className="flex items-center gap-2">
            <Button onClick={onClose} disabled={saving}>
              Cancel
            </Button>
            <Button variant="primary" onClick={handleSave} loading={saving} icon={<Check />}>
              Save {zones.length} Zone{zones.length === 1 ? '' : 's'}
            </Button>
          </div>
        </div>
      }
    >
      <div className="space-y-4">
        {/* Preset Toolbar */}
        <div className="flex flex-wrap items-center gap-2 rounded-xl bg-gray-50 p-2.5 ring-1 ring-gray-200/80">
          <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">Sketching Tool:</span>

          <button
            type="button"
            onClick={() => selectPreset('door', 'Door')}
            className={cn(
              'flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-all',
              selectedKind === 'door'
                ? 'border-amber-400 bg-amber-50 text-amber-900 shadow-sm ring-1 ring-amber-400'
                : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300',
            )}
          >
            <DoorOpen className="size-3.5 text-amber-500" />
            Door
          </button>

          <button
            type="button"
            onClick={() => selectPreset('workstation', `Computer ${zones.filter((z) => z.kind === 'workstation').length + 1}`)}
            className={cn(
              'flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-all',
              selectedKind === 'workstation'
                ? 'border-sky-400 bg-sky-50 text-sky-900 shadow-sm ring-1 ring-sky-400'
                : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300',
            )}
          >
            <Monitor className="size-3.5 text-sky-500" />
            Computer / Workstation
          </button>

          <button
            type="button"
            onClick={() => selectPreset('restricted', 'Instructor PC')}
            className={cn(
              'flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-all',
              selectedKind === 'restricted'
                ? 'border-rose-400 bg-rose-50 text-rose-900 shadow-sm ring-1 ring-rose-400'
                : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300',
            )}
          >
            <ShieldAlert className="size-3.5 text-rose-500" />
            Instructor PC
          </button>

          <div className="ml-auto flex items-center gap-2">
            <label htmlFor="zone-label" className="text-xs font-medium text-gray-600">
              Label:
            </label>
            <input
              id="zone-label"
              type="text"
              value={customName}
              onChange={(e) => setCustomName(e.target.value)}
              placeholder="e.g. Computer 1"
              className="h-8 w-32 rounded-lg border border-gray-300 bg-white px-2.5 text-xs text-navy-900 shadow-xs focus:border-navy-900 focus:outline-hidden"
            />
          </div>
        </div>

        {/* Canvas & Sidebar */}
        <div className="grid gap-4 lg:grid-cols-[1fr_220px]">
          {/* Interactive Camera Sketch Canvas */}
          <div className="relative aspect-video w-full overflow-hidden rounded-xl bg-navy-950 shadow-inner ring-1 ring-navy-900 select-none">
            {/* Live Camera Stream Background */}
            <img
              src={streamUrl(camera.id)}
              alt="Camera feed for zone calibration"
              className="pointer-events-none absolute inset-0 h-full w-full object-cover"
              onError={(e) => {
                // If stream is offline or not supported, draw subtle dark blueprint
                e.currentTarget.style.display = 'none'
              }}
            />

            {/* Interactive SVG Drawing Overlay */}
            <svg
              ref={svgRef}
              viewBox={`0 0 ${W} ${H}`}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              className="absolute inset-0 h-full w-full cursor-crosshair"
            >
              <defs>
                <pattern id="sketch-grid" width="32" height="32" patternUnits="userSpaceOnUse">
                  <path d="M 32 0 L 0 0 0 32" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="1" />
                </pattern>
              </defs>
              <rect width={W} height={H} fill="url(#sketch-grid)" opacity={0.4} />

              {/* Saved Zones */}
              {zones.map((z, idx) => {
                const conf = KIND_CONFIG[z.kind]
                const hovered = activeHoverIdx === idx
                return (
                  <g key={`${z.name}-${idx}`}>
                    <rect
                      x={z.x}
                      y={z.y}
                      width={z.w}
                      height={z.h}
                      rx={5}
                      fill={conf.fill}
                      stroke={conf.stroke}
                      strokeWidth={hovered ? 3 : 1.75}
                      strokeDasharray={hovered ? undefined : '5 4'}
                    />
                    <g transform={`translate(${z.x + 4}, ${z.y + 16})`}>
                      <rect
                        x="-2"
                        y="-12"
                        width={z.name.length * 7.5 + 14}
                        height={16}
                        rx={3}
                        fill="rgba(7, 21, 38, 0.85)"
                      />
                      <text
                        x="4"
                        y="0"
                        fill={conf.stroke}
                        fontSize={11}
                        fontWeight={700}
                        letterSpacing={0.5}
                        fontFamily="Inter Variable, sans-serif"
                      >
                        {z.name}
                      </text>
                    </g>
                  </g>
                )
              })}

              {/* In-progress Drag Box */}
              {drawing && (
                <rect
                  x={Math.min(drawing.startX, drawing.currX)}
                  y={Math.min(drawing.startY, drawing.currY)}
                  width={Math.abs(drawing.currX - drawing.startX)}
                  height={Math.abs(drawing.currY - drawing.startY)}
                  rx={5}
                  fill={KIND_CONFIG[selectedKind].fill}
                  stroke={KIND_CONFIG[selectedKind].stroke}
                  strokeWidth={2}
                  strokeDasharray="4 3"
                />
              )}
            </svg>

            {/* Instruction tooltip */}
            <div className="pointer-events-none absolute bottom-2 left-2 rounded bg-black/60 px-2 py-1 text-[11px] text-cream/80 backdrop-blur-xs font-mono">
              Drag to sketch {customName}
            </div>
          </div>

          {/* Zones List Sidebar */}
          <div className="flex flex-col rounded-xl border border-gray-200 bg-gray-50/70 p-3">
            <div className="mb-2 flex items-center justify-between border-b border-gray-200 pb-2">
              <span className="text-xs font-semibold text-navy-900">Sketched Zones ({zones.length})</span>
            </div>

            {zones.length === 0 ? (
              <p className="py-8 text-center text-xs text-gray-500">
                No zones sketched yet. Drag on the camera to sketch the door or computers.
              </p>
            ) : (
              <ul className="max-h-60 flex-1 space-y-1.5 overflow-y-auto pr-1">
                {zones.map((z, idx) => {
                  const conf = KIND_CONFIG[z.kind]
                  const Icon = conf.icon
                  return (
                    <li
                      key={idx}
                      onMouseEnter={() => setActiveHoverIdx(idx)}
                      onMouseLeave={() => setActiveHoverIdx(null)}
                      className="group flex items-center justify-between rounded-lg border border-gray-200/90 bg-white px-2.5 py-1.5 text-xs transition-colors hover:border-gray-300"
                    >
                      <div className="flex min-w-0 items-center gap-2">
                        <Icon className={cn('size-3.5 shrink-0', conf.color)} />
                        <span className="truncate font-medium text-navy-900" title={z.name}>
                          {z.name}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeZone(idx)}
                        className="ml-1 text-gray-400 opacity-60 transition-opacity hover:text-red-600 group-hover:opacity-100"
                        title="Delete zone"
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        </div>
      </div>
    </Modal>
  )
}
