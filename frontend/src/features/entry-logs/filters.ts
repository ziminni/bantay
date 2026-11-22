import type { EntryListParams, EntryStatus } from '@/api/types'
import { localInputToIso, startOfTodayManila } from '@/lib/format'

/** Filters as stored in the URL (all strings). */
export const LOG_FILTER_DEFAULTS = {
  q: '',
  lab_id: '',
  camera_id: '',
  person_id: '',
  status: '',
  range: '',
  from: '',
  to: '',
}

export type LogFilters = typeof LOG_FILTER_DEFAULTS

export const RANGE_OPTIONS = [
  { value: 'today', label: 'Today' },
  { value: '7d', label: 'Last 7 days' },
  { value: '30d', label: 'Last 30 days' },
  { value: 'custom', label: 'Custom range…' },
]

/** Turn the URL filters into API query parameters. */
export function toEntryParams(f: LogFilters): Omit<EntryListParams, 'page' | 'size'> {
  let date_from: string | undefined
  let date_to: string | undefined
  const today = startOfTodayManila()

  if (f.range === 'today') date_from = today.toISOString()
  else if (f.range === '7d') date_from = new Date(today.getTime() - 6 * 86_400_000).toISOString()
  else if (f.range === '30d') date_from = new Date(today.getTime() - 29 * 86_400_000).toISOString()
  else if (f.range === 'custom') {
    date_from = localInputToIso(f.from)
    date_to = localInputToIso(f.to)
  }

  return {
    q: f.q || undefined,
    lab_id: f.lab_id ? Number(f.lab_id) : undefined,
    camera_id: f.camera_id ? Number(f.camera_id) : undefined,
    person_id: f.person_id ? Number(f.person_id) : undefined,
    status: (f.status || undefined) as EntryStatus | undefined,
    date_from,
    date_to,
  }
}
