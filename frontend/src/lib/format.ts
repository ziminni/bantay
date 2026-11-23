import { TIME_ZONE } from '@/config'

const dateTimeFmt = new Intl.DateTimeFormat('en-PH', {
  timeZone: TIME_ZONE,
  year: 'numeric',
  month: 'short',
  day: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
})

const dateFmt = new Intl.DateTimeFormat('en-PH', {
  timeZone: TIME_ZONE,
  year: 'numeric',
  month: 'short',
  day: 'numeric',
})

const longDateFmt = new Intl.DateTimeFormat('en-PH', {
  timeZone: TIME_ZONE,
  weekday: 'long',
  year: 'numeric',
  month: 'long',
  day: 'numeric',
})

const timeFmt = new Intl.DateTimeFormat('en-PH', {
  timeZone: TIME_ZONE,
  hour: 'numeric',
  minute: '2-digit',
  second: '2-digit',
})

export function formatDateTime(iso: string | null | undefined): string {
  return iso ? dateTimeFmt.format(new Date(iso)) : '—'
}

export function formatDate(iso: string | null | undefined): string {
  return iso ? dateFmt.format(new Date(iso)) : '—'
}

export function formatLongDate(value: string | Date): string {
  const d = typeof value === 'string' ? new Date(`${value}T00:00:00+08:00`) : value
  return longDateFmt.format(d)
}

export function formatTime(iso: string | null | undefined): string {
  return iso ? timeFmt.format(new Date(iso)) : '—'
}

/** "07:00:00" → "7:00 AM" */
export function formatTimeOfDay(value: string | null | undefined): string {
  if (!value) return '—'
  const [h, m] = value.split(':').map(Number)
  const suffix = h >= 12 ? 'PM' : 'AM'
  const hour = h % 12 === 0 ? 12 : h % 12
  return `${hour}:${String(m).padStart(2, '0')} ${suffix}`
}

export function formatOpeningHours(open: string | null, close: string | null): string {
  if (!open && !close) return 'Not set'
  return `${formatTimeOfDay(open)} – ${formatTimeOfDay(close)}`
}

/** 0–23 → "7 AM" */
export function formatHour(hour: number): string {
  const suffix = hour >= 12 ? 'PM' : 'AM'
  const h = hour % 12 === 0 ? 12 : hour % 12
  return `${h} ${suffix}`
}

/** 0.8123 → "81%" */
export function formatSimilarity(value: number | null | undefined): string {
  return value == null ? '—' : `${Math.round(value * 100)}%`
}

/** 120 → "2 min", 45 → "45 s", 3600 → "1 h" */
export function formatDuration(seconds: number): string {
  if (seconds === 0) return 'Off'
  if (seconds < 60) return `${seconds} s`
  if (seconds < 3600) {
    const m = seconds / 60
    return `${Number.isInteger(m) ? m : m.toFixed(1)} min`
  }
  const h = seconds / 3600
  return `${Number.isInteger(h) ? h : h.toFixed(1)} h`
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

export function formatRelative(iso: string | null | undefined): string {
  if (!iso) return 'never'
  const diff = (Date.now() - new Date(iso).getTime()) / 1000
  if (diff < 60) return 'just now'
  if (diff < 3600) return `${Math.floor(diff / 60)} min ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)} h ago`
  return formatDateTime(iso)
}

export function pluralize(n: number, one: string, many = `${one}s`): string {
  return `${n.toLocaleString()} ${n === 1 ? one : many}`
}

/**
 * Convert a `datetime-local` input value (Manila local time) into a UTC ISO
 * string for the API, and back.
 */
export function localInputToIso(value: string): string | undefined {
  if (!value) return undefined
  return new Date(`${value}:00+08:00`).toISOString()
}

export function isoToLocalInput(iso: string | null | undefined): string {
  if (!iso) return ''
  const d = new Date(new Date(iso).getTime() + 8 * 3600 * 1000)
  return d.toISOString().slice(0, 16)
}

/** Start of today in Manila, as a Date. */
export function startOfTodayManila(now = new Date()): Date {
  const manila = new Date(now.getTime() + 8 * 3600 * 1000)
  manila.setUTCHours(0, 0, 0, 0)
  return new Date(manila.getTime() - 8 * 3600 * 1000)
}

/** Hour of day (0–23) in Manila. */
export function manilaHour(iso: string): number {
  return new Date(new Date(iso).getTime() + 8 * 3600 * 1000).getUTCHours()
}
