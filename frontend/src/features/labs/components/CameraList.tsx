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
          <Button variant="primary" onClick={onAdd}>
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
    <li className="space-y-3 px-5 py-4">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-medium text-gray-900">{camera.name}</h3>
            <CameraStatusBadge status={camera.status} />
          </div>
          <p className="text-sm text-gray-500">
            {CAMERA_ROLE_SHORT[camera.role]} camera
            {camera.status !== 'DISABLED' && ` · Last picture ${formatRelative(camera.last_seen_at)}`}
          </p>
          <code className="block truncate text-xs text-gray-500" title={camera.rtsp_url ?? ''}>
            {camera.rtsp_url}
          </code>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          {camera.enabled && camera.status !== 'ONLINE' && (
            <Button size="sm" onClick={restart} loading={restarting}>
              Restart
            </Button>
          )}
          <Button size="sm" onClick={test} loading={testing} disabled={!camera.enabled}>
            Test connection
          </Button>
          <Button size="sm" onClick={onEdit}>
            Edit
          </Button>
        </div>
      </div>

      {camera.last_error && camera.status === 'OFFLINE' && !result && (
        <p className="text-sm text-gray-700">Last error: {camera.last_error}</p>
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
