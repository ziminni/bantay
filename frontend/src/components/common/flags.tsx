import { Footprints, MonitorX, PackageMinus, UserRoundSearch, type LucideIcon } from 'lucide-react'
import type { FlagStatus, FlagType } from '@/api/types'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { cn } from '@/lib/cn'

/**
 * One icon, label and tint per flag type, used everywhere a flag appears
 * (queue, bell, dashboard, overlays) so a type is recognised at a glance.
 */
export const FLAG_TYPES: Record<FlagType, { label: string; short: string; icon: LucideIcon; tint: string; rule: string }> = {
  RUNNING: {
    label: 'Running',
    short: 'Running',
    icon: Footprints,
    tint: 'bg-orange-50 text-orange-700 ring-orange-600/20',
    rule: 'Hips move faster than 1.5 body-heights per second for 1 s.',
  },
  EQUIPMENT_REMOVAL: {
    label: 'Equipment removal',
    short: 'Removal',
    icon: PackageMinus,
    tint: 'bg-red-50 text-red-700 ring-red-600/20',
    rule: 'Carried into the door zone, or gone 30 s after a wrist touched it.',
  },
  UNAUTHORIZED_USE: {
    label: 'Unauthorized use',
    short: 'PC misuse',
    icon: MonitorX,
    tint: 'bg-violet-50 text-violet-700 ring-violet-600/20',
    rule: 'Wrists on a workstation 10 s outside lab hours, or 5 s at the instructor PC.',
  },
  UNKNOWN_PERSON: {
    label: 'Unknown person',
    short: 'Unknown',
    icon: UserRoundSearch,
    tint: 'bg-marigold-50 text-marigold-800 ring-marigold-600/25',
    rule: 'A face that stays below the threshold after voting.',
  },
}

export const FLAG_TYPE_ORDER: FlagType[] = ['RUNNING', 'EQUIPMENT_REMOVAL', 'UNAUTHORIZED_USE', 'UNKNOWN_PERSON']

export const FLAG_STATUS_LABELS: Record<FlagStatus, string> = {
  PENDING: 'Pending',
  CONFIRMED: 'Confirmed',
  DISMISSED: 'Dismissed',
}

/** Square icon tile in the flag's tint. */
export function FlagTypeIcon({ type, className }: { type: FlagType; className?: string }) {
  const meta = FLAG_TYPES[type]
  return (
    <span
      aria-hidden
      className={cn('inline-flex size-9 shrink-0 items-center justify-center rounded-xl ring-1 ring-inset [&_svg]:size-[18px]', meta.tint, className)}
    >
      <meta.icon strokeWidth={1.9} />
    </span>
  )
}

export function FlagTypeBadge({ type }: { type: FlagType }) {
  const meta = FLAG_TYPES[type]
  return (
    <span className={cn('inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset', meta.tint)}>
      <meta.icon className="size-3.5" aria-hidden />
      {meta.label}
    </span>
  )
}

export function FlagStatusBadge({ status }: { status: FlagStatus }) {
  const tone = status === 'PENDING' ? 'warning' : status === 'CONFIRMED' ? 'danger' : 'neutral'
  return (
    <StatusBadge tone={tone} pulse={status === 'PENDING'}>
      {FLAG_STATUS_LABELS[status]}
    </StatusBadge>
  )
}
