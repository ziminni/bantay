import { useSyncExternalStore } from 'react'
import { session, type Session } from '@/api/auth'

/** The signed-in user for this tab, or null. */
export function useSession(): Session | null {
  return useSyncExternalStore(session.subscribe, session.get, () => null)
}
