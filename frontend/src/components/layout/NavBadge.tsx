import { useFlagCounts } from '@/hooks/useFlagCounts'
import type { NavItem } from './navigation'

/**
 * A live count beside a sidebar item. Marigold is the only accent at rest in
 * the sidebar, so a waiting flag is the first thing the eye lands on.
 */
export function NavBadge({ kind }: { kind: NonNullable<NavItem['badge']> }) {
  const counts = useFlagCounts()
  const value = kind === 'pendingFlags' ? (counts?.PENDING ?? 0) : 0
  if (!value) return null
  return (
    <span
      className="ml-auto inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-marigold-400 px-1.5 text-[11px] font-semibold text-navy-950 tabular-nums"
      aria-label={`${value} pending`}
    >
      {value > 99 ? '99+' : value}
    </span>
  )
}
