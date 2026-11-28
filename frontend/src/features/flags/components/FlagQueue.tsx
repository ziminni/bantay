import { useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import type { FlagRead } from '@/api/types'
import { FLAG_TYPES, FlagTypeIcon } from '@/components/common/flags'
import { cn } from '@/lib/cn'
import { formatRelative, formatTime } from '@/lib/format'

/** The list of flags on the left of the review screen, newest first. */
export function FlagQueue({ flags, selectedId, search }: { flags: FlagRead[]; selectedId?: number; search: string }) {
  const activeRef = useRef<HTMLLIElement | null>(null)

  useEffect(() => {
    if (activeRef.current) {
      activeRef.current.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
    }
  }, [selectedId])

  return (
    <ul className="space-y-2.5" aria-label="Flags">
      {flags.map((f) => {
        const active = f.id === selectedId
        return (
          <li key={f.id} ref={active ? activeRef : undefined}>
            <Link
              to={{ pathname: `/flags/${f.id}`, search }}
              aria-current={active ? 'true' : undefined}
              className={cn(
                'group flex items-start gap-3 rounded-xl border px-3.5 py-3 transition-[background-color,border-color,box-shadow]',
                active
                  ? 'border-navy-900 bg-white shadow-raised ring-1 ring-navy-900'
                  : 'border-gray-200/80 bg-white shadow-card hover:border-gray-300',
              )}
            >
              <FlagTypeIcon type={f.type} />
              <span className="min-w-0 flex-1">
                <span className="flex items-center justify-between gap-2">
                  <span className="truncate text-sm font-semibold text-navy-900">{FLAG_TYPES[f.type].label}</span>
                  <span className="shrink-0 text-xs text-gray-500 tabular-nums" title={formatTime(f.occurred_at)}>
                    {formatRelative(f.occurred_at)}
                  </span>
                </span>
                <span className="mt-0.5 block truncate text-xs text-gray-500">
                  {f.lab_name} · {f.camera_name}
                </span>
                <span className="mt-1.5 flex items-center gap-2 text-[11px] text-gray-500">
                  <span className="rounded bg-gray-100 px-1.5 py-0.5 font-mono text-navy-700">
                    {formatEvidenceValue(f.evidence.value, f.evidence.unit)}
                  </span>
                  <span>
                    {f.persons_inside.length} inside
                  </span>
                  {f.status !== 'PENDING' && (
                    <span className={cn('ml-auto font-medium', f.status === 'CONFIRMED' ? 'text-red-700' : 'text-gray-500')}>
                      {f.status === 'CONFIRMED' ? 'Confirmed' : 'Dismissed'}
                    </span>
                  )}
                </span>
              </span>
            </Link>
          </li>
        )
      })}
    </ul>
  )
}

/** 0.31 with no unit → "31%"; 2.14 body-heights/s → "2.14 body-heights/s". */
export function formatEvidenceValue(value: number, unit: string): string {
  if (!unit) return `${Math.round(value * 100)}%`
  if (unit === 'object') return 'detected'
  const rounded = Number.isInteger(value) ? value : Number(value.toFixed(2))
  return `${rounded} ${unit}`
}
