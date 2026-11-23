import { CheckCircle2, XCircle } from 'lucide-react'
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
              'pointer-events-auto flex animate-fade-in items-start gap-3 rounded-xl px-4 py-3 text-sm shadow-overlay',
              t.tone === 'error' ? 'bg-red-700 text-white' : 'bg-navy-900 text-cream',
            )}
          >
            {t.tone === 'error' ? (
              <XCircle className="mt-0.5 size-4 shrink-0 text-red-200" aria-hidden />
            ) : (
              <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-marigold-400" aria-hidden />
            )}
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}
