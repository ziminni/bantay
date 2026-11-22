/**
 * Recognition testing — /api/v1/recognize and /api/v1/recognize/log
 *
 * Mock implementation. The mock has no face detector: it pretends there is one
 * face in the middle of the image and matches it to an enrolled person chosen
 * from the file's name and size.
 */
import { DEFAULT_MATCH_THRESHOLD } from '@/lib/constants'
import { db, findCamera, findLab } from '@/mocks/store'
import { fail, respond, seededRandom } from '@/mocks/util'
import { createEntry } from './entries'
import type { DetectedFaceRead, EntryDecision, RecognizeResult } from './types'

async function fakeFace(file: File, threshold: number): Promise<DetectedFaceRead> {
  let width = 640
  let height = 480
  try {
    const bitmap = await createImageBitmap(file)
    width = bitmap.width
    height = bitmap.height
    bitmap.close()
  } catch {
    fail(400, 'Not a readable image file.')
  }

  // The same photo always gives the same answer, like a real model would.
  let hash = file.size
  for (const ch of file.name) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0
  const rng = seededRandom(hash)

  const enrolled = db.persons.filter((p) => p.active && db.faces.some((f) => f.person_id === p.id))
  const person = enrolled.length ? rng.pick(enrolled) : undefined
  const similarity = Math.round((0.25 + rng.next() * 0.6) * 1000) / 1000
  const side = Math.min(width, height) * 0.4

  return {
    bbox: [(width - side) / 2, (height - side) / 2.4, (width + side) / 2, (height - side) / 2.4 + side],
    det_score: Math.round((0.8 + rng.next() * 0.19) * 1000) / 1000,
    match: person
      ? { person_id: person.id, id_number: person.id_number, full_name: person.full_name, similarity }
      : null,
    accepted: Boolean(person) && similarity >= threshold,
  }
}

/**
 * POST /recognize?threshold=  (multipart, field "file") — matches faces, writes nothing.
 *
 * Real call:
 *   const form = new FormData(); form.append('file', file)
 *   client.post('/recognize', form, { params: cleanParams({ threshold }) })
 */
export async function recognize(file: File, threshold?: number): Promise<RecognizeResult> {
  const used = threshold ?? DEFAULT_MATCH_THRESHOLD
  const face = await fakeFace(file, used)
  return respond({ engine: 'mock', threshold: used, faces: [face] }, 900)
}

/**
 * POST /recognize/log?lab_id=&camera_id=  (multipart, field "file")
 * The full camera path: match, apply threshold and cooldown, write an entry.
 */
export async function recognizeAndLog(file: File, labId: number, cameraId?: number): Promise<EntryDecision> {
  const lab = findLab(labId) ?? fail(404, 'Laboratory not found.')
  if (cameraId !== undefined && !findCamera(cameraId)) fail(404, 'Camera not found.')
  if (!lab.active) {
    return respond({ logged: false, reason: 'lab_inactive', entry: null, similarity: null, matched_person_id: null })
  }

  const face = await fakeFace(file, lab.match_threshold)
  if (face.accepted && face.match) {
    return createEntry({
      person_id: face.match.person_id,
      lab_id: labId,
      camera_id: cameraId ?? null,
      similarity: face.match.similarity,
    })
  }
  const decision = await createEntry({ lab_id: labId, camera_id: cameraId ?? null, similarity: face.match?.similarity })
  return { ...decision, reason: 'below_threshold_unknown' }
}
