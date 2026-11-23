import { ApiError } from '@/api/errors'
import type { Page } from '@/api/types'

/** Wait a little, like a real network call, and return a copy of the value. */
export async function respond<T>(value: T, ms = 250): Promise<T> {
  await new Promise((resolve) => setTimeout(resolve, ms + Math.random() * 150))
  return structuredClone(value)
}

export function fail(status: number, detail: string): never {
  throw new ApiError(status, detail)
}

export function paginate<T>(rows: T[], page = 1, size = 25): Page<T> {
  const total = rows.length
  const pages = Math.max(1, Math.ceil(total / size))
  const start = (page - 1) * size
  return { items: rows.slice(start, start + size), total, page, size, pages }
}

export function matchesQuery(q: string | undefined, ...fields: Array<string | null | undefined>) {
  if (!q?.trim()) return true
  const needle = q.trim().toLowerCase()
  return fields.some((f) => f?.toLowerCase().includes(needle))
}

/** Deterministic pseudo-random numbers so the sample data is stable between reloads. */
export function seededRandom(seed: number) {
  let a = seed >>> 0
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
  return {
    next,
    int: (min: number, max: number) => Math.floor(next() * (max - min + 1)) + min,
    pick: <T>(items: readonly T[]): T => items[Math.floor(next() * items.length)],
    chance: (p: number) => next() < p,
  }
}

/** Same masking the backend applies to camera URLs. */
export function maskRtspUrl(url: string | null): string | null {
  if (!url) return url
  return url.replace(/:\/\/([^:/@]+):([^@]+)@/, '://$1:****@')
}

export const nowIso = () => new Date().toISOString()
