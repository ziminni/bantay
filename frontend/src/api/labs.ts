/**
 * Laboratories — /api/v1/labs
 */
import { client, cleanParams } from './client'
import type { LabCreate, LabRead, LabUpdate } from './types'

/** GET /labs?active= */
export async function listLabs(params: { active?: boolean } = {}): Promise<LabRead[]> {
  const { data } = await client.get<LabRead[]>('/labs', { params: cleanParams(params) })
  return data
}

/** GET /labs/{id} */
export async function getLab(id: number): Promise<LabRead> {
  const { data } = await client.get<LabRead>(`/labs/${id}`)
  return data
}

/** POST /labs — threshold and cooldown fall back to the backend defaults when omitted. */
export async function createLab(payload: LabCreate): Promise<LabRead> {
  const { data } = await client.post<LabRead>('/labs', payload)
  return data
}

/** PATCH /labs/{id} */
export async function updateLab(id: number, payload: LabUpdate): Promise<LabRead> {
  const { data } = await client.patch<LabRead>(`/labs/${id}`, payload)
  return data
}

/** DELETE /labs/{id} — refused when entry logs reference the lab. */
export async function deleteLab(id: number): Promise<void> {
  await client.delete(`/labs/${id}`)
}
