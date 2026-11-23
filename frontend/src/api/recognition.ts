/**
 * Recognition testing — /api/v1/recognize and /api/v1/recognize/log
 *
 * Both endpoints answer 503 while the backend is running without the AI stack
 * installed. The pages surface that message as it is.
 */
import { client, cleanParams } from './client'
import type { EntryDecision, RecognizeResult } from './types'

/**
 * POST /recognize?threshold=  (multipart, field "file")
 * Matches every face in the image against the enrolled people. Writes nothing.
 */
export async function recognize(file: File, threshold?: number): Promise<RecognizeResult> {
  const form = new FormData()
  form.append('file', file)
  const { data } = await client.post<RecognizeResult>('/recognize', form, {
    params: cleanParams({ threshold }),
  })
  return data
}

/**
 * POST /recognize/log?lab_id=&camera_id=  (multipart, field "file")
 * The full camera path: match the largest face, apply the threshold and the
 * cooldown, and write an entry when the rules allow it.
 */
export async function recognizeAndLog(file: File, labId: number, cameraId?: number): Promise<EntryDecision> {
  const form = new FormData()
  form.append('file', file)
  const { data } = await client.post<EntryDecision>('/recognize/log', form, {
    params: cleanParams({ lab_id: labId, camera_id: cameraId }),
  })
  return data
}
