/**
 * Behaviour flags — /api/v1/flags (proposed)
 *
 * ⚠ The backend has no behaviour worker or flag tables yet. Until it does,
 * this module generates sample flags in the browser so the review screens can
 * be designed and tested. It still uses real data where it can:
 *
 *   - flags are placed in the real labs and cameras from /labs and /cameras;
 *   - "persons inside" are the real people from /entries who entered that lab
 *     in the three hours before the flag (the backend logs entries only, so
 *     this stands in for open visits).
 *
 * Review decisions are kept in localStorage so they survive a reload.
 * When the backend adds the endpoints, replace each function body with the
 * client call shown in its comment; the shapes in types.ts stay the same.
 */
import { session } from './auth'
import { listCameras } from './cameras'
import { listEntries } from './entries'
import { listLabs } from './labs'
import type {
  CameraRead,
  FlagCounts,
  FlagEvidence,
  FlagListParams,
  FlagPersonRead,
  FlagRead,
  FlagReview,
  FlagType,
  LabRead,
} from './types'
import { ApiError } from './errors'

const REVIEWS_KEY = 'bantay.sample.flagReviews'
/** People who entered this long before a flag count as "inside". */
const INSIDE_WINDOW_MS = 3 * 3600 * 1000

type StoredReview = Pick<FlagRead, 'status' | 'reviewed_by' | 'reviewed_at' | 'review_note'> & {
  responsible: number[]
}

let flags: FlagRead[] | null = null
let seeding: Promise<FlagRead[]> | null = null
const listeners = new Set<() => void>()

/** Re-render anything that shows flag counts (sidebar badge, alert bell). */
export function subscribeFlags(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}
const notify = () => listeners.forEach((l) => l())

// ---------------------------------------------------------------- sample data
interface Template {
  type: FlagType
  minutesAgo: number
  evidence: Omit<FlagEvidence, 'rule_set'>
  trigger: number
  preferRole: 'ROOM' | 'ENTRY'
}

const TEMPLATES: Template[] = [
  {
    type: 'RUNNING',
    minutesAgo: 4,
    preferRole: 'ROOM',
    trigger: 2.6,
    evidence: { metric: 'Hip speed', value: 2.14, threshold: 1.5, unit: 'body-heights/s', direction: 'above', held_seconds: 1.4, required_seconds: 1, track_id: 7, zone: null, object: null },
  },
  {
    type: 'UNKNOWN_PERSON',
    minutesAgo: 16,
    preferRole: 'ENTRY',
    trigger: 3,
    evidence: { metric: 'Best similarity after voting', value: 0.31, threshold: 0.45, unit: '', direction: 'below', held_seconds: null, required_seconds: null, track_id: null, zone: 'Door', object: null },
  },
  {
    type: 'EQUIPMENT_REMOVAL',
    minutesAgo: 41,
    preferRole: 'ROOM',
    trigger: 3.4,
    evidence: { metric: 'Missing since last wrist contact', value: 34, threshold: 30, unit: 's', direction: 'above', held_seconds: 34, required_seconds: 30, track_id: 3, zone: 'Workstation 2', object: 'mouse #12' },
  },
  {
    type: 'UNAUTHORIZED_USE',
    minutesAgo: 73,
    preferRole: 'ROOM',
    trigger: 3.8,
    evidence: { metric: 'Wrists on instructor PC', value: 7.2, threshold: 5, unit: 's', direction: 'above', held_seconds: 7.2, required_seconds: 5, track_id: 11, zone: 'Instructor PC', object: null },
  },
  {
    type: 'RUNNING',
    minutesAgo: 118,
    preferRole: 'ROOM',
    trigger: 2.2,
    evidence: { metric: 'Hip speed', value: 1.72, threshold: 1.5, unit: 'body-heights/s', direction: 'above', held_seconds: 1.1, required_seconds: 1, track_id: 4, zone: null, object: null },
  },
  {
    type: 'EQUIPMENT_REMOVAL',
    minutesAgo: 166,
    preferRole: 'ROOM',
    trigger: 4.1,
    evidence: { metric: 'Carried into door zone', value: 1, threshold: 1, unit: 'object', direction: 'above', held_seconds: null, required_seconds: null, track_id: 9, zone: 'Door', object: 'keyboard #4' },
  },
  {
    type: 'UNAUTHORIZED_USE',
    minutesAgo: 231,
    preferRole: 'ROOM',
    trigger: 3.2,
    evidence: { metric: 'Wrists on workstation outside lab hours', value: 12.5, threshold: 10, unit: 's', direction: 'above', held_seconds: 12.5, required_seconds: 10, track_id: 2, zone: 'Workstation 1', object: null },
  },
  {
    type: 'RUNNING',
    minutesAgo: 302,
    preferRole: 'ROOM',
    trigger: 2.9,
    evidence: { metric: 'Hip speed', value: 1.58, threshold: 1.5, unit: 'body-heights/s', direction: 'above', held_seconds: 1.0, required_seconds: 1, track_id: 5, zone: null, object: null },
  },
]

/** The last three samples arrive already reviewed, so every tab has something in it. */
const PRESET_REVIEWS: Record<number, StoredReview> = {
  6: { status: 'CONFIRMED', reviewed_by: 'Lab administrator', reviewed_at: null, review_note: 'Keyboard returned after talking to the student.', responsible: [] },
  7: { status: 'CONFIRMED', reviewed_by: 'Lab administrator', reviewed_at: null, review_note: 'Used a PC after 8 PM without a permit.', responsible: [] },
  8: { status: 'DISMISSED', reviewed_by: 'Lab administrator', reviewed_at: null, review_note: 'Walking fast to catch a class; not running.', responsible: [] },
}

function readReviews(): Record<number, StoredReview> {
  try {
    return JSON.parse(localStorage.getItem(REVIEWS_KEY) ?? '{}') as Record<number, StoredReview>
  } catch {
    return {}
  }
}

function writeReview(id: number, review: StoredReview) {
  const all = readReviews()
  all[id] = review
  localStorage.setItem(REVIEWS_KEY, JSON.stringify(all))
}

function pickCamera(cameras: CameraRead[], labId: number, role: 'ROOM' | 'ENTRY'): CameraRead | undefined {
  const inLab = cameras.filter((c) => c.lab_id === labId)
  return inLab.find((c) => c.role === role) ?? inLab[0]
}

async function personsInside(labId: number, occurredAt: Date): Promise<FlagPersonRead[]> {
  try {
    const page = await listEntries({
      lab_id: labId,
      date_from: new Date(occurredAt.getTime() - INSIDE_WINDOW_MS).toISOString(),
      date_to: occurredAt.toISOString(),
      size: 50,
    })
    // One row per person (their latest entry); every unknown face is its own row.
    const seen = new Set<number>()
    const rows: FlagPersonRead[] = []
    for (const e of page.items) {
      if (e.person) {
        if (seen.has(e.person.id)) continue
        seen.add(e.person.id)
      }
      rows.push({ entry_id: e.id, entered_at: e.entered_at, person: e.person, responsible: false })
      if (rows.length >= 8) break
    }
    return rows
  } catch {
    return []
  }
}

async function seed(): Promise<FlagRead[]> {
  let labs: LabRead[] = []
  let cameras: CameraRead[] = []
  try {
    ;[labs, cameras] = await Promise.all([listLabs(), listCameras()])
  } catch {
    // Backend unreachable: fall back to placeholder labs so the screens still render.
  }
  const labRefs = labs.length
    ? labs.map((l) => ({ id: l.id, name: l.name }))
    : [1, 2, 3].map((id) => ({ id, name: `CL-${id}` }))

  const now = Date.now()
  const reviews = { ...PRESET_REVIEWS, ...readReviews() }

  const built = await Promise.all(
    TEMPLATES.map(async (t, i): Promise<FlagRead> => {
      const id = i + 1
      const lab = labRefs[i % labRefs.length]
      const camera = pickCamera(cameras, lab.id, t.preferRole)
      const occurred = new Date(now - t.minutesAgo * 60_000)
      const inside = await personsInside(lab.id, occurred)
      const review = reviews[id]
      return {
        id,
        type: t.type,
        status: review?.status ?? 'PENDING',
        occurred_at: occurred.toISOString(),
        lab_id: lab.id,
        lab_name: lab.name,
        camera_id: camera?.id ?? null,
        camera_name: camera?.name ?? (t.preferRole === 'ENTRY' ? 'Entrance' : 'Room camera'),
        evidence: { rule_set: 'r1', ...t.evidence },
        snapshot_path: null,
        clip_path: null,
        trigger_offset: t.trigger,
        persons_inside: inside.map((p) => ({ ...p, responsible: review?.responsible.includes(p.entry_id) ?? false })),
        reviewed_by: review?.reviewed_by ?? null,
        reviewed_at:
          review && review.status !== 'PENDING'
            ? (review.reviewed_at ?? new Date(occurred.getTime() + 20 * 60_000).toISOString())
            : null,
        review_note: review?.review_note ?? null,
      }
    }),
  )
  return built
}

async function all(): Promise<FlagRead[]> {
  if (flags) return flags
  seeding ??= seed().then((rows) => (flags = rows))
  return seeding
}

const delay = <T,>(value: T, ms = 180) =>
  new Promise<T>((resolve) => setTimeout(() => resolve(structuredClone(value)), ms))

// ---------------------------------------------------------------- API
/** GET /flags?status=&type=&lab_id= — newest first. */
export async function listFlags(params: FlagListParams = {}): Promise<FlagRead[]> {
  const rows = (await all())
    .filter((f) => !params.status || f.status === params.status)
    .filter((f) => !params.type || f.type === params.type)
    .filter((f) => !params.lab_id || f.lab_id === params.lab_id)
    .sort((a, b) => b.occurred_at.localeCompare(a.occurred_at))
  return delay(rows)
}

/** GET /flags/{id} */
export async function getFlag(id: number): Promise<FlagRead> {
  const flag = (await all()).find((f) => f.id === id)
  if (!flag) throw new ApiError(404, 'Flag not found.')
  return delay(flag)
}

/** GET /flags/counts?lab_id= */
export async function getFlagCounts(params: { lab_id?: number } = {}): Promise<FlagCounts> {
  const counts: FlagCounts = { PENDING: 0, CONFIRMED: 0, DISMISSED: 0 }
  for (const f of await all()) if (!params.lab_id || f.lab_id === params.lab_id) counts[f.status] += 1
  return delay(counts, 60)
}

/** PATCH /flags/{id} — confirm or dismiss; the backend also writes the audit log. */
export async function reviewFlag(id: number, review: FlagReview): Promise<FlagRead> {
  const rows = await all()
  const flag = rows.find((f) => f.id === id)
  if (!flag) throw new ApiError(404, 'Flag not found.')
  const responsible = review.responsible_entry_ids ?? []
  flag.status = review.status
  flag.review_note = review.note?.trim() || null
  flag.reviewed_by = session.get()?.displayName ?? 'Administrator'
  flag.reviewed_at = new Date().toISOString()
  flag.persons_inside = flag.persons_inside.map((p) => ({ ...p, responsible: responsible.includes(p.entry_id) }))
  writeReview(id, {
    status: flag.status,
    review_note: flag.review_note,
    reviewed_by: flag.reviewed_by,
    reviewed_at: flag.reviewed_at,
    responsible,
  })
  notify()
  return delay(flag)
}

/** Put a reviewed flag back in the queue (undo). */
export async function reopenFlag(id: number): Promise<FlagRead> {
  const flag = (await all()).find((f) => f.id === id)
  if (!flag) throw new ApiError(404, 'Flag not found.')
  flag.status = 'PENDING'
  flag.reviewed_by = null
  flag.reviewed_at = null
  const stored = readReviews()
  delete stored[id]
  // A preset sample stays reopened after a reload too.
  stored[id] = { status: 'PENDING', reviewed_by: null, reviewed_at: null, review_note: flag.review_note, responsible: [] }
  localStorage.setItem(REVIEWS_KEY, JSON.stringify(stored))
  notify()
  return delay(flag)
}
