/**
 * Laboratories — /api/v1/labs
 *
 * Mock implementation. The real call is written above each function.
 */
import { DEFAULT_COOLDOWN_SECONDS, DEFAULT_MATCH_THRESHOLD } from '@/lib/constants'
import { db, findLab, nextId, toLabRead } from '@/mocks/store'
import { fail, nowIso, respond } from '@/mocks/util'
import type { LabCreate, LabRead, LabUpdate } from './types'

/** GET /labs?active= */
export async function listLabs(params: { active?: boolean } = {}): Promise<LabRead[]> {
  const rows = db.labs
    .filter((l) => params.active === undefined || l.active === params.active)
    .sort((a, b) => a.name.localeCompare(b.name))
    .map(toLabRead)
  return respond(rows, 150)
}

/** GET /labs/{id} */
export async function getLab(id: number): Promise<LabRead> {
  const lab = findLab(id) ?? fail(404, 'Laboratory not found.')
  return respond(toLabRead(lab))
}

/** POST /labs */
export async function createLab(payload: LabCreate): Promise<LabRead> {
  const name = payload.name.trim()
  if (db.labs.some((l) => l.name === name)) {
    fail(409, `A laboratory named '${name}' already exists.`)
  }
  const row = {
    id: nextId('labs'),
    name,
    room: payload.room?.trim() || null,
    open_time: payload.open_time ?? null,
    close_time: payload.close_time ?? null,
    match_threshold: payload.match_threshold ?? DEFAULT_MATCH_THRESHOLD,
    cooldown_seconds: payload.cooldown_seconds ?? DEFAULT_COOLDOWN_SECONDS,
    active: true,
    created_at: nowIso(),
  }
  db.labs.push(row)
  return respond(toLabRead(row))
}

/** PATCH /labs/{id} */
export async function updateLab(id: number, payload: LabUpdate): Promise<LabRead> {
  const lab = findLab(id) ?? fail(404, 'Laboratory not found.')
  if (payload.name && db.labs.some((l) => l.id !== id && l.name === payload.name)) {
    fail(409, 'That laboratory name is already taken.')
  }
  Object.assign(lab, Object.fromEntries(Object.entries(payload).filter(([, v]) => v !== undefined)))
  return respond(toLabRead(lab))
}

/** DELETE /labs/{id} — refused when entry logs reference the lab. */
export async function deleteLab(id: number): Promise<void> {
  if (!findLab(id)) fail(404, 'Laboratory not found.')
  if (db.entries.some((e) => e.lab_id === id)) {
    fail(409, 'This laboratory has entry logs and cannot be deleted. Set active=false instead.')
  }
  db.labs = db.labs.filter((l) => l.id !== id)
  db.cameras = db.cameras.filter((c) => c.lab_id !== id)
  return respond(undefined)
}
