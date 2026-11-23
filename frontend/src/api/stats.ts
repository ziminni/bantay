/**
 * Dashboard — /api/v1/stats/today
 *
 * "Today" is the local day in the department's time zone; the backend works
 * that out, so nothing here needs to adjust the dates it returns.
 */
import { client, cleanParams } from './client'
import type { TodayStats } from './types'

export async function getTodayStats(params: { lab_id?: number; latest?: number } = {}): Promise<TodayStats> {
  const { data } = await client.get<TodayStats>('/stats/today', { params: cleanParams(params) })
  return data
}
