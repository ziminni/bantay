import { useCallback, useMemo, useState, type ReactNode } from 'react'
import { cn } from '@/lib/cn'
import { ToastContext, type ToastApi } from './useToast'

type Tone = 'success' | 'error'

interface Toast {
  id: number
  message: string
  tone: Tone
}

/** Short confirmations ("Lab saved") in the bottom-right corner. */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const push = useCallback((message: string, tone: Tone) => {
    const id = Date.now() + Math.random()
    setToasts((t) => [...t, { id, message, tone }])
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4000)
  }, [])

  const api = useMemo<ToastApi>(
    () => ({ success: (m) => push(m, 'success'), error: (m) => push(m, 'error') }),
    [push],
  )

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div aria-live="polite" className="pointer-events-none fixed right-4 bottom-4 z-50 flex w-80 max-w-[calc(100%-2rem)] flex-col gap-2">
        {toasts.map((t) => (
          <div
            key={t.id}
            role={t.tone === 'error' ? 'alert' : 'status'}
            className={cn(
              'pointer-events-auto rounded-md border bg-white px-4 py-3 text-sm shadow-lg',
              t.tone === 'error' ? 'border-red-300 text-red-800' : 'border-gray-300 text-gray-900',
            )}
          >
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}
