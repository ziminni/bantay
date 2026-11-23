/**
 * The in-memory "database" behind the mock API.
 *
 * Changes made in the UI (new people, edited labs, deleted entries...) live
 * here until the page is reloaded. The read-model builders below produce the
 * exact shapes the backend returns.
 */
import type { CameraRead, EntryLogRead, LabRead, PersonRead } from '@/api/types'
import { createSeed, type CameraRow, type EntryRow, type LabRow, type PersonRow } from './seed'
import { maskRtspUrl } from './util'

export const db = createSeed()

const counters = {
  persons: Math.max(0, ...db.persons.map((r) => r.id)),
  faces: Math.max(0, ...db.faces.map((r) => r.id)),
  labs: Math.max(0, ...db.labs.map((r) => r.id)),
  cameras: Math.max(0, ...db.cameras.map((r) => r.id)),
  entries: Math.max(0, ...db.entries.map((r) => r.id)),
}

export function nextId(table: keyof typeof counters): number {
  counters[table] += 1
  return counters[table]
}

// ---------------------------------------------------------------- lookups
export const findPerson = (id: number) => db.persons.find((p) => p.id === id)
export const findLab = (id: number) => db.labs.find((l) => l.id === id)
export const findCamera = (id: number) => db.cameras.find((c) => c.id === id)

// ---------------------------------------------------------------- read models
export function toPersonRead(p: PersonRow): PersonRead {
  return {
    ...p,
    embedding_count: db.faces.filter((f) => f.person_id === p.id).length,
  }
}

export function toLabRead(l: LabRow): LabRead {
  return {
    ...l,
    camera_count: db.cameras.filter((c) => c.lab_id === l.id).length,
  }
}

export function toCameraRead(c: CameraRow): CameraRead {
  return {
    ...c,
    rtsp_url: maskRtspUrl(c.rtsp_url),
    lab_name: findLab(c.lab_id)?.name ?? null,
    stream_url: `/api/v1/cameras/${c.id}/stream.mjpeg`,
  }
}

export function toEntryRead(e: EntryRow): EntryLogRead {
  const person = e.person_id != null ? findPerson(e.person_id) : undefined
  return {
    id: e.id,
    entered_at: e.entered_at,
    status: e.status,
    similarity: e.similarity,
    person: person
      ? {
          id: person.id,
          id_number: person.id_number,
          full_name: person.full_name,
          person_type: person.person_type,
        }
      : null,
    lab_id: e.lab_id,
    lab_name: findLab(e.lab_id)?.name ?? null,
    camera_id: e.camera_id,
    camera_name: e.camera_id != null ? (findCamera(e.camera_id)?.name ?? null) : null,
    snapshot_path: e.snapshot_path,
  }
}

/** Newest first, like the backend. */
export function entriesNewestFirst(): EntryRow[] {
  return [...db.entries].sort(
    (a, b) => b.entered_at.localeCompare(a.entered_at) || b.id - a.id,
  )
}
