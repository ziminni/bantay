import { AlertCircle, DoorOpen, Monitor, Pencil, Plug, Plus, RotateCw, Shapes } from 'lucide-react'
import { useState } from 'react'
import { restartCamera, testCamera } from '@/api/cameras'
import { errorMessage } from '@/api/errors'
import type { CameraRead, CameraTestResult } from '@/api/types'
import { CameraStatusBadge } from '@/components/common/badges'
import { Alert } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { useToast } from '@/components/ui/useToast'
import { CAMERA_ROLE_SHORT } from '@/lib/constants'
import { formatRelative } from '@/lib/format'
import { ZoneSketcherModal } from './ZoneSketcherModal'

interface CameraListProps {
  cameras: CameraRead[]
  onEdit: (camera: CameraRead) => void
  onAdd: () => void
  onChanged: () => void
}

/** The cameras of one lab, each with a connection test. */
export function CameraList({ cameras, onEdit, onAdd, onChanged }: CameraListProps) {
  if (cameras.length === 0) {
    return (
      <EmptyState
        title="No cameras in this lab"
        description="Add the camera at the lab entrance so Bantay can log who walks in."
        action={
          <Button variant="primary" onClick={onAdd} icon={<Plus />}>
            Add camera
          </Button>
        }
      />
    )
  }

  return (
    <ul className="divide-y divide-gray-100">
      {cameras.map((c) => (
        <CameraRow key={c.id} camera={c} onEdit={() => onEdit(c)} onChanged={onChanged} />
      ))}
    </ul>
  )
}

function CameraRow({ camera, onEdit, onChanged }: { camera: CameraRead; onEdit: () => void; onChanged: () => void }) {
  const [testing, setTesting] = useState(false)
  const [restarting, setRestarting] = useState(false)
  const [sketching, setSketching] = useState(false)
  const [result, setResult] = useState<CameraTestResult | null>(null)
  const toast = useToast()

  const test = async () => {
    setTesting(true)
    setResult(null)
    try {
      setResult(await testCamera(camera.id))
    } catch (err) {
      setResult({ ok: false, camera_id: camera.id, width: null, height: null, elapsed_ms: null, detail: errorMessage(err) })
    } finally {
      setTesting(false)
    }
  }

  const restart = async () => {
    setRestarting(true)
    try {
      await restartCamera(camera.id)
      toast.success(`${camera.name} restarted.`)
      onChanged()
    } catch (err) {
      toast.error(errorMessage(err))
    } finally {
      setRestarting(false)
    }
  }

  return (
    <li className="space-y-3 px-5 py-5 sm:px-6">
      <div className="flex flex-col gap-4">
        <div className="flex min-w-0 items-start gap-4">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-navy-900 text-marigold-400">
            {camera.role === 'ENTRY' ? <DoorOpen className="size-5" aria-hidden /> : <Monitor className="size-5" aria-hidden />}
          </span>
          <div className="min-w-0 space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="font-display font-semibold text-navy-900">{camera.name}</h3>
              <CameraStatusBadge status={camera.status} />
            </div>
            <p className="text-sm text-gray-500">
              {CAMERA_ROLE_SHORT[camera.role]} camera
              {camera.status !== 'DISABLED' && ` · Last picture ${formatRelative(camera.last_seen_at)}`}
            </p>
            <code
              className="inline-block max-w-full truncate rounded-md bg-gray-100 px-2 py-0.5 font-mono text-xs text-gray-600"
              title={camera.rtsp_url ?? ''}
            >
              {camera.rtsp_url}
            </code>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 sm:pl-15">
          {camera.enabled && camera.status !== 'ONLINE' && (
            <Button size="sm" onClick={restart} loading={restarting} icon={<RotateCw />}>
              Restart
            </Button>
          )}
          <Button size="sm" onClick={test} loading={testing} disabled={!camera.enabled} icon={<Plug />}>
            Test connection
          </Button>
          <Button size="sm" onClick={() => setSketching(true)} icon={<Shapes />}>
            Sketch Zones{camera.zones && camera.zones.length > 0 ? ` (${camera.zones.length})` : ''}
          </Button>
          <Button size="sm" onClick={onEdit} icon={<Pencil />}>
            Edit
          </Button>
        </div>
      </div>

      <ZoneSketcherModal
        open={sketching}
        camera={camera}
        onClose={() => setSketching(false)}
        onSaved={onChanged}
      />

      {camera.last_error && camera.status === 'OFFLINE' && !result && (
        <p className="flex items-center gap-2 text-sm text-red-700 sm:pl-15">
          <AlertCircle className="size-4 shrink-0" aria-hidden />
          Last error: {camera.last_error}
        </p>
      )}

      {result && (
        <Alert
          tone={result.ok ? 'success' : 'error'}
          title={result.ok ? 'Connected' : 'Could not connect'}
          action={
            <Button size="sm" variant="ghost" onClick={() => setResult(null)}>
              Dismiss
            </Button>
          }
        >
          {result.detail}
          {result.ok && result.width && ` ${result.width}×${result.height}, ${Math.round(result.elapsed_ms ?? 0)} ms.`}
          {!result.ok && ' Check that the camera is on, on the same network, and that the URL and password are right.'}
        </Alert>
      )}
    </li>
  )
}
