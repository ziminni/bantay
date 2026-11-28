/**
 * Types that mirror the backend's Pydantic schemas
 * (backend/src/bantay_backend/schemas.py).
 *
 * Dates arrive from the API as ISO 8601 strings; times ("07:00:00") as strings.
 * Keep this file in sync with the backend when a schema changes.
 */

export type PersonType = 'STUDENT' | 'FACULTY' | 'STAFF'
export type CameraRole = 'ENTRY' | 'ROOM'
export type CameraStatus = 'ONLINE' | 'OFFLINE' | 'DISABLED'
export type EntryStatus = 'MATCHED' | 'UNKNOWN'

/** ISO 8601 date-time string, e.g. "2026-11-23T01:15:00Z". */
export type DateTimeString = string
/** Time of day string, e.g. "07:00:00". */
export type TimeString = string

// ---------------------------------------------------------------- pagination
export interface Page<T> {
  items: T[]
  total: number
  page: number
  size: number
  pages: number
}

export interface PageParams {
  page?: number
  size?: number
}

// ---------------------------------------------------------------- persons
export interface PersonRead {
  id: number
  id_number: string
  full_name: string
  person_type: PersonType
  department: string | null
  consent_given: boolean
  consent_signed_at: DateTimeString | null
  active: boolean
  created_at: DateTimeString
  embedding_count: number
}

export interface PersonCreate {
  id_number: string
  full_name: string
  person_type?: PersonType
  department?: string | null
  consent_given?: boolean
  consent_signed_at?: DateTimeString | null
}

export interface PersonUpdate {
  full_name?: string
  person_type?: PersonType
  department?: string | null
  consent_given?: boolean
  consent_signed_at?: DateTimeString | null
  active?: boolean
}

export interface PersonListParams extends PageParams {
  q?: string
  person_type?: PersonType
  active?: boolean
  enrolled_only?: boolean
}

// ---------------------------------------------------------------- enrollment
export interface FaceEmbeddingRead {
  id: number
  person_id: number
  det_score: number | null
  source_filename: string | null
  created_at: DateTimeString
}

export interface RejectedPhoto {
  filename: string
  reason: string
}

export interface EnrollmentResult {
  person_id: number
  accepted: FaceEmbeddingRead[]
  rejected: RejectedPhoto[]
  total_embeddings: number
  meets_minimum: boolean
  note: string
}

// ---------------------------------------------------------------- labs
export interface LabRead {
  id: number
  name: string
  room: string | null
  open_time: TimeString | null
  close_time: TimeString | null
  match_threshold: number
  cooldown_seconds: number
  active: boolean
  created_at: DateTimeString
  camera_count: number
}

export interface LabCreate {
  name: string
  room?: string | null
  open_time?: TimeString | null
  close_time?: TimeString | null
  match_threshold?: number | null
  cooldown_seconds?: number | null
}

export interface LabUpdate extends Partial<LabCreate> {
  active?: boolean
}

// ---------------------------------------------------------------- cameras
export type ZoneKind = 'door' | 'workstation' | 'restricted'

export interface CameraZone {
  name: string
  kind: ZoneKind
  x: number
  y: number
  w: number
  h: number
}

export interface CameraRead {
  id: number
  lab_id: number
  lab_name: string | null
  name: string
  role: CameraRole
  /** Password is masked by the backend: rtsp://admin:****@host/... */
  rtsp_url: string | null
  enabled: boolean
  status: CameraStatus
  last_seen_at: DateTimeString | null
  last_error: string | null
  zones?: CameraZone[]
  created_at: DateTimeString
  /** Relative path of the MJPEG live view, e.g. /api/v1/cameras/1/stream.mjpeg */
  stream_url: string | null
}

export interface CameraCreate {
  lab_id: number
  name: string
  role?: CameraRole
  rtsp_url: string
  enabled?: boolean
  zones?: CameraZone[]
}

export interface CameraUpdate {
  name?: string
  role?: CameraRole
  rtsp_url?: string
  enabled?: boolean
  lab_id?: number
  zones?: CameraZone[]
}

export interface CameraListParams {
  lab_id?: number
  enabled?: boolean
}

export interface CameraTestResult {
  ok: boolean
  camera_id: number | null
  width: number | null
  height: number | null
  elapsed_ms: number | null
  detail: string
}

// ---------------------------------------------------------------- entries
export interface EntryPersonRead {
  id: number
  id_number: string
  full_name: string
  person_type: PersonType
}

export interface EntryLogRead {
  id: number
  entered_at: DateTimeString
  status: EntryStatus
  similarity: number | null
  /** Null for UNKNOWN entries, and for MATCHED entries whose person was deleted. */
  person: EntryPersonRead | null
  lab_id: number
  lab_name: string | null
  camera_id: number | null
  camera_name: string | null
  /** Relative to /media, e.g. "snapshots/unknown_20261123_0815_ab12cd34.jpg" */
  snapshot_path: string | null
}

export interface EntryListParams extends PageParams {
  q?: string
  person_id?: number
  lab_id?: number
  camera_id?: number
  status?: EntryStatus
  date_from?: DateTimeString
  date_to?: DateTimeString
}

export interface ManualEntryCreate {
  person_id?: number | null
  lab_id: number
  camera_id?: number | null
  entered_at?: DateTimeString | null
  similarity?: number | null
  bypass_cooldown?: boolean
}

export type EntryDecisionReason =
  | 'logged'
  | 'cooldown'
  | 'below_threshold_unknown'
  | 'no_faces'
  | 'lab_inactive'

export interface EntryDecision {
  logged: boolean
  reason: EntryDecisionReason
  entry: EntryLogRead | null
  similarity: number | null
  matched_person_id: number | null
}

// ---------------------------------------------------------------- recognition
export interface FaceMatch {
  person_id: number
  id_number: string
  full_name: string
  similarity: number
}

export interface DetectedFaceRead {
  /** [x1, y1, x2, y2] in pixels. */
  bbox: [number, number, number, number]
  det_score: number
  match: FaceMatch | null
  accepted: boolean
}

export interface RecognizeResult {
  engine: string
  threshold: number
  faces: DetectedFaceRead[]
}

// ---------------------------------------------------------------- dashboard
export interface HourBucket {
  hour: number
  count: number
}

export interface LabTotal {
  lab_id: number
  lab_name: string
  count: number
}

export interface TodayStats {
  date: string
  entries_today: number
  distinct_persons_today: number
  unknown_today: number
  cameras_online: number
  cameras_total: number
  entries_per_hour: HourBucket[]
  per_lab: LabTotal[]
  latest_entries: EntryLogRead[]
}

// ---------------------------------------------------------------- health
export interface CameraHealth {
  id: number
  name: string
  lab_name: string | null
  role: CameraRole
  status: CameraStatus
  worker_running: boolean
  last_seen_at: DateTimeString | null
  last_error: string | null
}

export interface HealthResponse {
  status: 'ok' | 'degraded'
  app: string
  version: string
  environment: string
  database_reachable: boolean
  recognition_engine: string
  recognition_ready: boolean
  embedding_dim: number
  cameras_online: number
  cameras_offline: number
  cameras: CameraHealth[]
}

// ---------------------------------------------------------------- behaviour flags
// Shapes proposed for /api/v1/flags (slides 23, 25 and 30 of the SIA deck).
// The backend does not serve these yet; see src/api/flags.ts.
export type FlagType = 'RUNNING' | 'EQUIPMENT_REMOVAL' | 'UNAUTHORIZED_USE' | 'UNKNOWN_PERSON'
export type FlagStatus = 'PENDING' | 'CONFIRMED' | 'DISMISSED'

/** The measured values that made a rule fire, so every flag can be explained. */
export interface FlagEvidence {
  rule_set: string
  metric: string
  value: number
  threshold: number
  unit: string
  /** 'above': fires when value > threshold (speed); 'below': fires when value < threshold (similarity). */
  direction: 'above' | 'below'
  held_seconds: number | null
  required_seconds: number | null
  track_id: number | null
  zone: string | null
  object: string | null
}

/** Someone with an open visit in the lab when the flag was raised. */
export interface FlagPersonRead {
  entry_id: number
  entered_at: DateTimeString
  person: EntryPersonRead | null
  /** Ticked by the reviewer: this is the person who did it. */
  responsible: boolean
}

export interface FlagRead {
  id: number
  type: FlagType
  status: FlagStatus
  occurred_at: DateTimeString
  lab_id: number
  lab_name: string | null
  camera_id: number | null
  camera_name: string | null
  evidence: FlagEvidence
  snapshot_path: string | null
  clip_path: string | null
  /** Seconds into the 6-second clip at which the rule fired. */
  trigger_offset: number
  zones?: CameraZone[]
  persons_inside: FlagPersonRead[]
  reviewed_by: string | null
  reviewed_at: DateTimeString | null
  review_note: string | null
}

export interface FlagListParams {
  status?: FlagStatus
  type?: FlagType
  lab_id?: number
}

export interface FlagReview {
  status: Exclude<FlagStatus, 'PENDING'>
  note?: string | null
  responsible_entry_ids?: number[]
}

export interface FlagCounts {
  PENDING: number
  CONFIRMED: number
  DISMISSED: number
}
