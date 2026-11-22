/**
 * Cameras & Live View — /api/v1/cameras
 *
 * Mock implementation. The real call is written above each function.
 */
import { API_BASE_URL } from '@/config'
import { db, findCamera, findLab, nextId, toCameraRead } from '@/mocks/store'
import { fail, nowIso, respond } from '@/mocks/util'
import type { CameraCreate, CameraListParams, CameraRead, CameraTestResult, CameraUpdate } from './types'

/** GET /cameras?lab_id=&enabled= */
export async function listCameras(params: CameraListParams = {}): Promise<CameraRead[]> {
  const rows = db.cameras
    .filter((c) => params.lab_id === undefined || c.lab_id === params.lab_id)
    .filter((c) => params.enabled === undefined || c.enabled === params.enabled)
    .map(toCameraRead)
    .sort((a, b) => (a.lab_name ?? '').localeCompare(b.lab_name ?? '') || a.name.localeCompare(b.name))
  return respond(rows, 150)
}

/** GET /cameras/{id} */
export async function getCamera(id: number): Promise<CameraRead> {
  const cam = findCamera(id) ?? fail(404, 'Camera not found.')
  return respond(toCameraRead(cam))
}

/** POST /cameras */
export async function createCamera(payload: CameraCreate): Promise<CameraRead> {
  const lab = findLab(payload.lab_id) ?? fail(404, 'Laboratory not found.')
  const name = payload.name.trim()
  if (db.cameras.some((c) => c.lab_id === lab.id && c.name === name)) {
    fail(409, `Laboratory '${lab.name}' already has a camera named '${name}'.`)
  }
  const enabled = payload.enabled ?? true
  const row = {
    id: nextId('cameras'),
    lab_id: lab.id,
    name,
    role: payload.role ?? 'ENTRY',
    rtsp_url: payload.rtsp_url.trim(),
    enabled,
    status: enabled ? ('OFFLINE' as const) : ('DISABLED' as const),
    last_seen_at: null,
    last_error: null,
    created_at: nowIso(),
  }
  db.cameras.push(row)
  return respond(toCameraRead(row))
}

/**
 * PATCH /cameras/{id}
 * Omit rtsp_url to keep the stored one (the API only ever returns it masked).
 */
export async function updateCamera(id: number, payload: CameraUpdate): Promise<CameraRead> {
  const cam = findCamera(id) ?? fail(404, 'Camera not found.')
  const labId = payload.lab_id ?? cam.lab_id
  if (payload.lab_id !== undefined && !findLab(payload.lab_id)) fail(404, 'Laboratory not found.')
  const name = payload.name?.trim() ?? cam.name
  if (db.cameras.some((c) => c.id !== id && c.lab_id === labId && c.name === name)) {
    fail(409, 'That camera name is already used in this laboratory.')
  }
  Object.assign(cam, Object.fromEntries(Object.entries(payload).filter(([, v]) => v !== undefined)))
  if (payload.enabled === false) cam.status = 'DISABLED'
  if (payload.enabled === true && cam.status === 'DISABLED') cam.status = 'OFFLINE'
  return respond(toCameraRead(cam))
}

/** DELETE /cameras/{id} */
export async function deleteCamera(id: number): Promise<void> {
  if (!findCamera(id)) fail(404, 'Camera not found.')
  db.cameras = db.cameras.filter((c) => c.id !== id)
  db.entries.forEach((e) => {
    if (e.camera_id === id) e.camera_id = null
  })
  return respond(undefined)
}

/** POST /cameras/{id}/test — try to read one frame. */
export async function testCamera(id: number): Promise<CameraTestResult> {
  const cam = findCamera(id) ?? fail(404, 'Camera not found.')
  const ok = cam.status === 'ONLINE'
  return respond(
    ok
      ? { ok, camera_id: id, width: 1920, height: 1080, elapsed_ms: 412.6, detail: 'Read one frame successfully.' }
      : { ok, camera_id: id, width: null, height: null, elapsed_ms: null, detail: 'Could not open the stream.' },
    1200,
  )
}

/** POST /cameras/{id}/restart — restart the camera's worker. */
export async function restartCamera(id: number): Promise<CameraRead> {
  const cam = findCamera(id) ?? fail(404, 'Camera not found.')
  if (cam.enabled && cam.status === 'ONLINE') cam.last_seen_at = nowIso()
  return respond(toCameraRead(cam), 800)
}

/** URL of the MJPEG live view, usable directly as <img src>. */
export function streamUrl(id: number): string {
  return `${API_BASE_URL}/cameras/${id}/stream.mjpeg`
}
