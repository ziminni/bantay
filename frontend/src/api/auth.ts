/**
 * Sign-in and the signed-in profile.
 *
 * ⚠ The backend has no accounts or login endpoint yet, so this is a stand-in:
 * it checks that both fields are filled in and remembers the profile in this
 * browser. Logging in and out hides and shows the app's pages, but it does
 * NOT secure anything — every API endpoint is still open to anyone on the
 * network. When the backend adds authentication (e.g. POST /auth/login
 * returning a token and the user's details), replace the body of `login`
 * with that call and send the token on every request from `client.ts`.
 */
import { ApiError } from './errors'

export interface Session {
  username: string
  /** The name shown in the app; defaults to the username. */
  displayName: string
  role: string
  signedInAt: string
}

const KEY = 'bantay.session'
const listeners = new Set<() => void>()

let cached: Session | null | undefined
/** True after the user logs out themselves, so the app goes home rather than asking them to log in again. */
let loggedOutOnPurpose = false

function read(): Session | null {
  if (cached !== undefined) return cached
  try {
    const raw = localStorage.getItem(KEY)
    const parsed = raw ? (JSON.parse(raw) as Partial<Session>) : null
    cached =
      parsed?.username && parsed.signedInAt
        ? {
            username: parsed.username,
            displayName: parsed.displayName || parsed.username,
            role: parsed.role || 'Lab administrator',
            signedInAt: parsed.signedInAt,
          }
        : null
  } catch {
    cached = null
  }
  return cached
}

function write(value: Session | null) {
  if (value) localStorage.setItem(KEY, JSON.stringify(value))
  else localStorage.removeItem(KEY)
  cached = value
  listeners.forEach((l) => l())
}

// Keep tabs in step: logging out in one tab logs out the others.
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key !== KEY) return
    // Logging out in another tab counts as logging out here too.
    if (!e.newValue) loggedOutOnPurpose = true
    cached = undefined
    listeners.forEach((l) => l())
  })
}

export const session = {
  get: read,
  subscribe(listener: () => void) {
    listeners.add(listener)
    return () => {
      listeners.delete(listener)
    }
  },
}

export async function login(username: string, password: string): Promise<Session> {
  await new Promise((resolve) => setTimeout(resolve, 600))
  if (!username.trim() || !password) throw new ApiError(422, 'Enter your username and password.')
  const name = username.trim()
  const value: Session = { username: name, displayName: name, role: 'Lab administrator', signedInAt: new Date().toISOString() }
  loggedOutOnPurpose = false
  write(value)
  return value
}

/** Change how your name is shown. Stored in this browser only, for now. */
export async function updateProfile(changes: { displayName: string }): Promise<Session> {
  const current = read()
  if (!current) throw new ApiError(401, 'You are not logged in.')
  const displayName = changes.displayName.trim()
  if (!displayName) throw new ApiError(422, 'Enter a name.')
  if (displayName.length > 80) throw new ApiError(422, 'At most 80 characters.')
  const value = { ...current, displayName }
  write(value)
  return value
}

export function logout() {
  loggedOutOnPurpose = true
  write(null)
}

export function wasLoggedOutOnPurpose() {
  return loggedOutOnPurpose
}
