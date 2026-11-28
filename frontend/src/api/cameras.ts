/**
 * Cameras & Live View — /api/v1/cameras
 */
import { API_BASE_URL } from '@/config'
import { client, cleanParams } from './client'
import type { CameraCreate, CameraListParams, CameraRead, CameraTestResult, CameraUpdate, CameraZone } from './types'

/** GET /cameras?lab_id=&enabled= */
export async function listCameras(params: CameraListParams = {}): Promise<CameraRead[]> {
  const { data } = await client.get<CameraRead[]>('/cameras', { params: cleanParams(params) })
  return data
}

/** GET /cameras/{id} */
export async function getCamera(id: number): Promise<CameraRead> {
  const { data } = await client.get<CameraRead>(`/cameras/${id}`)
  return data
}

/** POST /cameras — the backend starts a worker for the camera when it is enabled. */
export async function createCamera(payload: CameraCreate): Promise<CameraRead> {
  const { data } = await client.post<CameraRead>('/cameras', payload)
  return data
}

/**
 * PATCH /cameras/{id}
 * Omit rtsp_url to keep the stored one (the API only ever returns it masked).
 * The backend restarts the camera's worker so the change takes effect at once.
 */
export async function updateCamera(id: number, payload: CameraUpdate): Promise<CameraRead> {
  const { data } = await client.patch<CameraRead>(`/cameras/${id}`, payload)
  return data
}

/** DELETE /cameras/{id} */
export async function deleteCamera(id: number): Promise<void> {
  await client.delete(`/cameras/${id}`)
}

/** POST /cameras/{id}/test — try to read one frame. */
export async function testCamera(id: number): Promise<CameraTestResult> {
  const { data } = await client.post<CameraTestResult>(`/cameras/${id}/test`)
  return data
}

/** POST /cameras/{id}/restart — restart the camera's worker. */
export async function restartCamera(id: number): Promise<CameraRead> {
  const { data } = await client.post<CameraRead>(`/cameras/${id}/restart`)
  return data
}

/** URL of the MJPEG live view, usable directly as <img src>. */
export function streamUrl(id: number): string {
  return `${API_BASE_URL}/cameras/${id}/stream.mjpeg`
}

/** PUT /cameras/{id}/zones — save the sketched detection zones for this camera. */
export async function updateCameraZones(id: number, zones: CameraZone[]): Promise<CameraRead> {
  const { data } = await client.put<CameraRead>(`/cameras/${id}/zones`, zones)
  return data
}
