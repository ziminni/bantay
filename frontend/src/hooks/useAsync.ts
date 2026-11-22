import { useCallback, useEffect, useRef, useState } from 'react'

interface Options {
  /** Re-run the request every N milliseconds (the dashboard uses this). */
  refreshInterval?: number
}

export interface AsyncState<T> {
  data: T | undefined
  error: unknown
  /** True only for the first load or after the inputs change, not for background refreshes. */
  loading: boolean
  reload: () => void
}

/**
 * Run an async function and track its result. Re-runs when `deps` change and
 * ignores responses that arrive after a newer request has started.
 */
export function useAsync<T>(fn: () => Promise<T>, deps: unknown[], options: Options = {}): AsyncState<T> {
  const [data, setData] = useState<T>()
  const [error, setError] = useState<unknown>()
  const [loading, setLoading] = useState(true)
  const [tick, setTick] = useState(0)
  const fnRef = useRef(fn)
  // Keep the latest function without re-running the request on every render.
  // This effect is declared first, so it runs before the request effect below.
  useEffect(() => {
    fnRef.current = fn
  })
  const requestId = useRef(0)
  const depsKey = JSON.stringify(deps)
  const lastDepsKey = useRef<string | null>(null)

  useEffect(() => {
    const id = ++requestId.current
    const inputsChanged = lastDepsKey.current !== depsKey
    lastDepsKey.current = depsKey
    if (inputsChanged) setLoading(true)

    fnRef
      .current()
      .then((result) => {
        if (id !== requestId.current) return
        setData(result)
        setError(undefined)
      })
      .catch((err: unknown) => {
        if (id !== requestId.current) return
        setError(err)
      })
      .finally(() => {
        if (id === requestId.current) setLoading(false)
      })
  }, [depsKey, tick])

  useEffect(() => {
    if (!options.refreshInterval) return
    const timer = setInterval(() => setTick((t) => t + 1), options.refreshInterval)
    return () => clearInterval(timer)
  }, [options.refreshInterval])

  const reload = useCallback(() => setTick((t) => t + 1), [])

  return { data, error, loading, reload }
}
