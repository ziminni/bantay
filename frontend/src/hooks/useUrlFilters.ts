import { useCallback, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'

type FilterValues = Record<string, string>

/**
 * Keep a page's filters in the URL query string, so a filtered view survives a
 * reload and can be shared as a link. Changing any filter returns to page 1.
 */
export function useUrlFilters<T extends FilterValues>(initialDefaults: T) {
  const [params, setParams] = useSearchParams()
  const [defaults] = useState(initialDefaults)

  const values = useMemo(() => {
    const out = { ...defaults }
    for (const key of Object.keys(defaults) as Array<keyof T>) {
      const v = params.get(key as string)
      if (v !== null) out[key] = v as T[keyof T]
    }
    return out
  }, [params, defaults])

  const page = Math.max(1, Number(params.get('page')) || 1)
  const size = Number(params.get('size')) || undefined

  const write = useCallback(
    (next: Partial<T>, nextPage?: number, nextSize?: number) => {
      setParams(
        (prev) => {
          const p = new URLSearchParams(prev)
          for (const [k, v] of Object.entries(next)) {
            if (v === undefined || v === '' || v === defaults[k]) p.delete(k)
            else p.set(k, String(v))
          }
          if (nextPage && nextPage > 1) p.set('page', String(nextPage))
          else p.delete('page')
          if (nextSize !== undefined) p.set('size', String(nextSize))
          return p
        },
        { replace: true },
      )
    },
    [setParams, defaults],
  )

  const setFilters = useCallback((next: Partial<T>) => write(next, 1), [write])
  const setPage = useCallback((n: number) => write({}, n), [write])
  const setSize = useCallback((n: number) => write({}, 1, n), [write])
  const reset = useCallback(() => setParams(new URLSearchParams(), { replace: true }), [setParams])

  const activeCount = Object.keys(defaults).filter((k) => values[k] !== defaults[k]).length

  return { values, page, size, setFilters, setPage, setSize, reset, activeCount }
}
