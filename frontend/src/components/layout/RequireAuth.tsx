import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { wasLoggedOutOnPurpose } from '@/api/auth'
import { useSession } from '@/hooks/useSession'

/**
 * Sends logged-out visitors to the landing page with the login dialog open,
 * and brings them back to the page they wanted once they log in.
 * (A convenience only — see the note in src/api/auth.ts.)
 */
export function RequireAuth({ children }: { children: ReactNode }) {
  const user = useSession()
  const location = useLocation()

  if (!user) {
    // Logged out on purpose: just go to the front page.
    if (wasLoggedOutOnPurpose()) return <Navigate to="/" replace />
    const next = encodeURIComponent(location.pathname + location.search)
    return <Navigate to={`/?login=1&next=${next}`} replace />
  }
  return <>{children}</>
}

