/**
 * Entry Logs — /api/v1/entries
 */
import { MEDIA_BASE_URL } from '@/config'
import { client, cleanParams } from './client'
import type { EntryDecision, EntryListParams, EntryLogRead, ManualEntryCreate, Page } from './types'

type Filters = Omit<EntryListParams, 'page' | 'size'>

/** GET /entries — newest first, paginated by the server. */
export async function listEntries(params: EntryListParams = {}): Promise<Page<EntryLogRead>> {
  const { data } = await client.get<Page<EntryLogRead>>('/entries', { params: cleanParams(params) })
  return data
}

/** GET /entries/{id} */
export async function getEntry(id: number): Promise<EntryLogRead> {
  const { data } = await client.get<EntryLogRead>(`/entries/${id}`)
  return data
}

/** POST /entries — record an entry by hand. The lab's cooldown still applies. */
export async function createEntry(payload: ManualEntryCreate): Promise<EntryDecision> {
  const { data } = await client.post<EntryDecision>('/entries', payload)
  return data
}

/** DELETE /entries/{id} */
export async function deleteEntry(id: number): Promise<void> {
  await client.delete(`/entries/${id}`)
}

/**
 * GET /entries/export.csv — the filtered log as a CSV file.
 * The backend streams the whole filtered result, not just the current page.
 */
export async function exportEntriesCsv(params: Filters): Promise<Blob> {
  const { data } = await client.get<Blob>('/entries/export.csv', {
    params: cleanParams(params),
    responseType: 'blob',
  })
  return data
}

/** URL of an unknown-face snapshot, served by the backend from /media. */
export function snapshotUrl(path: string): string {
  return `${MEDIA_BASE_URL}/${path}`
}
