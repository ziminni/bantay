/**
 * Dashboard — /api/v1/stats/today
 *
 * Mock implementation. Real call:
 *   client.get('/stats/today', { params: cleanParams({ lab_id, latest }) })
 */
import { manilaHour, startOfTodayManila } from '@/lib/format'
import { db, entriesNewestFirst, toEntryRead } from '@/mocks/store'
import { respond } from '@/mocks/util'
import type { TodayStats } from './types'

export async function getTodayStats(params: { lab_id?: number; latest?: number } = {}): Promise<TodayStats> {
  const start = startOfTodayManila().toISOString()
  const today = entriesNewestFirst().filter(
    (e) => e.entered_at >= start && (params.lab_id === undefined || e.lab_id === params.lab_id),
  )

  const perHour = new Map<number, number>()
  today.forEach((e) => {
    const h = manilaHour(e.entered_at)
    perHour.set(h, (perHour.get(h) ?? 0) + 1)
  })

  const cameras = db.cameras.filter((c) => params.lab_id === undefined || c.lab_id === params.lab_id)

  return respond({
    date: new Date(Date.now() + 8 * 3_600_000).toISOString().slice(0, 10),
    entries_today: today.length,
    distinct_persons_today: new Set(today.filter((e) => e.person_id != null).map((e) => e.person_id)).size,
    unknown_today: today.filter((e) => e.status === 'UNKNOWN').length,
    cameras_online: cameras.filter((c) => c.status === 'ONLINE').length,
    cameras_total: cameras.length,
    entries_per_hour: Array.from({ length: 24 }, (_, hour) => ({ hour, count: perHour.get(hour) ?? 0 })),
    per_lab: [...db.labs]
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((l) => ({ lab_id: l.id, lab_name: l.name, count: today.filter((e) => e.lab_id === l.id).length })),
    latest_entries: today.slice(0, params.latest ?? 10).map(toEntryRead),
  })
}
