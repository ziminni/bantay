/**
 * Persons & Enrollment — /api/v1/persons
 */
import { client, cleanParams } from './client'
import type {
  EnrollmentResult,
  FaceEmbeddingRead,
  Page,
  PersonCreate,
  PersonListParams,
  PersonRead,
  PersonUpdate,
} from './types'

/** GET /persons */
export async function listPersons(params: PersonListParams = {}): Promise<Page<PersonRead>> {
  const { data } = await client.get<Page<PersonRead>>('/persons', { params: cleanParams(params) })
  return data
}

/** GET /persons/{id} */
export async function getPerson(id: number): Promise<PersonRead> {
  const { data } = await client.get<PersonRead>(`/persons/${id}`)
  return data
}

/** POST /persons */
export async function createPerson(payload: PersonCreate): Promise<PersonRead> {
  const { data } = await client.post<PersonRead>('/persons', payload)
  return data
}

/** PATCH /persons/{id} */
export async function updatePerson(id: number, payload: PersonUpdate): Promise<PersonRead> {
  const { data } = await client.patch<PersonRead>(`/persons/${id}`, payload)
  return data
}

/**
 * DELETE /persons/{id}
 * Erases the person and their face data. Past entries are kept, without the person.
 */
export async function deletePerson(id: number): Promise<void> {
  await client.delete(`/persons/${id}`)
}

/** GET /persons/{id}/faces */
export async function listFaces(personId: number): Promise<FaceEmbeddingRead[]> {
  const { data } = await client.get<FaceEmbeddingRead[]>(`/persons/${personId}/faces`)
  return data
}

/**
 * POST /persons/{id}/faces  (multipart/form-data, field "files")
 *
 * The backend rejects a photo with no face, with several faces, or with a
 * low-quality face, and returns the reason for each rejected file. Accepted
 * photos become embeddings and are discarded; no image is stored.
 */
export async function enrollFaces(personId: number, files: File[]): Promise<EnrollmentResult> {
  const form = new FormData()
  files.forEach((file) => form.append('files', file))
  const { data } = await client.post<EnrollmentResult>(`/persons/${personId}/faces`, form)
  return data
}

/** DELETE /persons/{id}/faces/{embedding_id} */
export async function deleteFace(personId: number, embeddingId: number): Promise<void> {
  await client.delete(`/persons/${personId}/faces/${embeddingId}`)
}
