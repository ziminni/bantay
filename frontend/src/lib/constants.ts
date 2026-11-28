import type { CameraRole, CameraStatus, EntryStatus, PersonType } from '@/api/types'

/** Same defaults and limits as backend/src/bantay_backend/config.py. */
export const DEFAULT_MATCH_THRESHOLD = 0.45
export const DEFAULT_COOLDOWN_SECONDS = 120
export const MIN_ENROLLMENT_PHOTOS = 3
export const MAX_ENROLLMENT_PHOTOS = 12
export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024
export const ACCEPTED_IMAGE_TYPES = ['image/jpeg', 'image/png']

export const DEFAULT_PAGE_SIZE = 25
export const PAGE_SIZE_OPTIONS = [10, 25, 50, 100]

export const PERSON_TYPE_LABELS: Record<PersonType, string> = {
  STUDENT: 'Student',
  FACULTY: 'Faculty',
  STAFF: 'Staff',
}

export const CAMERA_ROLE_LABELS: Record<CameraRole, string> = {
  ENTRY: 'Entrance (logs entries)',
  ROOM: 'Room (live view only)',
}

export const CAMERA_ROLE_SHORT: Record<CameraRole, string> = {
  ENTRY: 'Entrance',
  ROOM: 'Room',
}

export const CAMERA_STATUS_LABELS: Record<CameraStatus, string> = {
  ONLINE: 'Online',
  OFFLINE: 'Offline',
  DISABLED: 'Disabled',
}

export const ENTRY_STATUS_LABELS: Record<EntryStatus, string> = {
  MATCHED: 'Recognized',
  UNKNOWN: 'Unknown',
}

export const toOptions = <K extends string>(labels: Record<K, string>) =>
  (Object.keys(labels) as K[]).map((value) => ({ value, label: labels[value] }))
