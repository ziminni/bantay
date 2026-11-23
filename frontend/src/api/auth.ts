/**
 * Sign-in.
 *
 * ⚠ The backend has no accounts or login endpoint yet, so this is a stand-in:
 * it checks that both fields are filled in and remembers the name for this
 * browser tab. It does NOT protect anything — every API endpoint is still
 * open. When the backend adds authentication (e.g. POST /auth/login returning
 * a token), replace the body of `login` with that call and send the token on
 * every request from `client.ts`.
 */
import { ApiError } from './errors'

export interface Session {
  username: string
  signedInAt: string
}

const KEY = 'bantay.session'
const listeners = new Set<() => void>()

function emit() {
  listeners.forEach((l) => l())
}

let cached: Session | null | undefined
function read(): Session | null {
  if (cached !== undefined) return cached
  try {
    const raw = sessionStorage.getItem(KEY)
    cached = raw ? (JSON.parse(raw) as Session) : null
  } catch {
    cached = null
  }
  return cached
}

export const session = {
  get: read,
  subscribe(listener: () => void) {
    listeners.add(listener)
    return () => listeners.delete(listener)
  },
}

export async function login(username: string, password: string): Promise<Session> {
  await new Promise((resolve) => setTimeout(resolve, 600))
  if (!username.trim() || !password) throw new ApiError(422, 'Enter your username and password.')
  const value: Session = { username: username.trim(), signedInAt: new Date().toISOString() }
  sessionStorage.setItem(KEY, JSON.stringify(value))
  cached = value
  emit()
  return value
}

export function logout() {
  sessionStorage.removeItem(KEY)
  cached = null
  emit()
}
