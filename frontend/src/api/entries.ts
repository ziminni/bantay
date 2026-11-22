/**
 * Entry Logs — /api/v1/entries
 *
 * Mock implementation. The real call is written above each function.
 */
import { MEDIA_BASE_URL } from '@/config'
import { db, entriesNewestFirst, findCamera, findLab, findPerson, nextId, toEntryRead } from '@/mocks/store'
import { fail, matchesQuery, paginate, respond } from '@/mocks/util'
import type { EntryDecision, EntryListParams, EntryLogRead, ManualEntryCreate, Page } from './types'

type Filters = Omit<EntryListParams, 'page' | 'size'>

function filtered(params: Filters): EntryLogRead[] {
  if (params.date_from && params.date_to && params.date_from > params.date_to) {
    fail(422, 'date_from must not be later than date_to.')
  }
  return entriesNewestFirst()
    .filter((e) => params.person_id === undefined || e.person_id === params.person_id)
    .filter((e) => params.lab_id === undefined || e.lab_id === params.lab_id)
    .filter((e) => params.camera_id === undefined || e.camera_id === params.camera_id)
    .filter((e) => !params.status || e.status === params.status)
    .filter((e) => !params.date_from || e.entered_at >= params.date_from)
    .filter((e) => !params.date_to || e.entered_at <= params.date_to)
    .map(toEntryRead)
    .filter((e) => !params.q || matchesQuery(params.q, e.person?.full_name, e.person?.id_number))
}

/** GET /entries — newest first, paginated. */
export async function listEntries(params: EntryListParams = {}): Promise<Page<EntryLogRead>> {
  return respond(paginate(filtered(params), params.page, params.size))
}

/** GET /entries/{id} */
export async function getEntry(id: number): Promise<EntryLogRead> {
  const e = db.entries.find((r) => r.id === id) ?? fail(404, 'Entry not found.')
  return respond(toEntryRead(e))
}

/** POST /entries — record an entry by hand. The lab's cooldown still applies. */
export async function createEntry(payload: ManualEntryCreate): Promise<EntryDecision> {
  const lab = findLab(payload.lab_id) ?? fail(404, 'Laboratory not found.')
  const person = payload.person_id != null ? (findPerson(payload.person_id) ?? fail(404, 'Person not found.')) : null
  if (payload.camera_id != null && !findCamera(payload.camera_id)) fail(404, 'Camera not found.')

  const at = payload.entered_at ?? new Date().toISOString()

  if (person && !payload.bypass_cooldown && lab.cooldown_seconds > 0) {
    const since = new Date(new Date(at).getTime() - lab.cooldown_seconds * 1000).toISOString()
    const recent = db.entries.some(
      (e) => e.person_id === person.id && e.lab_id === lab.id && e.entered_at >= since && e.entered_at <= at,
    )
    if (recent) {
      return respond({
        logged: false,
        reason: 'cooldown',
        entry: null,
        similarity: payload.similarity ?? null,
        matched_person_id: person.id,
      })
    }
  }

  const row = {
    id: nextId('entries'),
    person_id: person?.id ?? null,
    lab_id: lab.id,
    camera_id: payload.camera_id ?? null,
    entered_at: at,
    similarity: payload.similarity ?? null,
    status: person ? ('MATCHED' as const) : ('UNKNOWN' as const),
    snapshot_path: null,
  }
  db.entries.push(row)
  return respond({
    logged: true,
    reason: 'logged',
    entry: toEntryRead(row),
    similarity: row.similarity,
    matched_person_id: person?.id ?? null,
  })
}

/** DELETE /entries/{id} */
export async function deleteEntry(id: number): Promise<void> {
  if (!db.entries.some((e) => e.id === id)) fail(404, 'Entry not found.')
  db.entries = db.entries.filter((e) => e.id !== id)
  return respond(undefined)
}

/**
 * GET /entries/export.csv — the filtered log as a CSV file.
 *
 * Real call:
 *   client.get('/entries/export.csv', { params: cleanParams(filters), responseType: 'blob' })
 */
export async function exportEntriesCsv(params: Filters): Promise<Blob> {
  const header = ['entry_id', 'entered_at_utc', 'status', 'id_number', 'full_name', 'person_type', 'laboratory', 'camera', 'similarity']
  const quote = (v: unknown) => {
    const s = v == null ? '' : String(v)
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  const lines = filtered(params).map((e) =>
    [e.id, e.entered_at, e.status, e.person?.id_number, e.person?.full_name, e.person?.person_type, e.lab_name, e.camera_name, e.similarity?.toFixed(4)]
      .map(quote)
      .join(','),
  )
  const csv = [header.join(','), ...lines].join('\n') + '\n'
  return respond(new Blob([csv], { type: 'text/csv' }), 400)
}

/** Full URL of an unknown-face snapshot. */
export function snapshotUrl(path: string): string {
  return `${MEDIA_BASE_URL}/${path}`
}
