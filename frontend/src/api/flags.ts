/**
 * Behaviour flags — /api/v1/flags
 *
 * Real backend API client for behaviour flags, review workflows,
 * and live alert badge notifications.
 */
import { client, cleanParams } from './client'
import type {
  FlagCounts,
  FlagListParams,
  FlagRead,
  FlagReview,
} from './types'

const listeners = new Set<() => void>()

/** Re-render anything that shows flag counts (sidebar badge, alert bell). */
export function subscribeFlags(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}
const notify = () => listeners.forEach((l) => l())

/** GET /flags?status=&type=&lab_id= — newest first. */
export async function listFlags(params: FlagListParams = {}): Promise<FlagRead[]> {
  const { data } = await client.get<FlagRead[]>('/flags', { params: cleanParams(params) })
  return data
}

/** GET /flags/{id} */
export async function getFlag(id: number): Promise<FlagRead> {
  const { data } = await client.get<FlagRead>(`/flags/${id}`)
  return data
}

/** GET /flags/counts?lab_id= */
export async function getFlagCounts(params: { lab_id?: number } = {}): Promise<FlagCounts> {
  const { data } = await client.get<FlagCounts>('/flags/counts', { params: cleanParams(params) })
  return data
}

/** PATCH /flags/{id} — confirm or dismiss; the backend also writes the audit log. */
export async function reviewFlag(id: number, review: FlagReview): Promise<FlagRead> {
  const { data } = await client.patch<FlagRead>(`/flags/${id}`, review)
  notify()
  return data
}

/** Put a reviewed flag back in the queue (undo). */
export async function reopenFlag(id: number): Promise<FlagRead> {
  const { data } = await client.post<FlagRead>(`/flags/${id}/reopen`)
  notify()
  return data
}
