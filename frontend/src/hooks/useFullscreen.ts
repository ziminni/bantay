import { useCallback, useEffect, useRef, useState } from 'react'

// Safari still uses the prefixed names.
type FsElement = HTMLElement & { webkitRequestFullscreen?: () => Promise<void> | void }
type FsDocument = Document & { webkitFullscreenElement?: Element | null; webkitExitFullscreen?: () => Promise<void> | void }

const doc = () => document as FsDocument
const currentFullscreen = () => doc().fullscreenElement ?? doc().webkitFullscreenElement ?? null

/**
 * Put one element into the browser's full-screen mode and back.
 * `supported` is false on browsers that cannot (e.g. iPhone Safari for non-video elements).
 */
export function useFullscreen<T extends HTMLElement>() {
  const ref = useRef<T>(null)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [supported] = useState(
    () => typeof document !== 'undefined' && Boolean(document.fullscreenEnabled || (document.documentElement as FsElement).webkitRequestFullscreen),
  )

  useEffect(() => {
    const onChange = () => setIsFullscreen(currentFullscreen() === ref.current && ref.current !== null)
    document.addEventListener('fullscreenchange', onChange)
    document.addEventListener('webkitfullscreenchange', onChange)
    return () => {
      document.removeEventListener('fullscreenchange', onChange)
      document.removeEventListener('webkitfullscreenchange', onChange)
    }
  }, [])

  const enter = useCallback(async () => {
    const el = ref.current as FsElement | null
    if (!el) return
    if (el.requestFullscreen) await el.requestFullscreen()
    else await el.webkitRequestFullscreen?.()
  }, [])

  const exit = useCallback(async () => {
    if (!currentFullscreen()) return
    if (doc().exitFullscreen) await doc().exitFullscreen()
    else await doc().webkitExitFullscreen?.()
  }, [])

  const toggle = useCallback(() => (currentFullscreen() ? exit() : enter()), [enter, exit])

  // Leave full screen if the component goes away while still in it.
  useEffect(() => () => void exit().catch(() => undefined), [exit])

  return { ref, isFullscreen, supported, enter, exit, toggle }
}
