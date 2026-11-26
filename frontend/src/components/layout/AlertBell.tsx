import { ArrowRight, Bell, CheckCheck } from 'lucide-react'
import { useEffect, useId, useRef, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { listFlags, subscribeFlags } from '@/api/flags'
import type { FlagRead } from '@/api/types'
import { FLAG_TYPES, FlagTypeIcon } from '@/components/common/flags'
import { useFlagCounts } from '@/hooks/useFlagCounts'
import { cn } from '@/lib/cn'
import { formatRelative } from '@/lib/format'

/**
 * The alert bell in the top bar: how many flags wait for a decision, and the
 * newest five, one click from the review screen.
 */
export function AlertBell() {
  const counts = useFlagCounts()
  const pending = counts?.PENDING ?? 0
  const [open, setOpen] = useState(false)
  const [items, setItems] = useState<FlagRead[]>()
  const wrapper = useRef<HTMLDivElement>(null)
  const panelId = useId()
  const { pathname } = useLocation()
  const [prevPath, setPrevPath] = useState(pathname)
  if (prevPath !== pathname) {
    setPrevPath(pathname)
    setOpen(false)
  }

  // Load the newest pending flags while the panel is open.
  useEffect(() => {
    if (!open) return
    let alive = true
    const load = () => {
      listFlags({ status: 'PENDING' })
        .then((rows) => alive && setItems(rows.slice(0, 5)))
        .catch(() => alive && setItems([]))
    }
    load()
    const unsubscribe = subscribeFlags(load)
    return () => {
      alive = false
      unsubscribe()
    }
  }, [open])

  // Close on a click elsewhere or on Esc.
  useEffect(() => {
    if (!open) return
    const onPointer = (e: PointerEvent) => {
      if (!wrapper.current?.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('pointerdown', onPointer)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onPointer)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div ref={wrapper} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={panelId}
        aria-label={pending ? `${pending} flags waiting for review` : 'No flags waiting'}
        title={pending ? `${pending} flags waiting for review` : 'No flags waiting'}
        className={cn(
          'relative flex size-10 items-center justify-center rounded-full border bg-white text-navy-800 shadow-card transition-colors',
          open ? 'border-navy-300' : 'border-gray-200 hover:border-gray-300',
        )}
      >
        <Bell className="size-[18px]" strokeWidth={1.9} />
        {pending > 0 && (
          <span className="absolute -top-1 -right-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-marigold-400 px-1 text-[11px] font-semibold text-navy-950 ring-2 ring-cream tabular-nums">
            {pending > 9 ? '9+' : pending}
          </span>
        )}
      </button>

      {open && (
        <div
          id={panelId}
          role="dialog"
          aria-label="Pending flags"
          className="absolute right-0 z-30 mt-2 w-[22rem] max-w-[calc(100vw-2rem)] animate-fade-in overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-overlay"
        >
          <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
            <p className="text-sm font-semibold text-navy-900">Pending flags</p>
            <span className="text-xs text-gray-500 tabular-nums">{pending} waiting</span>
          </div>

          {items === undefined ? (
            <div className="space-y-2 p-4">
              {[0, 1, 2].map((i) => (
                <div key={i} className="h-12 animate-pulse rounded-xl bg-gray-100" />
              ))}
            </div>
          ) : items.length === 0 ? (
            <div className="flex flex-col items-center gap-2 px-4 py-8 text-center">
              <span className="flex size-10 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
                <CheckCheck className="size-5" />
              </span>
              <p className="text-sm font-medium text-navy-900">All caught up</p>
              <p className="text-xs text-gray-500">Every flag has been reviewed.</p>
            </div>
          ) : (
            <ul className="max-h-80 divide-y divide-gray-100 overflow-y-auto">
              {items.map((f) => (
                <li key={f.id}>
                  <Link to={`/flags/${f.id}`} className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-gray-50">
                    <FlagTypeIcon type={f.type} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-navy-900">{FLAG_TYPES[f.type].label}</span>
                      <span className="block truncate text-xs text-gray-500">
                        {f.lab_name} · {f.camera_name}
                      </span>
                    </span>
                    <span className="shrink-0 text-xs text-gray-500">{formatRelative(f.occurred_at)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}

          <Link
            to="/flags"
            className="flex items-center justify-center gap-1.5 border-t border-gray-100 bg-gray-50 px-4 py-2.5 text-sm font-medium text-navy-900 transition-colors hover:bg-gray-100"
          >
            Review all flags
            <ArrowRight className="size-4" />
          </Link>
        </div>
      )}
    </div>
  )
}
