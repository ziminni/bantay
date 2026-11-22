/**
 * Sample data used while the frontend is not connected to the backend.
 * The shapes match the backend's database tables (backend/src/bantay_backend/models.py).
 */
import type { CameraRole, CameraStatus, EntryStatus, PersonType } from '@/api/types'
import { startOfTodayManila } from '@/lib/format'
import { seededRandom } from './util'

export interface PersonRow {
  id: number
  id_number: string
  full_name: string
  person_type: PersonType
  department: string | null
  consent_given: boolean
  consent_signed_at: string | null
  active: boolean
  created_at: string
}

export interface FaceRow {
  id: number
  person_id: number
  det_score: number | null
  source_filename: string | null
  created_at: string
}

export interface LabRow {
  id: number
  name: string
  room: string | null
  open_time: string | null
  close_time: string | null
  match_threshold: number
  cooldown_seconds: number
  active: boolean
  created_at: string
}

export interface CameraRow {
  id: number
  lab_id: number
  name: string
  role: CameraRole
  rtsp_url: string
  enabled: boolean
  status: CameraStatus
  last_seen_at: string | null
  last_error: string | null
  created_at: string
}

export interface EntryRow {
  id: number
  person_id: number | null
  lab_id: number
  camera_id: number | null
  entered_at: string
  similarity: number | null
  status: EntryStatus
  snapshot_path: string | null
}

export interface MockDatabase {
  persons: PersonRow[]
  faces: FaceRow[]
  labs: LabRow[]
  cameras: CameraRow[]
  entries: EntryRow[]
}

const NAMES: Array<[string, PersonType, string]> = [
  ['Juan Dela Cruz', 'STUDENT', 'Information Technology'],
  ['Maria Clara Santos', 'STUDENT', 'Computer Science'],
  ['Jose Rizal Mercado', 'STUDENT', 'Information Technology'],
  ['Andrea Mae Villanueva', 'STUDENT', 'Information Systems'],
  ['Mark Anthony Reyes', 'STUDENT', 'Computer Science'],
  ['Kristine Joy Bautista', 'STUDENT', 'Information Technology'],
  ['John Paul Garcia', 'STUDENT', 'Computer Science'],
  ['Angelica Ramos', 'STUDENT', 'Information Systems'],
  ['Carlo Miguel Aquino', 'STUDENT', 'Information Technology'],
  ['Princess Mendoza', 'STUDENT', 'Computer Science'],
  ['Rafael Torres', 'STUDENT', 'Information Technology'],
  ['Jasmine Flores', 'STUDENT', 'Information Systems'],
  ['Kenneth Navarro', 'STUDENT', 'Computer Science'],
  ['Bea Castillo', 'STUDENT', 'Information Technology'],
  ['Miguel Fernandez', 'STUDENT', 'Computer Science'],
  ['Hannah Lopez', 'STUDENT', 'Information Technology'],
  ['Christian Domingo', 'STUDENT', 'Information Systems'],
  ['Nicole Gonzales', 'STUDENT', 'Computer Science'],
  ['Paolo Rivera', 'STUDENT', 'Information Technology'],
  ['Trisha Morales', 'STUDENT', 'Computer Science'],
  ['Dr. Ramon Salazar', 'FACULTY', 'Information Technology'],
  ['Prof. Elena Cruz', 'FACULTY', 'Computer Science'],
  ['Prof. Victor Lim', 'FACULTY', 'Information Systems'],
  ['Engr. Grace Pascual', 'FACULTY', 'Information Technology'],
  ['Dr. Antonio Herrera', 'FACULTY', 'Computer Science'],
  ['Roberto Manalo', 'STAFF', 'Laboratory Office'],
  ['Liza Soriano', 'STAFF', 'Laboratory Office'],
  ['Danilo Ocampo', 'STAFF', 'Maintenance'],
]

export function createSeed(): MockDatabase {
  const rng = seededRandom(20261123)
  const now = new Date()
  const today = startOfTodayManila(now)
  const daysAgo = (d: number, hour = 9) =>
    new Date(today.getTime() - d * 86_400_000 + hour * 3_600_000).toISOString()

  // ---------------------------------------------------------------- labs
  const labs: LabRow[] = [
    { id: 1, name: 'Lab 1', room: 'IT Building, Room 201', open_time: '07:00:00', close_time: '19:00:00', match_threshold: 0.45, cooldown_seconds: 120, active: true, created_at: daysAgo(60) },
    { id: 2, name: 'Lab 2', room: 'IT Building, Room 202', open_time: '07:00:00', close_time: '19:00:00', match_threshold: 0.45, cooldown_seconds: 120, active: true, created_at: daysAgo(60) },
    { id: 3, name: 'Lab 3', room: 'CS Building, Room 105', open_time: '08:00:00', close_time: '17:00:00', match_threshold: 0.5, cooldown_seconds: 300, active: true, created_at: daysAgo(45) },
    { id: 4, name: 'Multimedia Lab', room: 'IT Building, Room 310', open_time: null, close_time: null, match_threshold: 0.45, cooldown_seconds: 120, active: false, created_at: daysAgo(30) },
  ]

  // ---------------------------------------------------------------- cameras
  const minutesAgo = (m: number) => new Date(now.getTime() - m * 60_000).toISOString()
  const cameras: CameraRow[] = [
    { id: 1, lab_id: 1, name: 'Lab 1 Entrance', role: 'ENTRY', rtsp_url: 'rtsp://admin:lab1pass@192.168.10.51:554/Streaming/Channels/101', enabled: true, status: 'ONLINE', last_seen_at: minutesAgo(0), last_error: null, created_at: daysAgo(60) },
    { id: 2, lab_id: 1, name: 'Lab 1 Room', role: 'ROOM', rtsp_url: 'rtsp://admin:lab1pass@192.168.10.52:554/Streaming/Channels/101', enabled: true, status: 'ONLINE', last_seen_at: minutesAgo(0), last_error: null, created_at: daysAgo(60) },
    { id: 3, lab_id: 2, name: 'Lab 2 Entrance', role: 'ENTRY', rtsp_url: 'rtsp://admin:lab2pass@192.168.10.61:554/Streaming/Channels/101', enabled: true, status: 'ONLINE', last_seen_at: minutesAgo(1), last_error: null, created_at: daysAgo(60) },
    { id: 4, lab_id: 3, name: 'Lab 3 Entrance', role: 'ENTRY', rtsp_url: 'rtsp://admin:lab3pass@192.168.10.71:554/stream1', enabled: true, status: 'OFFLINE', last_seen_at: minutesAgo(47), last_error: 'could not open the stream', created_at: daysAgo(45) },
    { id: 5, lab_id: 4, name: 'Multimedia Entrance', role: 'ENTRY', rtsp_url: 'rtsp://192.168.10.81:8554/live', enabled: false, status: 'DISABLED', last_seen_at: null, last_error: null, created_at: daysAgo(30) },
  ]

  // ---------------------------------------------------------------- persons + faces
  const persons: PersonRow[] = []
  const faces: FaceRow[] = []
  let faceId = 1

  NAMES.forEach(([full_name, person_type, department], i) => {
    const id = i + 1
    const year = person_type === 'STUDENT' ? 2021 + (i % 4) : 2010 + (i % 10)
    const prefix = person_type === 'STUDENT' ? '' : person_type === 'FACULTY' ? 'F-' : 'S-'
    // A few people show the incomplete states the UI must handle.
    const noConsent = id === 27
    const notEnrolled = id === 19 || id === 27
    const fewPhotos = id === 20
    const created = daysAgo(55 - i)

    persons.push({
      id,
      id_number: `${prefix}${year}-${String(10000 + id * 37).slice(-5)}`,
      full_name,
      person_type,
      department,
      consent_given: !noConsent,
      consent_signed_at: noConsent ? null : created,
      active: id !== 15,
      created_at: created,
    })

    if (!notEnrolled) {
      const count = fewPhotos ? 2 : rng.int(3, 5)
      for (let n = 1; n <= count; n++) {
        faces.push({
          id: faceId++,
          person_id: id,
          det_score: Math.round((0.78 + rng.next() * 0.2) * 1000) / 1000,
          source_filename: `${full_name.split(' ').slice(-1)[0].toLowerCase()}_${n}.jpg`,
          created_at: created,
        })
      }
    }
  })

  // ---------------------------------------------------------------- entries
  const enrolledIds = [...new Set(faces.map((f) => f.person_id))].filter(
    (id) => persons[id - 1].active,
  )
  const entryCameras = cameras.filter((c) => c.role === 'ENTRY' && c.lab_id !== 4)
  const raw: Omit<EntryRow, 'id'>[] = []

  for (let day = 13; day >= 0; day--) {
    const dayStart = today.getTime() - day * 86_400_000
    const weekday = new Date(dayStart + 8 * 3_600_000).getUTCDay()
    const busy = weekday === 0 ? 0.15 : weekday === 6 ? 0.4 : 1

    for (const cam of entryCameras) {
      const lab = labs.find((l) => l.id === cam.lab_id)!
      const openHour = Number(lab.open_time?.slice(0, 2) ?? 7)
      const closeHour = Number(lab.close_time?.slice(0, 2) ?? 19)
      const count = Math.round(rng.int(18, 34) * busy)

      for (let n = 0; n < count; n++) {
        // Morning and early-afternoon peaks.
        const hour = rng.chance(0.6)
          ? rng.pick([7, 8, 9, 10, 13, 14].filter((h) => h >= openHour && h < closeHour))
          : rng.int(openHour, closeHour - 1)
        const at = dayStart + hour * 3_600_000 + rng.int(0, 3599) * 1000
        if (at > now.getTime()) continue

        const unknown = rng.chance(0.08)
        raw.push({
          person_id: unknown ? null : rng.pick(enrolledIds),
          lab_id: cam.lab_id,
          camera_id: cam.id,
          entered_at: new Date(at).toISOString(),
          similarity: unknown
            ? Math.round((0.12 + rng.next() * 0.25) * 1000) / 1000
            : Math.round((0.52 + rng.next() * 0.4) * 1000) / 1000,
          status: unknown ? 'UNKNOWN' : 'MATCHED',
          snapshot_path: unknown
            ? `snapshots/unknown_${new Date(at).toISOString().replace(/\D/g, '').slice(0, 14)}.jpg`
            : null,
        })
      }
    }
  }

  // A couple of manual entries (no camera), as the backend allows.
  raw.push({
    person_id: 21,
    lab_id: 3,
    camera_id: null,
    entered_at: new Date(Math.min(now.getTime(), today.getTime() + 8.5 * 3_600_000)).toISOString(),
    similarity: null,
    status: 'MATCHED',
    snapshot_path: null,
  })

  raw.sort((a, b) => a.entered_at.localeCompare(b.entered_at))
  const entries: EntryRow[] = raw.map((e, i) => ({ ...e, id: i + 1 }))

  return { persons, faces, labs, cameras, entries }
}
