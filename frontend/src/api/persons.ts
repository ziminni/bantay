/**
 * Persons & Enrollment — /api/v1/persons
 *
 * Mock implementation. The real call is written above each function.
 */
import { ACCEPTED_IMAGE_TYPES, MAX_ENROLLMENT_PHOTOS, MAX_UPLOAD_BYTES, MIN_ENROLLMENT_PHOTOS } from '@/lib/constants'
import { db, findPerson, nextId, toPersonRead } from '@/mocks/store'
import { fail, matchesQuery, nowIso, paginate, respond } from '@/mocks/util'
import type {
  EnrollmentResult,
  FaceEmbeddingRead,
  Page,
  PersonCreate,
  PersonListParams,
  PersonRead,
  PersonUpdate,
  RejectedPhoto,
} from './types'

/** GET /persons */
export async function listPersons(params: PersonListParams = {}): Promise<Page<PersonRead>> {
  const rows = db.persons
    .filter((p) => matchesQuery(params.q, p.full_name, p.id_number))
    .filter((p) => !params.person_type || p.person_type === params.person_type)
    .filter((p) => params.active === undefined || p.active === params.active)
    .filter((p) => !params.enrolled_only || db.faces.some((f) => f.person_id === p.id))
    .sort((a, b) => a.full_name.localeCompare(b.full_name))
    .map(toPersonRead)
  return respond(paginate(rows, params.page, params.size))
}

/** GET /persons/{id} */
export async function getPerson(id: number): Promise<PersonRead> {
  const p = findPerson(id) ?? fail(404, 'Person not found.')
  return respond(toPersonRead(p))
}

/** POST /persons */
export async function createPerson(payload: PersonCreate): Promise<PersonRead> {
  const id_number = payload.id_number.trim()
  if (db.persons.some((p) => p.id_number === id_number)) {
    fail(409, `A person with ID number ${id_number} is already enrolled.`)
  }
  const consent = payload.consent_given ?? false
  const row = {
    id: nextId('persons'),
    id_number,
    full_name: payload.full_name.trim(),
    person_type: payload.person_type ?? 'STUDENT',
    department: payload.department?.trim() || null,
    consent_given: consent,
    consent_signed_at: consent ? (payload.consent_signed_at ?? nowIso()) : null,
    active: true,
    created_at: nowIso(),
  }
  db.persons.push(row)
  return respond(toPersonRead(row))
}

/** PATCH /persons/{id} */
export async function updatePerson(id: number, payload: PersonUpdate): Promise<PersonRead> {
  const p = findPerson(id) ?? fail(404, 'Person not found.')
  Object.assign(p, Object.fromEntries(Object.entries(payload).filter(([, v]) => v !== undefined)))
  if (payload.consent_given && !p.consent_signed_at) p.consent_signed_at = nowIso()
  if (payload.consent_given === false) p.consent_signed_at = null
  return respond(toPersonRead(p))
}

/**
 * DELETE /persons/{id}
 * Erases the person and their face data. Past entries are kept, without the person.
 */
export async function deletePerson(id: number): Promise<void> {
  if (!findPerson(id)) fail(404, 'Person not found.')
  db.persons = db.persons.filter((p) => p.id !== id)
  db.faces = db.faces.filter((f) => f.person_id !== id)
  db.entries.forEach((e) => {
    if (e.person_id === id) e.person_id = null
  })
  return respond(undefined)
}

/** GET /persons/{id}/faces */
export async function listFaces(personId: number): Promise<FaceEmbeddingRead[]> {
  if (!findPerson(personId)) fail(404, 'Person not found.')
  return respond(db.faces.filter((f) => f.person_id === personId))
}

/**
 * POST /persons/{id}/faces  (multipart/form-data, field "files")
 *
 * Real call:
 *   const form = new FormData(); files.forEach((f) => form.append('files', f))
 *   client.post(`/persons/${personId}/faces`, form)
 *
 * The mock accepts any JPEG/PNG under 10 MB; a real backend also rejects photos
 * with no face, several faces, or a low-quality face.
 */
export async function enrollFaces(personId: number, files: File[]): Promise<EnrollmentResult> {
  const person = findPerson(personId) ?? fail(404, 'Person not found.')
  if (!person.consent_given) {
    fail(403, 'Consent has not been recorded for this person. Enrollment is consent-gated under RA 10173.')
  }
  if (files.length > MAX_ENROLLMENT_PHOTOS) {
    fail(400, `At most ${MAX_ENROLLMENT_PHOTOS} photos per upload.`)
  }

  const accepted: FaceEmbeddingRead[] = []
  const rejected: RejectedPhoto[] = []

  for (const file of files) {
    if (file.size === 0) {
      rejected.push({ filename: file.name, reason: 'The file is empty.' })
    } else if (file.size > MAX_UPLOAD_BYTES) {
      rejected.push({ filename: file.name, reason: 'The file is larger than 10 MB.' })
    } else if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) {
      rejected.push({ filename: file.name, reason: 'Not a readable image file.' })
    } else {
      const row = {
        id: nextId('faces'),
        person_id: personId,
        det_score: Math.round((0.75 + Math.random() * 0.24) * 1000) / 1000,
        source_filename: file.name,
        created_at: nowIso(),
      }
      db.faces.push(row)
      accepted.push(row)
    }
  }

  const total = db.faces.filter((f) => f.person_id === personId).length
  return respond(
    {
      person_id: personId,
      accepted,
      rejected,
      total_embeddings: total,
      meets_minimum: total >= MIN_ENROLLMENT_PHOTOS,
      note: 'Uploaded photos were converted to embeddings and discarded; no image was stored.',
    },
    900,
  )
}

/** DELETE /persons/{id}/faces/{embedding_id} */
export async function deleteFace(personId: number, embeddingId: number): Promise<void> {
  const exists = db.faces.some((f) => f.id === embeddingId && f.person_id === personId)
  if (!exists) fail(404, 'Embedding not found.')
  db.faces = db.faces.filter((f) => f.id !== embeddingId)
  return respond(undefined)
}
