import { useEffect, useRef, useState } from 'react'
import { useDebouncedValue } from './useDebouncedValue'

/**
 * Local state for a search box that commits its value (e.g. to the URL) only
 * after typing pauses, and follows the committed value when it changes elsewhere
 * (e.g. "Clear all").
 */
export function useSearchBox(committed: string, commit: (value: string) => void, delay = 300) {
  const [value, setValue] = useState(committed)
  const [lastCommitted, setLastCommitted] = useState(committed)
  const debounced = useDebouncedValue(value, delay)

  // Follow outside changes during render rather than in an effect.
  if (committed !== lastCommitted) {
    setLastCommitted(committed)
    setValue(committed)
  }

  const commitRef = useRef(commit)
  useEffect(() => {
    commitRef.current = commit
  })

  const committedRef = useRef(committed)
  useEffect(() => {
    committedRef.current = committed
  })

  useEffect(() => {
    if (debounced !== committedRef.current) commitRef.current(debounced)
  }, [debounced])

  return [value, setValue] as const
}
