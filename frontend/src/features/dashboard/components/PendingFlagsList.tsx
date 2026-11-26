import { ArrowRight, CheckCheck } from 'lucide-react'
import { listFlags } from '@/api/flags'
import type { FlagRead } from '@/api/types'
import { FLAG_TYPES, FlagTypeIcon } from '@/components/common/flags'
import { ButtonLink } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { Skeleton } from '@/components/ui/LoadingState'
import { useAsync } from '@/hooks/useAsync'
import { formatRelative, formatTime } from '@/lib/format'

export function PendingFlagsList({ labId }: { labId?: number }) {
  const { data: flags, loading } = useAsync(
    () => listFlags({ status: 'PENDING', lab_id: labId }),
    [labId],
    { refreshInterval: 10_000 },
  )

  if (loading && !flags) {
    return (
      <div className="space-y-3 p-5 sm:p-6">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-16 rounded-xl" />
        ))}
      </div>
    )
  }

  const items = flags?.slice(0, 4) ?? []

  if (items.length === 0) {
    return (
      <EmptyState
        icon={<CheckCheck className="text-emerald-600" />}
        title="No pending flags"
        description="All behaviour alerts in this lab have been reviewed."
      />
    )
  }

  return (
    <div>
      <ul className="divide-y divide-gray-100">
        {items.map((f: FlagRead) => (
          <li
            key={f.id}
            className="flex items-center justify-between gap-3 px-5 py-3.5 sm:px-6 transition-colors hover:bg-gray-50/70"
          >
            <div className="flex min-w-0 items-center gap-3">
              <FlagTypeIcon type={f.type} />
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-navy-900">
                  {FLAG_TYPES[f.type].label}
                </p>
                <p className="truncate text-xs text-gray-500">
                  {f.lab_name} · {f.camera_name ?? 'Room'} ·{' '}
                  <span title={formatTime(f.occurred_at)}>{formatRelative(f.occurred_at)}</span>
                </p>
              </div>
            </div>
            <ButtonLink
              to={`/flags/${f.id}`}
              size="sm"
              variant="secondary"
              className="shrink-0 text-xs"
            >
              Review
            </ButtonLink>
          </li>
        ))}
      </ul>
      <div className="border-t border-gray-100 p-3 sm:px-6">
        <ButtonLink
          to={labId ? `/flags?lab_id=${labId}` : '/flags'}
          variant="ghost"
          size="sm"
          className="w-full justify-center text-navy-900 font-medium"
        >
          Review all flags
          <ArrowRight className="size-4" />
        </ButtonLink>
      </div>
    </div>
  )
}
