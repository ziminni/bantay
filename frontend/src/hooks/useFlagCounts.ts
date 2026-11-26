import { useEffect, useState } from 'react'
import { getFlagCounts, subscribeFlags } from '@/api/flags'
import type { FlagCounts } from '@/api/types'

/**
 * Flag counts for the sidebar badge and the alert bell. Refreshes on a timer
 * and immediately whenever a flag is reviewed anywhere in the app.
 */
export function useFlagCounts(refreshMs = 15_000): FlagCounts | undefined {
  const [counts, setCounts] = useState<FlagCounts>()
  useEffect(() => {
    let alive = true
    const load = () => {
      getFlagCounts()
        .then((c) => alive && setCounts(c))
        .catch(() => {})
    }
    load()
    const timer = setInterval(load, refreshMs)
    const unsubscribe = subscribeFlags(load)
    return () => {
      alive = false
      clearInterval(timer)
      unsubscribe()
    }
  }, [refreshMs])
  return counts
}
